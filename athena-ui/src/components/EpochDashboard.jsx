// src/components/EpochDashboard.jsx
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Gauge, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "../context/WalletContext";
import useAthenaData from "../hooks/useAthenaData";

/* ---------- Helpers ---------- */
function formatNumber(n, opts = {}) {
  if (n === undefined || n === null || Number.isNaN(n)) return "—";
  try {
    return new Intl.NumberFormat(undefined, {
      maximumFractionDigits: 2,
      ...opts,
    }).format(n);
  } catch {
    return String(n);
  }
}
function formatPct(v) {
  if (v === undefined || v === null || Number.isNaN(v)) return "—";
  return `${(v * 100).toFixed(2)}%`;
}
function useElapsedSince(dateInput) {
  const ts = useMemo(
    () => (dateInput ? new Date(dateInput).getTime() : null),
    [dateInput]
  );
  const [elapsed, setElapsed] = useState(() => (ts ? Date.now() - ts : 0));
  useEffect(() => {
    if (!ts) return;
    const t = setInterval(() => setElapsed(Date.now() - ts), 1000);
    return () => clearInterval(t);
  }, [ts]);
  return Math.max(elapsed, 0);
}

/* ---------- Main ---------- */
export default function EpochDashboard() {
  const navigate = useNavigate();
  const { account } = useWallet();
  const {
    epoch,
    collective,
    meta = {},
    isLoading,
    error,
  } = useAthenaData();

  const elapsedMs = useElapsedSince(meta?.lastUpdated);
  const predictionCount = 3; // mock for now

  const epochNumber = epoch?.epoch ?? meta?.latestEpoch ?? "—";
  const oracleTruth = Number(epoch?.oracleTruth ?? 0);
  const pool = Number(epoch?.pool ?? 0);
  const agentCount = collective?.agentCount ?? 3;
  const mis = typeof collective?.mis === "number" ? collective.mis : null;

  if (isLoading) return <DashboardSkeleton />;
  if (error || !epoch)
    return <ErrorState message="Failed to load epoch data. Retrying..." />;

  return (
    <div className="flex justify-center py-1">
      <div className="relative w-full max-w-4xl text-center text-white py-12 px-10 rounded-2xl border border-yellow-500/30 backdrop-blur-md shadow-[0_0_25px_rgba(255,215,0,0.1)] space-y-6">

        {/* Glowing gold border effect */}
        <div className="absolute inset-0 rounded-2xl border border-yellow-400/30 pointer-events-none"></div>

        {/* EPOCH Number */}
        <h2 className="text-3x2 md:text-4xl font-semibold tracking-tight text-yellow-400/90">
          EPOCH {epochNumber}
        </h2>

        {/* LIVE + Agents line */}
        <div className="flex flex-col items-center space-y-2 mt-2">
          <span className="px-5 py-1 bg-green-500/20 border border-green-400 text-green-400 font-semibold text-xs rounded-md shadow-md tracking-wide animate-pulse">
            LIVE
          </span>
          <p className="text-sm text-white font-medium">
            {agentCount} Agents • Synced {Math.floor(elapsedMs / 1000)}s ago • Total Predictions: {predictionCount}
          </p>
        </div>

        {/* Oracle Truth */}
        <div className="mt-8 space-y-1">
          <p className="text-sm text-white uppercase tracking-wider">
            Oracle Truth (BTC/USD)
          </p>
          <motion.p
            key={oracleTruth}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="text-4xl font-bold bg-gradient-to-r from-yellow-400 to-amber-500 bg-clip-text text-transparent"
          >
            ${formatNumber(oracleTruth, { maximumFractionDigits: 2 })}
          </motion.p>
        </div>

        {/* Collective MIS */}
        <div className="mt-4">
          <p className="text-sm text-white">
            Collective MIS:{" "}
            {mis !== null ? (
              <span className="text-yellow-400 font-mono">{formatPct(mis)}</span>
            ) : (
              "—"
            )}
          </p>
        </div>

        {/* Reward Pool */}
        <div className="mt-8 space-y-1">
          <p className="text-sm text-white uppercase tracking-wider">Reward Pool</p>
          <p className="text-3xl font-bold bg-gradient-to-r from-yellow-400 to-amber-500 bg-clip-text text-transparent">
            {formatNumber(pool)} $ATA
          </p>
        </div>

        {/* Top Agent */}
        <div className="mt-8 space-y-1">
          <p className="text-sm text-white uppercase tracking-wider">Top Agent</p>
          <p className="text-sm text-yellow-400 font-mono">
            0xabc...1234 — 0.025 $ATA
          </p>
        </div>

        {/* Earn Now Button */}
        <div className="pt-10">
          <button
            onClick={() => navigate("/predict")}
            className="px-10 py-3 bg-gradient-to-r from-yellow-500 to-amber-500 text-black font-semibold rounded-xl hover:from-yellow-400 hover:to-amber-400 transition shadow-lg"
          >
            EARN NOW
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Skeleton ---------- */
function DashboardSkeleton() {
  return (
    <div className="flex flex-col items-center py-20 animate-pulse space-y-8">
      <div className="h-8 bg-gray-800 rounded w-40"></div>
      <div className="h-6 bg-gray-700 rounded w-72"></div>
      <div className="h-10 bg-gray-800 rounded w-48"></div>
    </div>
  );
}

/* ---------- Error ---------- */
function ErrorState({ message }) {
  return (
    <div className="text-center p-8">
      <AlertCircle size={48} className="mx-auto text-red-400 mb-4" />
      <p className="text-red-400">{message}</p>
      <p className="text-xs text-gray-500 mt-2">Check GitHub repo or IPFS gateway.</p>
    </div>
  );
}
