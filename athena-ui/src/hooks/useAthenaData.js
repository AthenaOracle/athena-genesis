import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { parse } from "csv-parse/browser/esm";
import { format } from "date-fns";
import { sanitizeIpfsUrl } from "../utils/helpers";

/**
 * 🧠 useAthenaData — Unified Athena v2.2 data orchestrator
 * Fetches:
 * - Latest epoch report (from IPFS or local /out/)
 * - Benchmark analytics
 * - Ledger leaderboard
 * - Claim proofs (wallet-based)
 * - Oracle sources + reliability
 * - Collective stats + ROI + trends
 */

export default function useAthenaData(options = {}) {
  const { address } = useAccount();
  const {
    refetchInterval = 5 * 60 * 1000, // 5 min
    staleTime = 2 * 60 * 1000,
    enabled = true,
  } = options;

  // 1️⃣ Latest Epoch Report
  const latestEpoch = useQuery({
    queryKey: ["latest-epoch"],
    queryFn: async () => {
      try {
        // Try fetching the latest index of /out/
        const res = await fetch(sanitizeIpfsUrl("/out/"));
        const html = await res.text();
        const matches = html.match(/epoch_(\d+)_report\.json/g) || [];
        if (!matches.length) throw new Error("No epoch reports found.");
        const epochs = matches.map((m) => parseInt(m.match(/epoch_(\d+)/)[1]));
        const latest = Math.max(...epochs);
        const reportUrl = sanitizeIpfsUrl(`/out/epoch_${latest}_report.json`);
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
      const url = sanitizeIpfsUrl("/out/benchmark_report.json");
      const r = await fetch(url);
      if (!r.ok) throw new Error("Benchmark report unavailable.");
      return await r.json();
    },
    staleTime: 10 * 60 * 1000,
    enabled: enabled && !!latestEpoch.data,
  });

  // 3️⃣ Ledger Leaderboard
  const leaderboard = useQuery({
    queryKey: ["leaderboard"],
    queryFn: async () => {
      const res = await fetch(sanitizeIpfsUrl("/ledger.csv"));
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
        const res = await fetch(sanitizeIpfsUrl("/out/"));
        const html = await res.text();
        const matches = html.match(/epoch_(\d+)_report\.json/g) || [];
        return matches
          .map((m) => {
            const epoch = parseInt(m.match(/epoch_(\d+)/)[1]);
            return {
              epoch,
              url: sanitizeIpfsUrl(`/out/epoch_${epoch}_report.json`),
            };
          })
          .sort((a, b) => b.epoch - a.epoch);
      } catch {
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

      // Match proof by index, since proofs are stored index-keyed
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
    configVersion: latestEpoch.data?.configVersion || "2.0",
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
    version: latestEpoch.data?.configVersion || "2.2",
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
