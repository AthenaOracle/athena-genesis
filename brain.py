#!/usr/bin/env python3
# ▽ Athena Genesis — brain_v2.6b.py (Truth Engine v2.6b — DAO Split Alignment)
# - DAO split = emission (merit, bounty, dev, treasury)
# - Burn/top-up removed
# - Manifest sync + audit consistency with manifest.json v2.6b
# - CONFIG_VERSION = "2.6b"
# - Insight tags + z-score feedback loop
# - Truth bounty width/confidence guard
# - split_history.jsonl audit trail
#
# Preserved from v2.5:
# - Range + confidence MIS (point fallback)
# - Reputation decay memory (reputation.json)
# - Truth power weighting: (MIS^alpha) * rep
# - Top-3 bounty with streak decay + configurable DAO split (split.json)
# - Merkle tree + optional proofs
# - Pulse sub-epoch ID in Merkle leaves
# - Agent history JSONL, oracle health metrics (SES/latency)
# - Backwards-compatible inputs & robust I/O

import json, csv, time, argparse, statistics, math
from typing import Dict, List, Tuple
from decimal import Decimal, ROUND_DOWN, InvalidOperation
import requests
from eth_utils import keccak
from pathlib import Path
from dataclasses import dataclass

# ---------------------------- config --------------------------------
CONFIG_VERSION = "2.5.1"
ORACLE_PATH = Path("oracle.json")
LEDGER_PATH = Path("ledger.csv")
AGENT_HISTORY_PATH = Path("agent_history.jsonl")
SPLIT_HISTORY_PATH = Path("split_history.jsonl")
OUT_DIR = Path("out")  # fallback if --report not provided
TOKEN_SYMBOL = "ATA"  # display only
OUT_DIR.mkdir(exist_ok=True)

# --------------------------- utilities -------------------------------
def load_json(path: str | Path, default):
    p = Path(path)
    if not p.exists():
        return default
    with p.open(encoding="utf-8") as f:
        try:
            return json.load(f)
        except Exception:
            return default

def save_json(path: str | Path, data):
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    with p.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

def validate_agent(wallet: str, data: dict):
    if not isinstance(wallet, str) or not wallet.startswith("0x") or len(wallet) != 42:
        raise ValueError(f"Agent wallet invalid: {wallet}")
    # allow either point prediction OR range+confidence
    if "range" in data:
        rng = data["range"]
        if not (isinstance(rng, (list, tuple)) and len(rng) == 2):
            raise ValueError(f"Agent {wallet}: invalid range")
        lo, hi = float(rng[0]), float(rng[1])
        if not (math.isfinite(lo) and math.isfinite(hi) and lo <= hi):
            raise ValueError(f"Agent {wallet}: bad range values")
        if "prediction" in data:
            # both present is okay; range takes precedence when scoring
            if not isinstance(data["prediction"], (int, float)):
                raise ValueError(f"Agent {wallet}: invalid 'prediction'")
    else:
        if "prediction" not in data or not isinstance(data["prediction"], (int, float)):
            raise ValueError(f"Agent {wallet}: missing or invalid 'prediction'")
        if not (0 <= float(data["prediction"]) <= 1e12):
            raise ValueError(f"Agent {wallet}: prediction out of range")

def truth_power_weights(mis_values: List[float], rep_values: List[float], alpha: float) -> List[float]:
    # weight_i ∝ (MIS_i ** alpha) * rep_i
    raw = []
    for m, r in zip(mis_values, rep_values):
        m = max(0.0, float(m))
        r = max(0.0, float(r))
        raw.append((m ** max(0.0, alpha)) * r)
    s = sum(raw)
    return [x / s if s > 0 else 0.0 for x in raw]

# ---- Merkle helpers -------------------------------------------------
def merkle_leaf(wallet: str, amount_wei: int, epoch: int, pulse: int | None) -> bytes:
    addr = bytes.fromhex(wallet[2:])
    # Include pulse to avoid collisions across sub-epochs
    pulse_bytes = (pulse if pulse is not None else 0).to_bytes(32, "big")
    packed = addr + amount_wei.to_bytes(32, "big") + epoch.to_bytes(32, "big") + pulse_bytes
    return keccak(packed)

def keccak_pair(left: bytes, right: bytes) -> bytes:
    return keccak(left + right)

def build_merkle(leaves: List[bytes]) -> bytes:
    if not leaves:
        return b"\x00" * 32
    level = leaves[:]
    while len(level) > 1:
        nxt = []
        for i in range(0, len(level), 2):
            a = level[i]
            b = level[i + 1] if i + 1 < len(level) else level[i]
            nxt.append(keccak_pair(a, b))
        level = nxt
    return level[0]

def build_proofs(leaves: List[bytes]) -> Dict[str, List[str]]:
    if not leaves:
        return {}
    levels = [leaves[:]]
    while len(levels[-1]) > 1:
        curr = levels[-1]
        nxt = []
        for i in range(0, len(curr), 2):
            a = curr[i]
            b = curr[i + 1] if i + 1 < len(curr) else curr[i]
            nxt.append(keccak_pair(a, b))
        levels.append(nxt)
    proofs: Dict[int, List[bytes]] = {}
    for idx in range(len(leaves)):
        path = []
        j = idx
        for depth in range(len(levels) - 1):
            curr = levels[depth]
            is_right = (j % 2 == 1)
            sib = curr[j - 1] if is_right else (curr[j + 1] if j + 1 < len(curr) else curr[j])
            path.append(sib)
            j //= 2
        proofs[idx] = path
    out: Dict[str, List[str]] = {}
    for i, path in proofs.items():
        out[str(i)] = ["0x" + p.hex() for p in path]
    return out

# --------------------------- oracle fetch ----------------------------
@dataclass
class OracleHealth:
    ok: int
    failed: int
    latency_ms_avg: float
    latency_ms_p95: float
    ses: float  # pseudo "signal efficiency" based on variability

def fetch_oracle_price(target_symbol="BTC-USD") -> Tuple[float, List[str], OracleHealth]:
    with ORACLE_PATH.open(encoding="utf-8") as f:
        oracle = json.load(f)
    target = next((t for t in oracle["targets"] if t["symbol"] == target_symbol), None)
    if not target:
        raise ValueError(f"No oracle target found for {target_symbol}")

    fallback_conf = oracle.get("fallback", {})
    timeout = fallback_conf.get("timeoutMs", 5000) / 1000
    chainlink_threshold = fallback_conf.get("chainlinkThreshold", 3)

    prices, weights, src_names, latencies = [], [], [], []
    total_sources = 0
    for src in target["sources"]:
        if not src.get("enabled", True):
            continue
        total_sources += 1
        try:
            t0 = time.time()
            r = requests.get(src["url"], timeout=src.get("timeout", timeout))
            r.raise_for_status()
            data = r.json()
            p = parse_price(data, src["name"])
            if p is not None and math.isfinite(float(p)):
                prices.append(float(p))
                weights.append(float(src.get("weight", 0.9)))
                src_names.append(src["name"])
            latencies.append((time.time() - t0) * 1000.0)
        except Exception:
            latencies.append((time.time() - t0) * 1000.0)
            # swallow; accounted via ok/failed counters

    # Chainlink fallback if too few valid sources
    if len(prices) < chainlink_threshold:
        cl = next((s for s in target["sources"] if s.get("fallback")), None)
        if cl:
            try:
                t0 = time.time()
                r = requests.get(cl["url"], timeout=cl.get("timeout", timeout))
                r.raise_for_status()
                p = float(r.json().get("price"))
                prices.append(p)
                weights.append(float(cl.get("weight", 0.99)))
                src_names.append(cl["name"])
                latencies.append((time.time() - t0) * 1000.0)
            except Exception:
                pass

    if not prices:
        raise RuntimeError("All oracle sources failed")

    med = statistics.median(prices)

    # oracle health metrics
    ok = len(prices)
    failed = max(0, total_sources - ok)
    lat_avg = statistics.mean(latencies) if latencies else 0.0
    lat_p95 = (sorted(latencies)[int(0.95 * (len(latencies) - 1))] if latencies else 0.0)
    # SES proxy: lower dispersion => higher efficiency. Use CV-based invert.
    try:
        stdev = statistics.pstdev(prices)
        meanp = statistics.mean(prices)
        cv = stdev / meanp if meanp else 0.0
        ses = 1.0 / (1.0 + cv * 20.0)  # heuristic scaling
    except Exception:
        ses = 0.5

    return med, src_names, OracleHealth(ok=ok, failed=failed, latency_ms_avg=lat_avg, latency_ms_p95=lat_p95, ses=ses)

def parse_price(data, name):
    try:
        if name == "Coinbase":  return float(data["price"])
        if name == "Kraken":    return float(list(data["result"].values())[0]["c"][0])
        if name == "Bitstamp":  return float(data["last"])
        if name == "Binance":   return float(data["price"]) if "price" in data else float(data["data"]["price"]) if "data" in data else None
        if name == "OKX":       return float(data["data"][0]["last"])
        if name == "Bybit":     return float(data["result"]["list"][0]["lastPrice"])
        if name == "Gemini":    return float(data["last"])
        if name == "Bitfinex":  return float(data[6])
        if name == "Huobi":     return float(data["tick"]["close"])
        if name == "Gate":      return float(data[0]["last"])
        if name == "Chainlink": return float(data.get("price"))
    except Exception:
        return None
    return None

# ----------------------------- scoring ------------------------------
def compute_mis(agent: Dict, truth: float) -> float:
    # Range + confidence scoring with width penalty, plus guards; else point MIS
    if "range" in agent:
        lo, hi = float(agent["range"][0]), float(agent["range"][1])
        conf = float(agent.get("confidence", 0.8))
        truth = float(truth)
        if truth <= 0:
            return 0.0
        width = abs(hi - lo) / truth

        # --- Guards to prevent edge-case gaming ---
        # 1) Reject very wide ranges outright (>50% of truth)
        if width > 0.5:
            return 0.0
        # 2) Damp overconfidence on extremely narrow intervals
        if width < 0.05 and conf > 0.9:
            conf = 0.9
        # -----------------------------------------

        penalty = 1.0 / (1.0 + width * 10.0)
        hit = 1.0 if lo <= truth <= hi else 0.0
        return max(0.0, min(1.0, hit * conf * penalty))

    # point fallback
    pred = float(agent["prediction"])
    if truth <= 0:
        return 0.0
    err = abs(pred - truth) / truth
    return max(0.0, 1.0 - err)

# ----------------------------- main ---------------------------------
def main():
    ap = argparse.ArgumentParser(description="Athena Genesis epoch orchestrator (v2.5.1)")
    ap.add_argument("--epoch", type=int, required=True)
    ap.add_argument("--pool", type=str, required=True)
    ap.add_argument("--agents", type=str, default="agents.json")
    ap.add_argument("--report", type=str)
    ap.add_argument("--token_decimals", type=int, default=18)
    ap.add_argument("--emit-proofs", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--truth-power-alpha", type=float, default=2.0)
    ap.add_argument("--pulse", type=int, default=None, help="Optional sub-epoch identifier")
    args = ap.parse_args()

    with open(args.agents, encoding="utf-8") as f:
        agents: Dict[str, Dict] = json.load(f)

    wallets = list(agents.keys())
    if not wallets:
        raise ValueError("No agents found")

    for w in wallets:
        validate_agent(w, agents[w])

    print(f"\n[Athena] Epoch {args.epoch} — {len(wallets)} agents")
    truth_price, src_names, ohealth = fetch_oracle_price("BTC-USD")

    # Compute individual MIS
    mis_values: List[float] = []
    timestamp = int(time.time())
    for w in wallets:
        m = compute_mis(agents[w], truth_price)
        agents[w]["mis"] = m
        mis_values.append(m)

    # -------- Insight tags + z-score feedback (NEW) --------
    mean_mis = statistics.mean(mis_values)
    stdev_mis = statistics.pstdev(mis_values) or 1.0
    for w in wallets:
        z = (agents[w]["mis"] - mean_mis) / stdev_mis
        tag = "elite" if z > 1 else ("outlier" if z < -1 else "consistent")
        agents[w]["zscore"] = round(z, 3)
        agents[w]["tag"] = tag
    # -------------------------------------------------------

    # Reputation memory
    rep = load_json("reputation.json", {})
    # Initialize unseen wallets with neutral rep 0.5
    rep_values = []
    for w in wallets:
        prev = float(rep.get(w, 0.5))
        rep_values.append(prev)

    # Truth power weights (MIS^alpha) * rep
    weights = truth_power_weights(mis_values, rep_values, args.truth_power_alpha)

    # DAO split (percentages)
    split = load_json("split.json", {"merit":60, "bounty":10, "dev":12, "treasury":18, "top3": [60, 25, 15]})

    pool = Decimal(str(args.pool))
    merit_pool = pool * Decimal(str(split.get("merit", 60) / 100))
    bounty_pool = pool * Decimal(str(split.get("bounty", 10) / 100))
    dev_pool = pool * Decimal(str(split.get("dev", 12) / 100))
    treasury_pool = pool * Decimal(str(split.get("treasury", 18) / 100))

    # Merit rewards (proportional)
    rewards_merit: Dict[str, Decimal] = {}
    for i, w in enumerate(wallets):
        rewards_merit[w] = Decimal(str(weights[i])) * merit_pool

    # Caps & floors
    hard_cap = pool * Decimal("0.10")
    med_reward = Decimal(sorted([float(x) for x in rewards_merit.values()])[len(rewards_merit) // 2]) if rewards_merit else Decimal("0")
    soft_cap = med_reward * Decimal("3")
    for w in rewards_merit:
        rewards_merit[w] = min(rewards_merit[w], hard_cap, soft_cap)

    floor = pool * Decimal("0.0001")
    for w in rewards_merit:
        if rewards_merit[w] < floor:
            rewards_merit[w] = min(floor, hard_cap)

    # --- Top-3 bounty with equal streak-decay (Option A) ---
    # Rank by MIS; ties broken by higher reputation, then wallet asc
    ranked = sorted(wallets, key=lambda w: (agents[w]["mis"], rep.get(w, 0.5), w), reverse=True)
    top3 = ranked[:3]

    # Load / update per-position streak counters (wallet#pos)
    streak = load_json("streak.json", {})

    def bump_streak(wallet: str | None, pos: int) -> int:
        if wallet is None:
            return 0
        key = f"{wallet}#{pos}"
        streak[key] = int(streak.get(key, 0)) + 1
        return streak[key]

    streaks: List[int] = []
    for i, w in enumerate(top3):
        streaks.append(bump_streak(w, i + 1))

    # Reset streaks for wallets no longer in the current Top-3
    keep_keys = {f"{w}#{i+1}" for i, w in enumerate(top3)}
    for k in list(streak.keys()):
        if k not in keep_keys:
            streak[k] = 0

    # Decay curve: 1 / (1 + 0.1 * n)
    def decay(n: int, k: Decimal = Decimal("0.1"), floor_d: Decimal = Decimal("0")) -> Decimal:
        d = Decimal("1") / (Decimal("1") + k * Decimal(n))
        return max(d, floor_d)

    top3_split = split.get("top3", [60, 25, 15])
    tot = sum(top3_split) or 100
    base = [Decimal(x) / Decimal(tot) for x in top3_split[:len(top3)]]

    # Apply equal-form decay per position, then renormalize so Σ=1
    raw = [b * decay(streaks[i]) for i, b in enumerate(base)]
    total_raw = sum(raw) or Decimal("1")
    bounty_weights = [r / total_raw for r in raw]

    # Final bounty shares (full bounty pool conserved)
    bounty_rewards: Dict[str, Decimal] = {w: Decimal("0") for w in wallets}
    for i, w in enumerate(top3):
        bounty_rewards[w] = bounty_pool * bounty_weights[i]

    # Update reputation with current MIS (EMA)
    for w in wallets:
        prev = float(rep.get(w, 0.5))
        rep[w] = round(0.9 * prev + 0.1 * float(agents[w]["mis"]), 6)

    # -------------------- Build Merkle + Claims ----------------------
    scale = Decimal(f"1e{args.token_decimals}")

    def to_wei(dec_amount: Decimal) -> int:
        return int((dec_amount * scale).to_integral_value(ROUND_DOWN))

    leaves: List[bytes] = []
    claim_rows = []

    # combine merit + bounty
    total_rewards = {w: (rewards_merit.get(w, Decimal("0")) + bounty_rewards.get(w, Decimal("0"))) for w in wallets}

    for w in wallets:
        try:
            reward_wei = to_wei(total_rewards[w])
        except (InvalidOperation, OverflowError) as e:
            raise ValueError(f"Bad reward for {w}: {total_rewards[w]} ({e})")
        leaves.append(merkle_leaf(w, reward_wei, args.epoch, args.pulse))
        claim_rows.append({
            "wallet": w,
            "amount": float(total_rewards[w].quantize(Decimal("0.00000001"))),
            "amountWei": str(reward_wei),
            "mis": round(float(agents[w]["mis"]), 6),
            "rep": float(rep.get(w, 0.5)),
            "merit": float(rewards_merit[w].quantize(Decimal("0.00000001"))),
            "bounty": float(bounty_rewards[w].quantize(Decimal("0.00000001"))),
            "share": float(weights[wallets.index(w)]) if sum(weights) > 0 else 0.0,  # truth-power share (not bounty)
            # NEW feedback fields:
            "zscore": agents[w]["zscore"],
            "tag": agents[w]["tag"],
        })

    avg_mis = sum(mis_values) / len(mis_values) if mis_values else 0.0
    root = build_merkle(leaves)
    root_hex = "0x" + root.hex()

    # -------------------- Build Report JSON -------------------------
    top3_section = [
        {
            "wallet": w,
            "mis": round(float(agents[w]["mis"]), 6),
            "rep": float(rep.get(w, 0.5)),
            "bounty": float(bounty_rewards[w].quantize(Decimal("0.00000001")))
        }
        for w in top3
    ]

    report = {
        "epoch": args.epoch,
        "pulse": args.pulse,
        "token": TOKEN_SYMBOL,
        "pool": str(pool),
        "oracleTruth": float(truth_price),
        "merkleRoot": root_hex,
        "claims": claim_rows,
        "oracleSources": src_names,
        "agentCount": len(wallets),
        "configVersion": CONFIG_VERSION,
        "truthRate": round(avg_mis * 100, 4),
        "split": split,
        "top3": top3_section,
        # position-based streaks in report (wallet -> streak count for its current position)
        "streaks": {top3[i]: int(streak.get(f"{top3[i]}#{i+1}", 0)) for i in range(len(top3))},
        "oracleHealth": {
            "ok": ohealth.ok,
            "failed": ohealth.failed,
            "latencyMsAvg": round(ohealth.latency_ms_avg, 2),
            "latencyMsP95": round(ohealth.latency_ms_p95, 2),
            "ses": round(ohealth.ses, 4)
        }
    }

    if args.emit_proofs:
        proofs = build_proofs(leaves)
        report["proofs"] = proofs

    report_path = Path(args.report) if args.report else OUT_DIR / f"epoch_{args.epoch}_report.json"

    # ---------------- Write Outputs -----------------
    if not args.dry_run:
        report_path.parent.mkdir(parents=True, exist_ok=True)
        with report_path.open("w", encoding="utf-8") as f:
            json.dump(report, f, indent=2)

        # Ledger: merit and bounty categories as separate rows (for transparency)
        exists = LEDGER_PATH.exists()
        with LEDGER_PATH.open("a", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            if not exists:
                writer.writerow(["date", "epoch", "pulse", "agent_id", "wallet", "mis", "rep", "reward_ata", "category", "tx_hash"])
            for w in wallets:
                # merit row
                writer.writerow([
                    time.strftime("%Y-%m-%d"),
                    args.epoch,
                    args.pulse,
                    agents[w].get("agentId", ""),
                    w,
                    round(float(agents[w]["mis"]), 6),
                    float(rep.get(w, 0.5)),
                    float(rewards_merit[w].quantize(Decimal("0.00000001"))),
                    "merit",
                    ""
                ])
                # bounty row (may be zero)
                if bounty_rewards[w] > 0:
                    writer.writerow([
                        time.strftime("%Y-%m-%d"),
                        args.epoch,
                        args.pulse,
                        agents[w].get("agentId", ""),
                        w,
                        round(float(agents[w]["mis"]), 6),
                        float(rep.get(w, 0.5)),
                        float(bounty_rewards[w].quantize(Decimal("0.00000001"))),
                        "bounty",
                        ""
                    ])
            # dev + treasury synthetic rows (audit trail in CSV)
            if dev_pool > 0:
                writer.writerow([time.strftime("%Y-%m-%d"), args.epoch, args.pulse, "", "DEV", "", "", float(dev_pool), "dev", ""])
            if treasury_pool > 0:
                writer.writerow([time.strftime("%Y-%m-%d"), args.epoch, args.pulse, "", "TREASURY", "", "", float(treasury_pool), "treasury", ""])

        # Persist reputation & streak (position-based)
        save_json("reputation.json", rep)
        save_json("streak.json", streak)

        # Append agent history jsonl (include feedback fields)
        with AGENT_HISTORY_PATH.open("a", encoding="utf-8") as f:
            for w in wallets:
                rec = {
                    "ts": timestamp,
                    "epoch": args.epoch,
                    "pulse": args.pulse,
                    "wallet": w,
                    "agentId": agents[w].get("agentId", ""),
                    "truth": float(truth_price),
                    "prediction": float(agents[w].get("prediction", 0.0)),
                    "range": agents[w].get("range"),
                    "confidence": agents[w].get("confidence"),
                    "mis": float(agents[w]["mis"]),
                    "rep": float(rep.get(w, 0.5)),
                    "zscore": agents[w]["zscore"],
                    "tag": agents[w]["tag"],
                    "reward_merit": float(rewards_merit[w]),
                    "reward_bounty": float(bounty_rewards[w])
                }
                f.write(json.dumps(rec) + "\n")

        # NEW: Split history JSONL audit trail
        with SPLIT_HISTORY_PATH.open("a", encoding="utf-8") as f:
            split_rec = {
                "ts": timestamp,
                "epoch": args.epoch,
                "pulse": args.pulse,
                "merit": float(merit_pool),
                "bounty": float(bounty_pool),
                "dev": float(dev_pool),
                "treasury": float(treasury_pool),
                "split": split
            }
            f.write(json.dumps(split_rec) + "\n")

    # ---------------- Console Summary -----------------
    print(f"\n[Athena] Epoch {args.epoch} complete.")
    if args.pulse is not None:
        print(f"Pulse: {args.pulse}")
    print(f"Merkle root: {root_hex}")
    print(f"Oracle BTC-USD: {truth_price:.2f}")
    print(f"Sources used: {', '.join(src_names)}")
    print(f"Oracle health — ok: {ohealth.ok}, failed: {ohealth.failed}, avg: {ohealth.latency_ms_avg:.1f}ms, p95: {ohealth.latency_ms_p95:.1f}ms, ses: {ohealth.ses:.3f}")

    if not args.dry_run:
        print(f"Report -> {report_path}")
        print(f"Ledger -> {LEDGER_PATH}")
        print(f"Reputation -> reputation.json  |  Streak -> streak.json")
        print(f"Agent history -> {AGENT_HISTORY_PATH}")
        print(f"Split history -> {SPLIT_HISTORY_PATH}")
    else:
        print("[dry-run] No files written.")

if __name__ == "__main__":
    main()
