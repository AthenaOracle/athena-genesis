// src/components/EpochHistory.jsx
import { useMemo, useState } from "react";
import { useEpochLog } from "../hooks/useAthenaData";
import { formatAtaAmount } from "../utils/format";
import { sanitizeIpfsUrl } from "../utils/helpers";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  ExternalLink,
  Calendar,
  TrendingUp,
  Clock,
  Search,
  ChevronDown,
  CheckCircle,
  Copy,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";

export default function EpochHistory() {
  const { data: log, isLoading } = useEpochLog();
  const [search, setSearch] = useState("");
  const [showChart, setShowChart] = useState(true);

  const epochs = useMemo(() => {
    if (!log?.epochs) return [];
    return Object.entries(log.epochs)
      .map(([id, data]) => ({
        id: Number(id),
        ...data,
        date: data.claimWindowEnd
          ? new Date(data.claimWindowEnd).toLocaleDateString()
          : "—",
        poolStr: formatAtaAmount(data.poolSize),
        ipfsUrl: sanitizeIpfsUrl(data.report),
      }))
      .filter((e) => e.id && e.poolSize > 0)
      .sort((a, b) => b.id - a.id);
  }, [log]);

  const filtered = useMemo(() => {
    if (!search) return epochs;
    const lower = search.toLowerCase();
    return epochs.filter(
      (e) =>
        e.id.toString().includes(lower) ||
        e.date.includes(lower) ||
        e.merkleRoot?.toLowerCase().includes(lower)
    );
  }, [epochs, search]);

  const chartData = useMemo(() => {
    return filtered.map((e) => ({
      epoch: e.id,
      pool: parseFloat(e.poolStr),
    }));
  }, [filtered]);

  if (isLoading) return <Skeleton />;
  if (!epochs.length) return <EmptyState />;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-600 bg-clip-text text-transparent">
          Epoch History
        </h2>
        <p className="text-sm text-gray-400 mt-2">
          {epochs.length} epochs •{" "}
          {formatAtaAmount(
            epochs.reduce((s, e) => s + e.poolSize, 0)
          )}{" "}
          ATA distributed
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="relative">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
          />
          <input
            type="text"
            placeholder="Search epoch, date, or root..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 pr-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-cyan-400 transition w-full sm:w-80"
          />
        </div>
        <button
          onClick={() => setShowChart(!showChart)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition text-sm font-medium"
        >
          <TrendingUp size={18} />
          {showChart ? "Hide" : "Show"} Pool Growth
          <ChevronDown
            size={16}
            className={`transition ${showChart ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {/* Chart */}
      <AnimatePresence>
        {showChart && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="glass p-6 rounded-2xl border border-white/10 overflow-hidden"
          >
            <ResponsiveContainer width="100%" height={280}>
              <LineChart
                data={chartData}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="4 4" stroke="#333" />
                <XAxis
                  dataKey="epoch"
                  tick={{ fill: "#ccc", fontSize: 12 }}
                  label={{
                    value: "Epoch",
                    position: "insideBottom",
                    offset: -5,
                  }}
                />
                <YAxis
                  tick={{ fill: "#ccc", fontSize: 12 }}
                  label={{
                    value: "Pool (ATA)",
                    angle: -90,
                    position: "insideLeft",
                  }}
                />
                <Tooltip
                  contentStyle={{
                    background: "#111",
                    border: "1px solid #444",
                    borderRadius: 12,
                  }}
                  labelStyle={{ color: "#fff" }}
                  formatter={(v) => `${v} ATA`}
                />
                <Line
                  type="monotone"
                  dataKey="pool"
                  stroke="#06b6d4"
                  strokeWidth={3}
                  dot={{ fill: "#06b6d4", r: 5 }}
                  activeDot={{ r: 7 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Epoch List */}
      <div className="space-y-3">
        {filtered.map((epoch, i) => (
          <motion.div
            key={epoch.id}
            initial={{ x: -30, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: i * 0.03 }}
            className="glass p-5 rounded-xl border border-white/10 hover:border-cyan-500/30 transition-all group"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Calendar size={18} className="text-cyan-400" />
                    <span className="font-mono font-bold text-lg">
                      Epoch {epoch.id}
                    </span>
                  </div>
                  <span className="text-sm text-gray-400">• {epoch.date}</span>
                </div>
                <div className="mt-2 space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">Pool:</span>
                    <span className="font-mono text-yellow-400">
                      {epoch.poolStr} ATA
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-xs text-gray-500 truncate">
                    <span>Root:</span>
                    <code className="bg-black/30 px-2 py-1 rounded">
                      {epoch.merkleRoot?.slice(0, 12)}...
                      {epoch.merkleRoot?.slice(-8)}
                    </code>
                    <CopyButton text={epoch.merkleRoot} />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {epoch.ipfsUrl && (
                  <a
                    href={epoch.ipfsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-400 rounded-xl text-sm font-medium transition"
                    onClick={() => toast.success("Opening IPFS report...")}
                  >
                    <ExternalLink size={16} />
                    View Report
                  </a>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {filtered.length === 0 && search && (
        <div className="text-center py-12 text-gray-500">
          No epochs found matching "{search}"
        </div>
      )}
    </div>
  );
}

// --- Helpers ---
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  if (!text) return null;
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text);
        setCopied(true);
        toast.success("Copied!");
        setTimeout(() => setCopied(false), 1500);
      }}
      className="opacity-0 group-hover:opacity-100 transition ml-1"
    >
      {copied ? (
        <CheckCircle size={14} className="text-green-400" />
      ) : (
        <Copy size={14} className="text-gray-500 hover:text-cyan-400" />
      )}
    </button>
  );
}

function Skeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-gray-800 rounded w-64 mx-auto"></div>
      {[...Array(4)].map((_, i) => (
        <div key={i} className="glass p-6 rounded-xl">
          <div className="h-6 bg-gray-700 rounded w-32"></div>
          <div className="mt-3 space-y-2">
            <div className="h-4 bg-gray-700 rounded w-48"></div>
            <div className="h-4 bg-gray-700 rounded w-64"></div>
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-16">
      <Clock size={48} className="mx-auto text-gray-600 mb-4" />
      <p className="text-gray-400">
        No epoch history yet. First epoch in progress.
      </p>
    </div>
  );
}
