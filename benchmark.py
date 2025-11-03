#!/usr/bin/env python3
# benchmark.py — Athena Collective vs BTC Benchmark v2.6
# Adds Collective Diversity Index (CDI) based on MIS entropy
# Includes: learning curve, composite intelligence index, CSV export, metrics export

import json, csv, statistics, math
from typing import List, Dict
from pathlib import Path
from datetime import datetime
from MIS import collective_entropy  # 🔥 new import for diversity

# ---------------------------- config --------------------------------
OUT_DIR = Path("Epoch Report")
LEDGER_PATH = Path("ledger.csv")
BENCHMARK_REPORT = OUT_DIR / "benchmark_report.json"
TREND_CSV = OUT_DIR / "benchmark_trend.csv"
METRICS_PATH = OUT_DIR / "metrics.json"

# --------------------------- helpers --------------------------------
def fnum(x) -> float:
    """Safe float conversion to avoid crashes on malformed data."""
    try:
        return float(x)
    except Exception:
        return 0.0


def moving_average(data: List[float], window: int = 5) -> List[float]:
    """Return rolling 5-epoch moving average for smoother trend lines."""
    if len(data) < window:
        return data
    smooth = []
    for i in range(len(data)):
        start = max(0, i - window + 1)
        smooth.append(statistics.mean(data[start : i + 1]))
    return smooth


# --------------------------- loaders -------------------------------
def load_epoch_reports() -> Dict[int, Dict]:
    """Load and parse all epoch_X_report.json files."""
    reports = {}
    for file in OUT_DIR.glob("epoch_*_report.json"):
        try:
            epoch = int(file.name.split("_")[1])
            with open(file, "r") as f:
                reports[epoch] = json.load(f)
        except Exception as e:
            print(f"[WARN] Failed to parse {file}: {e}")
    return dict(sorted(reports.items()))


def load_ledger() -> List[Dict]:
    """Load the full reward ledger."""
    if not LEDGER_PATH.exists():
        print(f"[ERROR] Missing ledger: {LEDGER_PATH}")
        return []
    with open(LEDGER_PATH, "r", newline="") as f:
        return list(csv.DictReader(f))


# --------------------------- core logic ---------------------------
def compute_benchmark(reports: Dict[int, Dict]) -> Dict:
    """Compute performance statistics across all epochs."""
    epochs = sorted(reports.keys())
    if len(epochs) < 2:
        print("Need at least 2 epochs for benchmarking.")
        return {}

    results = {
        "version": "2.6",
        "epochs_analyzed": len(epochs),
        "epoch_range": [epochs[0], epochs[-1]],
        "agent_count_trend": [],
        "btc_hold_errors": [],
        "athena_errors": [],
        "collective_mis_trend": [],
        "outperformance_count": 0,
        "total_bonus_triggered": 0,
        "oracle_sources_used": set(),
        "diversity_trend": [],  # 🧩 NEW
    }

    prev_truth = None
    for epoch in epochs:
        r = reports[epoch]
        truth = fnum(r.get("oracleTruth"))
        aggregate = fnum(r.get("aggregatePrediction", truth))
        cmis = fnum(r.get("collectiveMIS", 0))
        bonus = bool(r.get("bonusTriggered", False))
        agent_count = len(r.get("claims", []))
        results["agent_count_trend"].append(agent_count)

        # calculate diversity index if agent MIS scores exist
        if "claims" in r and isinstance(r["claims"], list):
            agent_mis = [fnum(c.get("mis", 0)) for c in r["claims"] if fnum(c.get("mis", 0)) > 0]
            if agent_mis:
                diversity = collective_entropy(agent_mis)
                results["diversity_trend"].append(diversity)

        if "oracleSources" in r:
            results["oracle_sources_used"].update(r["oracleSources"])

        if prev_truth is not None and truth > 0:
            btc_err = abs(truth - prev_truth) / prev_truth
            ath_err = abs(aggregate - truth) / truth
            results["btc_hold_errors"].append(btc_err)
            results["athena_errors"].append(ath_err)
            results["collective_mis_trend"].append(cmis)
            if ath_err < btc_err:
                results["outperformance_count"] += 1
            if bonus:
                results["total_bonus_triggered"] += 1
        prev_truth = truth

    # --- averages and deltas ---
    if results["btc_hold_errors"]:
        avg_btc_err = statistics.mean(results["btc_hold_errors"])
        avg_ath_err = statistics.mean(results["athena_errors"])
        results["avg_btc_error"] = round(avg_btc_err, 6)
        results["avg_athena_error"] = round(avg_ath_err, 6)
        results["error_reduction_pct"] = round(
            (1 - avg_ath_err / avg_btc_err) * 100, 2
        )
        results["outperformance_rate"] = round(
            results["outperformance_count"] / len(results["btc_hold_errors"]) * 100, 2
        )

    # --- learning curve (smoothed MIS over time) ---
    results["collective_mis_trend_smooth"] = moving_average(results["collective_mis_trend"], 5)
    if results["collective_mis_trend"]:
        results["avg_collective_mis"] = round(statistics.mean(results["collective_mis_trend"]), 6)
        delta = (
            results["collective_mis_trend_smooth"][-1]
            - results["collective_mis_trend_smooth"][0]
        )
        results["collective_mis_delta"] = round(delta, 6)

    # --- diversity (entropy) ---
    if results["diversity_trend"]:
        results["avg_diversity_index"] = round(statistics.mean(results["diversity_trend"]), 6)
        results["diversity_stability"] = round(
            (1 - abs(results["diversity_trend"][-1] - results["diversity_trend"][0])
             / max(results["diversity_trend"])) * 100, 2
        )

    # --- agent growth trend ---
    if results["agent_count_trend"]:
        avg_agents = statistics.mean(results["agent_count_trend"])
        results["avg_agent_count"] = round(avg_agents, 1)
        if results["agent_count_trend"][0] > 0:
            growth = (
                results["agent_count_trend"][-1] / results["agent_count_trend"][0] - 1
            ) * 100
            results["agent_growth_pct"] = round(growth, 2)

    # --- ROI simulation (total rewards distributed) ---
    ledger = load_ledger()
    total_rewards = sum(fnum(r.get("reward_ata")) for r in ledger)
    first_pool = fnum(reports[epochs[0]].get("pool", 190000))
    if first_pool > 0:
        roi = (total_rewards / first_pool - 1) * 100
        results["simulated_roi"] = {
            "total_rewards_distributed": round(total_rewards, 2),
            "initial_pool": round(first_pool, 2),
            "roi_vs_initial_pool": round(roi, 2),
        }

    # --- composite intelligence index (truth * outperformance * diversity) ---
    truth_rate = results.get("avg_collective_mis", 0)
    outperf = results.get("outperformance_rate", 0)
    diversity = results.get("avg_diversity_index", 1)
    results["collective_intelligence_index"] = round(truth_rate * outperf * diversity, 4)

    results["oracle_sources_used"] = sorted(results["oracle_sources_used"])
    results["latest_epoch"] = epochs[-1]
    return results


# --------------------------- CSV export ---------------------------
def export_trend_csv(reports: Dict[int, Dict]):
    """Create benchmark_trend.csv for charting and analytics."""
    with open(TREND_CSV, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow([
            "epoch", "oracle_truth", "aggregate_pred", "btc_error", "athena_error",
            "outperformed", "collective_mis", "agent_count", "diversity_index", "bonus"
        ])
        prev_truth = None
        for i, epoch in enumerate(sorted(reports.keys())):
            r = reports[epoch]
            truth = fnum(r.get("oracleTruth"))
            aggregate = fnum(r.get("aggregatePrediction", truth))
            cmis = fnum(r.get("collectiveMIS", 0))
            agents = len(r.get("claims", []))
            bonus = "YES" if r.get("bonusTriggered", False) else "NO"
            diversity = 0
            if "claims" in r and isinstance(r["claims"], list):
                mis_values = [fnum(c.get("mis", 0)) for c in r["claims"] if fnum(c.get("mis", 0)) > 0]
                if mis_values:
                    diversity = collective_entropy(mis_values)

            if i == 0:
                btc_err = ath_err = 0
                outperf = "N/A"
            else:
                btc_err = abs(truth - prev_truth) / prev_truth if prev_truth > 0 else 0
                ath_err = abs(aggregate - truth) / truth if truth > 0 else 0
                outperf = "YES" if ath_err < btc_err else "NO"

            writer.writerow([
                epoch, round(truth, 2), round(aggregate, 2),
                round(btc_err, 6), round(ath_err, 6),
                outperf, round(cmis, 6), agents, round(diversity, 6), bonus
            ])
            prev_truth = truth

    print(f"📈 Exported benchmark_trend.csv → {TREND_CSV}")


# --------------------------- metrics export ------------------------
def export_metrics(results):
    """Create metrics.json for Athena UI dashboard."""
    metrics = {
        "version": results.get("version"),
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "epochsAnalyzed": results.get("epochs_analyzed"),
        "truthRate": round(results.get("avg_collective_mis", 0) * 100, 4),
        "truthPowerIndex": round(
            results.get("avg_collective_mis", 0) * 100
            * math.log10(results.get("avg_agent_count", 1) + 1), 2),
        "collectiveIntelligenceIndex": results.get("collective_intelligence_index"),
        "diversityIndex": results.get("avg_diversity_index"),
        "diversityStability": results.get("diversity_stability"),
        "avgAgentCount": results.get("avg_agent_count"),
        "errorReductionPct": results.get("error_reduction_pct"),
        "outperformanceRate": results.get("outperformance_rate"),
        "agentGrowthPct": results.get("agent_growth_pct"),
        "collectiveMisTrend": results.get("collective_mis_trend"),
        "collectiveMisTrendSmooth": results.get("collective_mis_trend_smooth"),
        "diversityTrend": results.get("diversity_trend"),
        "roiVsInitialPool": results.get("simulated_roi", {}).get("roi_vs_initial_pool"),
        "totalRewardsDistributed": results.get("simulated_roi", {}).get("total_rewards_distributed"),
    }

    with open(METRICS_PATH, "w") as f:
        json.dump(metrics, f, indent=2)
    print(f"📊 Exported metrics.json → {METRICS_PATH}")


# --------------------------- main ---------------------------------
def main():
    print("Athena Benchmark v2.6 — Intelligence & Diversity Index")
    print("=" * 70)
    reports = load_epoch_reports()
    if not reports:
        print(f"No epoch reports found in {OUT_DIR}/")
        return

    print(f"Loaded {len(reports)} epoch reports.")
    results = compute_benchmark(reports)
    if not results:
        return

    delta = results.get("collective_mis_delta", 0)
    trend = "improving" if delta > 0 else "declining"

    print(f"\n🧠 Collective accuracy is {trend} ({delta:+.4f})")
    print(f"Outperformance Rate: {results.get('outperformance_rate', 0)}%")
    print(f"Error Reduction: {results.get('error_reduction_pct', 0):+.2f}%")
    print(f"Diversity Index: {results.get('avg_diversity_index', 0):.3f}")
    print(f"Intelligence Index: {results.get('collective_intelligence_index', 0):.4f}")
    print(f"Avg Agents: {results.get('avg_agent_count', 0)} | Growth: {results.get('agent_growth_pct', 0):+.2f}%")

    BENCHMARK_REPORT.parent.mkdir(parents=True, exist_ok=True)
    with open(BENCHMARK_REPORT, "w") as f:
        json.dump(results, f, indent=2)
    print(f"Benchmark report → {BENCHMARK_REPORT}")

    export_trend_csv(reports)
    export_metrics(results)
    print("\nAthena is evolving — diversity and truth are aligning 🌌")


if __name__ == "__main__":
    main()
