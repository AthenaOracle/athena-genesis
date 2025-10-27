import { useEffect, useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Copy,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Database,
  Users,
  Network,
  Activity,
  RefreshCw,
  Timer,
  Gauge,
} from "lucide-react";
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, AreaChart, Area } from "recharts";
import { useWallet } from "../context/WalletContext";
import useAthenaData from "../hooks/useAthenaData";
import { sanitizeIpfsUrl } from "../utils/helpers";

/**
 * Small time utilities
 */
function formatNumber(n, opts = {}) {
  if (n === undefined || n === null || Number.isNaN(n)) return "—";
  try {
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2, ...opts }).format(n);
  } catch {
    return String(n);
  }
}

function formatPct(v) {
  if (v === undefined || v === null || Number.isNaN(v)) return "—";
  return `${(v * 100).toFixed(2)}%`;
}

function formatCountdown(ms) {
  if (!ms || ms < 0) return "00:00:00";
  const total = Math.floor(ms / 1000);
  const h = String(Math.floor(total / 3600)).padStart(2, "0");
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function useElapsedSince(dateInput) {
  const ts = useMemo(() => (dateInput ? new Date(dateInput).getTime() : null), [dateInput]);
  const [elapsed, setElapsed] = useState(() => (ts ? Date.now() - ts : 0));
  useEffect(() => {
    if (!ts) return;
    const t = setInterval(() => setElapsed(Date.now() - ts), 1000);
    return () => clearInterval(t);
  }, [ts]);
  return Math.max(elapsed, 0);
}

function useCountdown(targetTs) {
  const [remaining, setRemaining] = useState(() => (targetTs ? targetTs - Date.now() : 0));
  useEffect(() => {
    if (!targetTs) return;
    const t = setInterval(() => setRemaining(targetTs - Date.now()), 1000);
    return () => clearInterval(t);
  }, [targetTs]);
  return Math.max(remaining, 0);
}

/**
 * Attempts multiple IPFS gateways; returns the first that responds 200 to HEAD/GET
 */
async function ipfsWithFallback(ipfsUrl) {
  if (!ipfsUrl) return null;
  const gateways = [
    "https://ipfs.io/ipfs/",
    "https://cloudflare-ipfs.com/ipfs/",
    "https://gateway.pinata.cloud/ipfs/",
  ];
  const path = ipfsUrl.startsWith("ipfs://") ? ipfsUrl.replace("ipfs://", "") : ipfsUrl.replace(/^https?:\/\/[^/]*\/ipfs\//, "");
  for (const gw of gateways) {
    const url = `${gw}${path}`;
    try {
      const res = await fetch(url, { method: "HEAD" });
      if (res.ok) return url;
    } catch (_) { /* ignore */ }
  }
  // fallback to sanitize helper (single gateway)
  return sanitizeIpfsUrl(ipfsUrl);
}

export default function EpochDashboard() {
  const { account } = useWallet();

  // NOTE: Assuming useAthenaData exposes these. If not, the component
  // gracefully handles missing fields via optional chaining and sensible defaults.
  const {
    epoch,
    collective,
    oracleSources = [],
    meta = {},
    history = [], // array of { epoch, pool, oraclePrice, ... }
    isLoading,
    isFetching, // optional: show syncing state
    error,
    refetch, // optional: manual refresh
  } = useAthenaData();

  const [copied, setCopied] = useState(false);
  const [ipfsHref, setIpfsHref] = useState(null);

  const copyMerkle = () => {
    if (!epoch?.merkleRoot) return;
    navigator.clipboard.writeText(epoch.merkleRoot);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  // Resolve best IPFS link with fallback when epoch changes
  useEffect(() => {
    let abort = false;
    (async () => {
      if (!epoch?.ipfsReport) { setIpfsHref(null); return; }
      const url = await ipfsWithFallback(epoch.ipfsReport);
      if (!abort) setIpfsHref(url);
    })();
    return () => { abort = true; };
  }, [epoch?.ipfsReport]);

  // "Synced Xs ago" timer based on meta.lastUpdated
  const elapsedMs = useElapsedSince(meta?.lastUpdated);

  // Next epoch countdown: prefer explicit field, else derive if possible
  const nextEpochTs = useMemo(() => {
    const explicit = meta?.nextEpochStart || epoch?.nextEpochStart;
    if (explicit) return new Date(explicit).getTime();
    // Derive from end + duration if available
    const end = epoch?.claimWindowEnd || epoch?.epochEnd || meta?.epochEnd;
    const dur = meta?.epochDurationMs || (epoch?.epochDurationSec ? epoch.epochDurationSec * 1000 : null);
    if (end && dur) return new Date(end).getTime() + dur;
    return null;
  }, [meta?.nextEpochStart, epoch?.nextEpochStart, epoch?.claimWindowEnd, epoch?.epochEnd, meta?.epochEnd, meta?.epochDurationMs, epoch?.epochDurationSec]);
  const countdownMs = useCountdown(nextEpochTs);

  // Claim window progress if we have a start/end
  const claimStart = useMemo(() => (epoch?.claimWindowStart ? new Date(epoch.claimWindowStart).getTime() : null), [epoch?.claimWindowStart]);
  const claimEnd = useMemo(() => (epoch?.claimWindowEnd ? new Date(epoch.claimWindowEnd).getTime() : null), [epoch?.claimWindowEnd]);
  const claimTotal = claimStart && claimEnd ? Math.max(claimEnd - claimStart, 0) : null;
  const claimElapsed = claimStart ? Math.max(Math.min(Date.now() - claimStart, claimTotal ?? 0), 0) : null;
  const claimPct = claimTotal ? (claimElapsed / claimTotal) : null;

  const epochNumber = epoch?.epoch ?? meta?.latestEpoch ?? "—";
  const oracleTruth = Number(epoch?.oracleTruth ?? 0);
  const pool = Number(epoch?.pool ?? 0);
  const merkleRoot = epoch?.merkleRoot ?? "—";
  const agentCount = collective?.agentCount ?? 0;
  const version = collective?.configVersion ?? "2.2";
  const mis = typeof collective?.mis === "number" ? collective.mis : null;

  const totalEligible = epoch?.totalEligible ?? epoch?.eligibleWallets?.length ?? null;
  const totalClaims = Array.isArray(epoch?.claims) ? epoch.claims.length : null;
  const claimedPct = totalEligible && totalEligible > 0 && totalClaims !== null ? totalClaims / totalEligible : null;

  const onManualRefresh = useCallback(async () => {
    try {
      if (typeof refetch === "function") await refetch();
      else window.location.reload(); // conservative fallback
    } catch (_) {
      // ignore
    }
  }, [refetch]);

  if (isLoading) return <DashboardSkeleton />;
  if (error || !epoch)
    return <ErrorState message="Failed to load epoch data. Retrying..." />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-1">
          <h2 className="text-3xl font-bold bg-gradient-to-r from-yellow-400 to-amber-600 bg-clip-text text-transparent flex items-center justify-center gap-3">
            Epoch {epochNumber}
          </h2>
          <StatusBadge isFetching={!!isFetching} error={!!error} />
        </div>
        <div className="flex items-center justify-center gap-3 text-xs text-gray-400">
          <span>Config v{version}</span>
          <span>•</span>
          <span>{agentCount} Agents</span>
          <span>•</span>
          <span>{oracleSources.length} Sources</span>
          <span>•</span>
          <span className="inline-flex items-center gap-1"><Activity size={12} />{isFetching ? "Syncing…" : `Synced ${Math.floor(elapsedMs/1000)}s ago`}</span>
          <button onClick={onManualRefresh} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 border border-white/10 transition" title="Refresh now">
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
      </div>

      {/* Main Card */}
      <div className="glass p-6 md:p-8 rounded-2xl border border-white/10 space-y-8">
        <div className="grid md:grid-cols-2 gap-8">
          {/* Left: Oracle & Pool Info */}
          <div className="space-y-5">
            {/* Oracle Truth */}
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wider flex items-center gap-1">
                <Gauge size={14} /> Oracle Truth (BTC/USD)
              </label>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.p
                  key={oracleTruth}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.25 }}
                  className="text-2xl font-bold text-green-400 mt-1"
                >
                  ${formatNumber(oracleTruth, { maximumFractionDigits: 2 })}
                </motion.p>
              </AnimatePresence>
              <p className="text-xs text-gray-500 mt-1">
                Collective MIS: {mis !== null ? (
                  <span className="text-yellow-400 font-mono">{formatPct(mis)}</span>
                ) : (
                  <span className="text-gray-500">—</span>
                )}
              </p>
            </div>

            {/* Pool Size */}
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wider">Reward Pool</label>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.p
                  key={pool}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.25 }}
                  className="text-2xl font-bold text-yellow-400 mt-1"
                >
                  {formatNumber(pool)} ATA
                </motion.p>
              </AnimatePresence>
              {totalEligible !== null && totalClaims !== null && (
                <p className="text-xs text-gray-500 mt-1">
                  Claims: <span className="text-green-400 font-semibold">{totalClaims}/{totalEligible}</span>
                  {claimedPct !== null && (
                    <> (<span className="font-mono">{(claimedPct * 100).toFixed(1)}%</span>)</>
                  )}
                </p>
              )}
            </div>

            {/* Merkle Root */}
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wider">Merkle Root</label>
              <div className="flex items-center gap-2 mt-1">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.code
                    key={merkleRoot}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="font-mono text-sm bg-black/30 px-3 py-2 rounded-lg flex-1 truncate"
                  >
                    {merkleRoot}
                  </motion.code>
                </AnimatePresence>
                <button
                  onClick={copyMerkle}
                  disabled={!epoch?.merkleRoot}
                  aria-label="Copy Merkle Root"
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition"
                  title="Copy Merkle Root"
                >
                  {copied ? (
                    <CheckCircle size={18} className="text-green-400" />
                  ) : (
                    <Copy size={18} />
                  )}
                </button>
              </div>
            </div>

            {/* Claim Window Progress */}
            {claimTotal && (
              <div className="space-y-1">
                <label className="text-xs text-gray-400 uppercase tracking-wider flex items-center gap-1"><Timer size={14} /> Claim Window</label>
                <div className="relative w-full h-2 bg-gray-700/60 rounded overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(Math.max(claimPct ?? 0, 0), 1) * 100}%` }}
                    transition={{ type: "tween", duration: 0.4 }}
                    className="absolute left-0 top-0 h-full bg-green-500/80"
                    style={{ boxShadow: "0 0 12px rgba(34,197,94,0.5)" }}
                  />
                </div>
                <div className="text-xs text-gray-500 flex justify-between">
                  <span>Start: {claimStart ? new Date(claimStart).toLocaleString() : "—"}</span>
                  <span>End: {claimEnd ? new Date(claimEnd).toLocaleString() : "—"}</span>
                </div>
              </div>
            )}
          </div>

          {/* Right: Sources, Timeline & Report */}
          <div className="space-y-5">
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wider flex items-center gap-1">
                <Network size={14} /> Oracle Sources
              </label>
              <ul className="mt-2 space-y-1 text-sm text-gray-300 font-mono max-h-28 overflow-auto pr-1">
                {oracleSources.length > 0 ? (
                  oracleSources.map((src) => (
                    <li key={src} className="truncate">• {src}</li>
                  ))
                ) : (
                  <li className="text-gray-500 italic">No sources found</li>
                )}
              </ul>
            </div>

            {/* Epoch Timeline Mini Chart */}
            {Array.isArray(history) && history.length > 0 && (
              <div className="rounded-xl border border-white/10 p-3 bg-black/20">
                <label className="text-xs text-gray-400 uppercase tracking-wider">Epoch Evolution</label>
                <div className="h-28">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={history.slice(-10)} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="poolGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#facc15" stopOpacity={0.5} />
                          <stop offset="100%" stopColor="#facc15" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#4ade80" stopOpacity={0.5} />
                          <stop offset="100%" stopColor="#4ade80" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
                      <XAxis dataKey="epoch" tick={{ fontSize: 10 }} strokeOpacity={0.5} />
                      <YAxis hide />
                      <Tooltip
                        contentStyle={{ background: "rgba(0,0,0,0.7)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }}
                        labelStyle={{ color: "#ddd" }}
                        formatter={(val, key) => [formatNumber(val), key === "pool" ? "Pool (ATA)" : "Price"]}
                      />
                      <Area type="monotone" dataKey="pool" stroke="#facc15" fill="url(#poolGrad)" strokeWidth={2} />
                      <Area type="monotone" dataKey="oraclePrice" stroke="#4ade80" fill="url(#priceGrad)" strokeWidth={1.5} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Report Link */}
            {ipfsHref && (
              <a
                href={ipfsHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition"
              >
                View Full Report on IPFS
                <ExternalLink size={14} />
              </a>
            )}
          </div>
        </div>

        {/* Diagnostics Footer */}
        <div className="pt-4 border-t border-white/10 text-xs text-gray-500 text-center flex flex-wrap items-center justify-center gap-3">
          <span className="flex items-center gap-1"><Database size={12} /> v{version}</span>
          <span>|</span>
          <span>Last Updated: {meta?.lastUpdated ? new Date(meta.lastUpdated).toLocaleString() : "—"}</span>
          <span>|</span>
          <span>Epoch {epochNumber}</span>
          {nextEpochTs && (
            <>
              <span>|</span>
              <span className="inline-flex items-center gap-1"><Timer size={12} /> Next epoch in {formatCountdown(countdownMs)}</span>
            </>
          )}
        </div>
      </div>

      {!account && (
        <div className="text-center text-sm text-gray-400">
          Wallet not connected • {" "}
          <span className="text-yellow-400">Explore freely</span>
        </div>
      )}
    </div>
  );
}

/** Status badge (LIVE / SYNCING / ERROR) */
function StatusBadge({ isFetching, error }) {
  const state = error ? "error" : isFetching ? "sync" : "live";
  const styles = {
    live: "bg-green-500/15 text-green-400 border-green-400/30",
    sync: "bg-yellow-500/15 text-yellow-300 border-yellow-300/30 animate-pulse",
    error: "bg-red-500/15 text-red-400 border-red-400/30",
  };
  const label = state === "live" ? "LIVE" : state === "sync" ? "SYNCING" : "ERROR";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border ${styles[state]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${state === "live" ? "bg-green-400" : state === "sync" ? "bg-yellow-300" : "bg-red-400"}`} />
      {label}
    </span>
  );
}

// Skeleton Loader
function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-gray-800 rounded w-48 mx-auto"></div>
      <div className="glass p-8 rounded-2xl">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-6">
            <div className="h-4 bg-gray-700 rounded w-32"></div>
            <div className="h-10 bg-gray-800 rounded"></div>
            <div className="h-4 bg-gray-700 rounded w-24"></div>
            <div className="h-8 bg-gray-800 rounded"></div>
          </div>
          <div className="space-y-6">
            <div className="h-4 bg-gray-700 rounded w-32"></div>
            <div className="h-16 bg-gray-800 rounded-xl"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Error State
function ErrorState({ message }) {
  return (
    <div className="glass p-8 rounded-2xl text-center">
      <AlertCircle size={48} className="mx-auto text-red-400 mb-4" />
      <p className="text-red-400">{message}</p>
      <p className="text-xs text-gray-500 mt-2">Check GitHub repo or IPFS gateway</p>
    </div>
  );
}
