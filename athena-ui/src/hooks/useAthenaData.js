import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { parse } from "csv-parse/browser/esm";
import { format } from "date-fns";

/**
 * 🧠 useAthenaData — Unified Athena v2.4 data orchestrator
 * Fetches:
 *  - Latest epoch report (from /Epoch Report/)
 *  - Benchmark analytics
 *  - Ledger leaderboard
 *  - Epoch log history
 *  - Claim proofs (wallet-based)
 *  - Oracle sources + reliability
 *  - Collective stats + ROI + trends
 */

export default function useAthenaData(options = {}) {
  const { address } = useAccount();
  const {
    refetchInterval = 5 * 60 * 1000, // 5 min
    staleTime = 2 * 60 * 1000,
    enabled = true,
  } = options;

  // ✅ Consistent base path for local + production
  const BASE_PATH =
    import.meta.env.MODE === "development"
      ? "/Epoch Report"
      : "https://raw.githubusercontent.com/AthenaOracle/athena-genesis/main/Epoch%20Report";

  // 1️⃣ Latest Epoch Report
  const latestEpoch = useQuery({
    queryKey: ["latest-epoch"],
    queryFn: async () => {
      try {
        const res = await fetch(`${BASE_PATH}/metrics.json`);
        if (!res.ok) throw new Error("Metrics not found");

        const metrics = await res.json();
        const latest =
          metrics.latest_epoch ?? metrics.latestEpoch ?? metrics.current ?? 0;

        const reportUrl = `${BASE_PATH}/epoch_${latest}_report.json`;
        const report = await fetch(reportUrl).then((r) => r.json());

        return { epoch: latest, url: reportUrl, ...report };
      } catch (err) {
        console.warn("[useAthenaData] Fallback to last-known epoch:", err);
        return null;
      }
    },
    staleTime,
    refetchInterval,
    enabled,
  });

  // 2️⃣ Benchmark Report
  const benchmark = useQuery({
    queryKey: ["benchmark"],
    queryFn: async () => {
      const url = `${BASE_PATH}/benchmark_report.json`;
      const r = await fetch(url);
      if (!r.ok) throw new Error("Benchmark report unavailable.");
      return await r.json();
    },
    staleTime: 10 * 60 * 1000,
    enabled: enabled && !!latestEpoch.data,
  });

  // 3️⃣ Leaderboard (from ledger.csv)
  const leaderboard = useQuery({
    queryKey: ["leaderboard"],
    queryFn: async () => {
      const res = await fetch("/ledger.csv");
      if (!res.ok) throw new Error("Ledger not found");
      const text = await res.text();

      return new Promise((resolve) => {
        parse(text, { columns: true }, (err, rows) => {
          if (err || !rows) return resolve([]);
          const valid = rows
            .filter(
              (r) =>
                r.reward_ata &&
                !isNaN(parseFloat(r.reward_ata)) &&
                parseFloat(r.reward_ata) > 0
            )
            .map((r) => ({
              ...r,
              reward: parseFloat(r.reward_ata),
              mis: parseFloat(r.mis) || 0,
            }))
            .sort((a, b) => b.reward - a.reward)
            .slice(0, 10);
          resolve(valid);
        });
      });
    },
    staleTime,
    enabled,
  });

  // 4️⃣ Epoch History
  const history = useQuery({
    queryKey: ["epoch-history"],
    queryFn: async () => {
      try {
        const res = await fetch(`${BASE_PATH}/metrics.json`);
        if (!res.ok) return [];
        const data = await res.json();
        const total =
          data.epochs_analyzed || data.latest_epoch || data.total_epochs || 0;

        const arr = [];
        for (let i = total - 1; i >= 0; i--) {
          arr.push({
            epoch: i,
            url: `${BASE_PATH}/epoch_${i}_report.json`,
          });
        }
        return arr;
      } catch (err) {
        console.warn("⚠️ Epoch history load failed:", err);
        return [];
      }
    },
    staleTime: 30 * 60 * 1000,
    enabled,
  });

  // 5️⃣ Wallet Claim Status
  const claimStatus = useQuery({
    queryKey: ["claim-status", address, latestEpoch.data?.epoch],
    queryFn: async () => {
      if (!address || !latestEpoch.data) return null;
      const claim = latestEpoch.data.claims?.find(
        (c) => c.wallet?.toLowerCase() === address.toLowerCase()
      );
      if (!claim) return null;

      const idx = latestEpoch.data.claims.indexOf(claim);
      const proofArr = latestEpoch.data.proofs?.[String(idx)] || [];

      return { ...claim, proof: proofArr, epoch: latestEpoch.data.epoch };
    },
    enabled: !!address && !!latestEpoch.data,
    staleTime,
  });

  // 6️⃣ Derived / Aggregate Data
  const oracleSources =
    latestEpoch.data?.oracleSources ||
    benchmark.data?.oracle_sources_used ||
    [];

  const collective = {
    mis: latestEpoch.data?.collectiveMIS || 0,
    aggregate: latestEpoch.data?.aggregatePrediction || 0,
    truth: latestEpoch.data?.oracleTruth || 0,
    bonus: latestEpoch.data?.bonusTriggered || false,
    difficulty: latestEpoch.data?.epochDifficulty || 0.9,
    agentCount: latestEpoch.data?.agentCount || 0,
    configVersion: latestEpoch.data?.configVersion || "2.4",
  };

  const roi = benchmark.data?.simulated_roi || {};

  // 7️⃣ State Management
  const isLoading = [latestEpoch, benchmark, leaderboard, history].some(
    (q) => q.isLoading
  );

  const error = [
    latestEpoch,
    benchmark,
    leaderboard,
    history,
    claimStatus,
  ].find((q) => q.error)?.error;

  const refetchAll = () => {
    [latestEpoch, benchmark, leaderboard, history, claimStatus].forEach((q) =>
      q.refetch?.()
    );
  };

  // 8️⃣ Meta Summary
  const meta = {
    latestEpoch: latestEpoch.data?.epoch || 0,
    version: latestEpoch.data?.configVersion || "2.4",
    lastUpdated: new Date().toISOString(),
    sources: oracleSources.length,
  };

  return {
    // Core Data
    epoch: latestEpoch.data,
    benchmark: benchmark.data,
    leaderboard: leaderboard.data,
    history: history.data,
    claim: claimStatus.data,

    // Derived Data
    oracleSources,
    collective,
    roi,
    meta,

    // State
    isLoading,
    error,
    refetchAll,

    // Utilities
    formatMIS: (mis) => (mis * 100).toFixed(2) + "%",
    formatUSD: (val) =>
      `$${parseFloat(val).toLocaleString(undefined, {
        minimumFractionDigits: 2,
      })}`,
    formatDate: (date) => format(new Date(date), "MMM dd, yyyy"),
  };
}

// ---------------------------------------------------------------------------
// 🔹 useEpochLog — Lightweight hook for epoch log explorer
// ---------------------------------------------------------------------------
export function useEpochLog() {
  const BASE_PATH =
    import.meta.env.MODE === "development"
      ? "/Epoch Report"
      : "https://raw.githubusercontent.com/AthenaOracle/athena-genesis/main/Epoch%20Report";

  return useQuery({
    queryKey: ["epoch-log"],
    queryFn: async () => {
      try {
        const res = await fetch(`${BASE_PATH}/epoch_log.json`);
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data)
          ? data.sort((a, b) => b.epoch - a.epoch)
          : [];
      } catch (err) {
        console.warn("⚠️ useEpochLog fallback:", err);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000,
  });
}
