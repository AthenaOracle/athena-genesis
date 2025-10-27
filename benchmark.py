#!/usr/bin/env python3
# benchmark.py — Athena Collective vs BTC Benchmark v2.3
# Compares MIS-weighted aggregate predictions against actual BTC price changes
# Outputs: outperformance, error reduction, simulated ROI, trend analysis, metrics.json

import json, csv, statistics, math
from typing import List, Dict
from pathlib import Path
from datetime import datetime

# ---------------------------- config --------------------------------
OUT_DIR = Path("Epoch Report")
LEDGER_PATH = Path("ledger.csv")
BENCHMARK_REPORT = OUT_DIR / "benchmark_report.json"
TREND_CSV = OUT_DIR / "benchmark_trend.csv"
METRICS_PATH = OUT_DIR / "metrics.json"

# --------------------------- loaders -------------------------------
def load_epoch_reports() -> Dict[int, Dict]:
    """Load and sort all epoch reports from OUT_DIR"""
    reports: Dict[int, Dict] = {}
    for file in OUT_DIR.glob("epoch_*_report.json"):
        if "report" not in file.name:
            continue
        try:
            epoch = int(file.name.split("_")[1])
            with open(file, "r") as f:
                report = json.load(f)
                reports[epoch] = report
        except (ValueError, json.JSONDecodeError, IndexError) as e:
            print(f"[WARN] Failed to parse {file}: {e}")
    return dict(sorted(reports.items()))

def load_ledger() -> List[Dict]:
    """Load full ledger with all agent reward rows"""
    if not LEDGER_PATH.exists():
        print(f"[ERROR] Ledger not found: {LEDGER_PATH}")
        return []
    with open(LEDGER_PATH, "r", newline="") as f:
        reader = list(csv.DictReader(f))
        if not reader:
            print("[WARN] Ledger is empty.")
        return reader

# --------------------------- core logic ---------------------------
def compute_benchmark(reports: Dict[int, Dict]) -> Dict:
    """Compute full benchmark metrics across epochs"""
    epochs = sorted(reports.keys())
    if len(epochs) < 2:
        print("Need at least 2 epochs for benchmark.")
        return {}

    results = {
        "version": "2.3",
        "configVersion": reports[epochs[0]].get("configVersion", "1.0"),
        "epochs_analyzed": len(epochs),
        "epoch_range": [epochs[0], epochs[-1]],
        "agent_count_trend": [],
        "btc_hold_errors": [],
        "athena_errors": [],
        "outperformance_count": 0,
        "total_bonus_triggered": 0,
        "collective_mis_trend": [],
        "oracle_sources_used": set(),
        "simulated_roi": {}
    }

    prev_truth = None
    for epoch in epochs:
        r = reports[epoch]
        truth = float(r["oracleTruth"])
        aggregate = float(r.get("aggregatePrediction", truth))
        collective_mis = float(r.get("collectiveMIS", 0))
        bonus = r.get("bonusTriggered", False)
        agent_count = len(r.get("claims", []))
        difficulty = float(r.get("epochDifficulty", 0.9))

        results["agent_count_trend"].append(agent_count)
        if "oracleSources" in r:
            results["oracle_sources_used"].update(r["oracleSources"])

        if prev_truth is not None:
            btc_error = abs(truth - prev_truth) / prev_truth if prev_truth > 0 else 0
            athena_error = abs(aggregate - truth) / truth if truth > 0 else 0
            results["btc_hold_errors"].append(btc_error)
            results["athena_errors"].append(athena_error)
            results["collective_mis_trend"].append(collective_mis)
            if athena_error < btc_error:
                results["outperformance_count"] += 1
            if bonus:
                results["total_bonus_triggered"] += 1
        prev_truth = truth

    if results["btc_hold_errors"]:
        avg_btc_err = statistics.mean(results["btc_hold_errors"])
        avg_ath_err = statistics.mean(results["athena_errors"])
        results["avg_btc_error"] = round(avg_btc_err, 6)
        results["avg_athena_error"] = round(avg_ath_err, 6)
        results["error_reduction_pct"] = round((1 - avg_ath_err / avg_btc_err) * 100, 2) if avg_btc_err > 0 else 0
        results["outperformance_rate"] = round(results["outperformance_count"] / len(results["btc_hold_errors"]) * 100, 2)

    if results["collective_mis_trend"]:
        results["avg_collective_mis"] = round(statistics.mean(results["collective_mis_trend"]), 6)
        if len(results["collective_mis_trend"]) > 1:
            delta = results["collective_mis_trend"][-1] - results["collective_mis_trend"][0]
            results["collective_mis_delta"] = round(delta, 6)

    if results["agent_count_trend"]:
        results["avg_agent_count"] = round(statistics.mean(results["agent_count_trend"]), 1)
        if len(results["agent_count_trend"]) > 1:
            growth = (results["agent_count_trend"][-1] / results["agent_count_trend"][0] - 1) * 100
            results["agent_growth_pct"] = round(growth, 2)

    ledger = load_ledger()
    total_rewards = sum(float(row["reward_ata"]) for row in ledger if row.get("reward_ata", "").replace(".", "").isdigit())
    first_pool = float(reports[epochs[0]].get("pool", 190000))
    if first_pool > 0:
        results["simulated_roi"] = {
            "total_rewards_distributed": round(total_rewards, 2),
            "initial_pool": round(first_pool, 2),
            "roi_vs_initial_pool": round((total_rewards / first_pool - 1) * 100, 2),
            "avg_reward_per_epoch": round(total_rewards / len(epochs), 2)
        }

    results["oracle_sources_used"] = sorted(list(results["oracle_sources_used"]))
    results["latest_epoch"] = epochs[-1]
    return results

# --------------------------- output --------------------------------
def export_trend_csv(reports: Dict[int, Dict]):
    with open(TREND_CSV, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow([
            "epoch", "oracle_truth", "aggregate_pred", "btc_error", "athena_error",
            "outperformed", "collective_mis", "agent_count", "difficulty", "bonus"
        ])
        prev_truth = None
        for i, epoch in enumerate(sorted(reports.keys())):
            r = reports[epoch]
            truth = float(r["oracleTruth"])
            aggregate = float(r.get("aggregatePrediction", truth))
            cmis = float(r.get("collectiveMIS", 0))
            agents = len(r.get("claims", []))
            difficulty = float(r.get("epochDifficulty", 0.9))
            bonus = "YES" if r.get("bonusTriggered", False) else "NO"

            if i == 0:
                btc_err = ath_err = 0
                outperformed = "N/A"
            else:
                btc_err = abs(truth - prev_truth) / prev_truth if prev_truth > 0 else 0
                ath_err = abs(aggregate - truth) / truth if truth > 0 else 0
                outperformed = "YES" if ath_err < btc_err else "NO"

            writer.writerow([
                epoch, round(truth, 2), round(aggregate, 2),
                round(btc_err, 6), round(ath_err, 6),
                outperformed, round(cmis, 6), agents, round(difficulty, 3), bonus
            ])
            prev_truth = truth

# --------------------------- metrics export ------------------------
def export_metrics(results, out_dir="out"):
    """Generate metrics.json for frontend dashboard"""
    out = Path(out_dir)
    out.mkdir(exist_ok=True)

    truth_rate = round(results.get("avg_collective_mis", 0) * 100, 4)
    truth_power = round(truth_rate * math.log10(results.get("avg_agent_count", 1) + 1), 2)

    metrics = {
        "version": "2.3",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "epochs_analyzed": results.get("epochs_analyzed"),
        "latest_epoch": results.get("latest_epoch"),
        "truthRate": truth_rate,
        "truthPowerIndex": truth_power,
        "avgCollectiveMIS": results.get("avg_collective_mis"),
        "avgAgentCount": results.get("avg_agent_count"),
        "agentGrowthPct": results.get("agent_growth_pct"),
        "errorReductionPct": results.get("error_reduction_pct"),
        "outperformanceRate": results.get("outperformance_rate"),
        "totalRewardsDistributed": results.get("simulated_roi", {}).get("total_rewards_distributed"),
        "roiVsInitialPool": results.get("simulated_roi", {}).get("roi_vs_initial_pool"),
        "oracleSourcesUsed": results.get("oracle_sources_used"),
        "collectiveMisTrend": results.get("collective_mis_trend", []),
        "truthRateTrend": [round(x * 100, 4) for x in results.get("collective_mis_trend", [])],
        "truthPowerTrend": [
            round((x * 100) * math.log10(a + 1), 2)
            for x, a in zip(
                results.get("collective_mis_trend", []),
                results.get("agent_count_trend", []),
            )
        ],
    }

    with open(METRICS_PATH, "w") as f:
        json.dump(metrics, f, indent=2)

    print(f"📊 Exported metrics.json → {METRICS_PATH}")

# --------------------------- main ---------------------------------
def main():
    print("Athena Collective vs BTC Benchmark v2.3")
    print("=" * 60)

    reports = load_epoch_reports()
    if not reports:
        print(f"No reports found in {OUT_DIR}/")
        return

    print(f"Loaded {len(reports)} epoch reports.")
    results = compute_benchmark(reports)
    if not results:
        return

    print(f"\nEpoch Range: {results['epoch_range'][0]} → {results['epoch_range'][1]}")
    print(f"Agents (avg): {results.get('avg_agent_count', 0):.1f} | Growth: {results.get('agent_growth_pct', 0):+.2f}%")
    print(f"Outperformance Rate: {results.get('outperformance_rate', 0)}%")
    print(f"Avg BTC Error: {results.get('avg_btc_error', 0):.6f}")
    print(f"Avg Athena Error: {results.get('avg_athena_error', 0):.6f}")
    print(f"Error Reduction: {results.get('error_reduction_pct', 0):+.2f}%")
    print(f"Bonus Triggered: {results['total_bonus_triggered']} times")
    print(f"Avg Collective MIS: {results.get('avg_collective_mis', 0):.6f} | Δ: {results.get('collective_mis_delta', 0):+.6f}")
    print(f"Oracle Sources: {', '.join(results['oracle_sources_used']) or 'N/A'}")

    BENCHMARK_REPORT.parent.mkdir(parents=True, exist_ok=True)
    with open(BENCHMARK_REPORT, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\nBenchmark report → {BENCHMARK_REPORT}")

    export_trend_csv(reports)
    print(f"Trend CSV → {TREND_CSV}")

    export_metrics(results)  # 🆕 Creates metrics.json
    print("\nAthena is learning. The collective is winning.")

if __name__ == "__main__":
    main()
