#!/usr/bin/env python3
# 🜂 Athena Genesis — brain_v2.2.py (upgraded)
# Orchestrates one epoch: fetch oracle truth → score agents → compute MIS →
# compute rewards → build Merkle → write report + append ledger.

import json, csv, time, argparse, statistics
from typing import Dict, List
from decimal import Decimal, ROUND_DOWN, InvalidOperation
import requests
from eth_utils import keccak
from pathlib import Path

# ---------------------------- config --------------------------------
CONFIG_VERSION = "2.2"
ORACLE_PATH = Path("oracle.json")
LEDGER_PATH = Path("ledger.csv")
OUT_DIR = Path("out")  # NOTE: run_epoch.py passes --report; this is only the fallback.
TOKEN_SYMBOL = "ATA"  # display only
OUT_DIR.mkdir(exist_ok=True)

# --------------------------- utilities -------------------------------
def validate_agent(wallet: str, data: dict):
    if not isinstance(wallet, str) or not wallet.startswith("0x") or len(wallet) != 42:
        raise ValueError(f"Agent wallet invalid: {wallet}")
    if "prediction" not in data or not isinstance(data["prediction"], (int, float)):
        raise ValueError(f"Agent {wallet}: missing or invalid 'prediction'")
    if not (0 <= data["prediction"] <= 1e9):
        raise ValueError(f"Agent {wallet}: prediction out of range")

def normalize_squared(values: List[float]) -> List[float]:
    squares = [v * v for v in values]
    s = sum(squares)
    return [sq / s for sq in squares] if s > 0 else [0.0 for _ in values]

# ---- Merkle helpers -------------------------------------------------
def merkle_leaf(wallet: str, amount_wei: int, epoch: int) -> bytes:
    addr = bytes.fromhex(wallet[2:])
    packed = addr + amount_wei.to_bytes(32, "big") + epoch.to_bytes(32, "big")
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
def fetch_oracle_price(target_symbol="BTC-USD") -> (float, list):
    with ORACLE_PATH.open(encoding="utf-8") as f:
        oracle = json.load(f)
    target = next((t for t in oracle["targets"] if t["symbol"] == target_symbol), None)
    if not target:
        raise ValueError(f"No oracle target found for {target_symbol}")

    fallback_conf = oracle.get("fallback", {})
    timeout = fallback_conf.get("timeoutMs", 5000) / 1000
    chainlink_threshold = fallback_conf.get("chainlinkThreshold", 3)

    prices, weights, src_names = [], [], []
    for src in target["sources"]:
        if not src.get("enabled", True):
            continue
        try:
            r = requests.get(src["url"], timeout=src.get("timeout", timeout))
            r.raise_for_status()
            data = r.json()
            p = parse_price(data, src["name"])
            if p is not None:
                prices.append(float(p))
                weights.append(float(src.get("weight", 0.9)))
                src_names.append(src["name"])
        except Exception as e:
            print(f"[WARN] {src['name']} failed: {e}")

    # Chainlink fallback if too few valid sources
    if len(prices) < chainlink_threshold:
        cl = next((s for s in target["sources"] if s.get("fallback")), None)
        if cl:
            try:
                r = requests.get(cl["url"], timeout=cl.get("timeout", timeout))
                r.raise_for_status()
                p = float(r.json().get("price"))
                prices.append(p)
                weights.append(float(cl.get("weight", 0.99)))
                src_names.append(cl["name"])
                print("[INFO] Chainlink fallback used.")
            except Exception as e:
                print(f"[WARN] Chainlink fallback failed: {e}")

    if not prices:
        raise RuntimeError("All oracle sources failed")

    med = statistics.median(prices)
    print(f"[Oracle] {target_symbol} median: {med:.2f} ({len(prices)} sources OK)")
    return med, src_names

def parse_price(data, name):
    try:
        if name == "Coinbase":  return float(data["price"])
        if name == "Kraken":    return float(list(data["result"].values())[0]["c"][0])
        if name == "Bitstamp":  return float(data["last"])
        if name == "Binance":   return float(data["price"])
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

# ----------------------------- main ---------------------------------
def main():
    ap = argparse.ArgumentParser(description="Athena Genesis epoch orchestrator")
    ap.add_argument("--epoch", type=int, required=True)
    ap.add_argument("--pool", type=str, required=True)
    ap.add_argument("--agents", type=str, default="agents.json")
    ap.add_argument("--report", type=str)
    ap.add_argument("--token_decimals", type=int, default=18)
    ap.add_argument("--emit-proofs", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    with open(args.agents, encoding="utf-8") as f:
        agents: Dict[str, Dict] = json.load(f)

    wallets = list(agents.keys())
    if not wallets:
        raise ValueError("No agents found")

    for w in wallets:
        validate_agent(w, agents[w])

    print(f"\n[Athena] Epoch {args.epoch} — {len(wallets)} agents")
    truth_price, src_names = fetch_oracle_price("BTC-USD")

    # Compute individual MIS
    for w in wallets:
        pred = float(agents[w]["prediction"])
        err = abs(pred - truth_price) / truth_price
        agents[w]["mis"] = max(0.0, 1.0 - err)

    pool = Decimal(str(args.pool))
    mis_values = [agents[w]["mis"] for w in wallets]
    weights = normalize_squared(mis_values)
    merit_pool = pool * Decimal("0.60")

    # Rewards (merit-based)
    rewards_ata: Dict[str, Decimal] = {}
    for i, w in enumerate(wallets):
        rewards_ata[w] = Decimal(str(weights[i])) * merit_pool

    # Caps & floors
    hard_cap = pool * Decimal("0.10")
    med_reward = Decimal(sorted([float(x) for x in rewards_ata.values()])[len(rewards_ata) // 2]) if rewards_ata else Decimal("0")
    soft_cap = med_reward * Decimal("3")
    for w in rewards_ata:
        rewards_ata[w] = min(rewards_ata[w], hard_cap, soft_cap)

    floor = pool * Decimal("0.0001")
    for w in rewards_ata:
        if rewards_ata[w] < floor:
            rewards_ata[w] = min(floor, hard_cap)

    # Build Merkle leaves + claim rows
    scale = Decimal(f"1e{args.token_decimals}")
    leaves: List[bytes] = []
    claim_rows = []
    for w in wallets:
        try:
            reward_wei = int((rewards_ata[w] * scale).to_integral_value(ROUND_DOWN))
        except (InvalidOperation, OverflowError) as e:
            raise ValueError(f"Bad reward for {w}: {rewards_ata[w]} ({e})")
        leaves.append(merkle_leaf(w, reward_wei, args.epoch))
        claim_rows.append({
            "wallet": w,
            "amount": float(rewards_ata[w].quantize(Decimal("0.00000001"))),
            "amountWei": str(reward_wei),
            "mis": round(agents[w]["mis"], 6),
        })

    # ---------------- Compute Epoch Root & Metrics -----------------
    avg_mis = sum(mis_values) / len(mis_values) if mis_values else 0.0
    root = build_merkle(leaves)
    root_hex = "0x" + root.hex()

    # ---------------- Build Final Report -----------------
    report = {
        "epoch": args.epoch,
        "token": TOKEN_SYMBOL,
        "pool": str(pool),
        "oracleTruth": float(truth_price),
        "merkleRoot": root_hex,
        "claims": claim_rows,
        "oracleSources": src_names,
        "agentCount": len(wallets),
        "configVersion": CONFIG_VERSION,
    }

    # Derived metrics for frontend and benchmark
    report["truthRate"] = round(avg_mis * 100, 4)

    if args.emit_proofs:
        proofs = build_proofs(leaves)
        report["proofs"] = proofs

    report_path = Path(args.report) if args.report else OUT_DIR / f"epoch_{args.epoch}_report.json"

    # ---------------- Write Outputs -----------------
    if not args.dry_run:
        report_path.parent.mkdir(parents=True, exist_ok=True)
        with report_path.open("w", encoding="utf-8") as f:
            json.dump(report, f, indent=2)

        exists = LEDGER_PATH.exists()
        with LEDGER_PATH.open("a", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            if not exists:
                writer.writerow(["date", "epoch", "agent_id", "wallet", "mis", "reward_ata", "category", "tx_hash"])
            for w in wallets:
                writer.writerow([
                    time.strftime("%Y-%m-%d"),
                    args.epoch,
                    agents[w].get("agentId", ""),
                    w,
                    round(agents[w]["mis"], 6),
                    float(rewards_ata[w].quantize(Decimal("0.00000001"))),
                    "merit",
                    ""
                ])

    # ---------------- Console Summary -----------------
    print(f"\n[Athena] Epoch {args.epoch} complete.")
    print(f"Merkle root: {root_hex}")
    print(f"Oracle BTC-USD: {truth_price:.2f}")
    print(f"Sources used: {', '.join(src_names)}")

    if not args.dry_run:
        # Use plain ASCII arrows for Windows compatibility
        print(f"Report -> {report_path}")
        print(f"Ledger -> {LEDGER_PATH}")
    else:
        print("[dry-run] No files written.")


if __name__ == "__main__":
    main()
