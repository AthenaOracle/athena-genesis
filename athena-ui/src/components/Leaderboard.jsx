import { useState, useMemo } from "react";
import useAthenaData from "../hooks/useAthenaData";
import { useEnsName } from "../hooks/useEnsName";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import {
  Trophy,
  Medal,
  Crown,
  Search,
  Copy,
  Sparkles,
  CheckCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { formatNumber } from "../utils/helpers";

const MEDALS = [
  { icon: Crown, color: "text-yellow-400", glow: "shadow-yellow-400/50" },
  { icon: Medal, color: "text-gray-300", glow: "shadow-gray-300/50" },
  { icon: Medal, color: "text-orange-600", glow: "shadow-orange-600/50" },
  { icon: Trophy, color: "text-yellow-600", glow: "shadow-yellow-600/40" },
  { icon: Trophy, color: "text-gray-600", glow: "shadow-gray-600/30" },
];

export default function Leaderboard() {
  const { leaderboard, isLoading, refetchAll } = useAthenaData();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("reward");

  // 🧠 Derived + filtered leaderboard
  const data = useMemo(() => {
    if (!leaderboard?.length) return [];

    const filtered = search
      ? leaderboard.filter((r) =>
          r.address.toLowerCase().includes(search.toLowerCase())
        )
      : leaderboard;

    return filtered
      .sort((a, b) =>
        sortBy === "reward"
          ? b.reward - a.reward
          : (b.mis || 0) - (a.mis || 0)
      )
      .slice(0, 10)
      .map((r, i) => ({
        ...r,
        rank: i + 1,
        short: `${r.address.slice(0, 6)}...${r.address.slice(-4)}`,
        rewardStr: `${formatNumber(r.reward, 2)} ATA`,
        misStr: `${(r.mis * 100).toFixed(2)}%`,
      }));
  }, [leaderboard, search, sortBy]);

  if (isLoading) return <Skeleton />;
  if (!data.length) return <EmptyState onRetry={refetchAll} />;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center relative">
        <motion.h2
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-4xl font-bold bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-600 bg-clip-text text-transparent"
        >
          Leaderboard
        </motion.h2>
        <p className="text-sm text-gray-400 mt-2">
          Top 10 agents by <span className="text-yellow-400">{sortBy}</span>
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="flex gap-2">
          {[
            { key: "reward", icon: Trophy, label: "Rewards" },
            { key: "mis", icon: Sparkles, label: "Accuracy" },
          ].map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => setSortBy(key)}
              className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition flex items-center gap-2 ${
                sortBy === key
                  ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/50 shadow-lg shadow-yellow-500/20"
                  : "bg-white/5 hover:bg-white/10"
              }`}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </div>

        {/* Search bar */}
        <div className="relative">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
          />
          <input
            type="text"
            placeholder="Search address..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 pr-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-yellow-400 transition w-full sm:w-72"
          />
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="hidden md:block glass p-6 rounded-2xl border border-white/10 overflow-hidden">
        {data.map((row, i) => (
          <motion.div
            key={row.address}
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: i * 0.05 }}
            className="group"
          >
            <div className="grid grid-cols-12 gap-4 items-center py-4 px-3 rounded-xl hover:bg-white/5 transition-all">
              <div className="col-span-1 text-center">
                {i < 5
                  ? MEDALS[i].icon({
                      size: 24,
                      className: `${MEDALS[i].color} ${MEDALS[i].glow}`,
                    })
                  : `#${i + 1}`}
              </div>
              <div className="col-span-5 flex items-center gap-2">
                <AgentName address={row.address} />
                <CopyButton address={row.address} />
              </div>
              <div className="col-span-3 text-right">
                <p className="text-lg font-bold text-yellow-400">{row.rewardStr}</p>
              </div>
              <div className="col-span-3 text-right">
                <p className="text-green-400 font-mono">{row.misStr}</p>
                {row.history?.length > 1 && (
                  <div className="h-8 mt-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={row.history.map((v) => ({ v }))}>
                        <Line
                          type="monotone"
                          dataKey="v"
                          stroke="#10b981"
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Chart Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="glass p-6 rounded-2xl border border-white/10"
      >
        <ResponsiveContainer width="100%" height={320}>
          <BarChart
            data={data}
            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="4 4" stroke="#333" />
            <XAxis dataKey="short" tick={{ fill: "#ccc", fontSize: 11 }} />
            <YAxis tick={{ fill: "#ccc", fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                background: "#111",
                border: "1px solid #444",
                borderRadius: 12,
              }}
              labelStyle={{ color: "#fff" }}
            />
            <Bar dataKey="reward" fill="url(#goldGradient)" radius={[8, 8, 0, 0]} />
            <defs>
              <linearGradient id="goldGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#facc15" />
                <stop offset="100%" stopColor="#f59e0b" />
              </linearGradient>
            </defs>
          </BarChart>
        </ResponsiveContainer>
      </motion.div>
    </div>
  );
}

/* 🔹 Agent ENS Resolver */
function AgentName({ address }) {
  const { data: ens } = useEnsName(address);
  return (
    <span className="font-mono text-sm">
      {ens || `${address.slice(0, 6)}...${address.slice(-4)}`}
    </span>
  );
}

/* 🔹 CopyButton */
function CopyButton({ address }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    if (copied) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    toast.success("Copied!");
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        handleCopy();
      }}
      className="opacity-0 group-hover:opacity-100 transition"
    >
      {copied ? (
        <CheckCircle size={14} className="text-green-400" />
      ) : (
        <Copy size={14} className="text-gray-500 hover:text-yellow-400" />
      )}
    </button>
  );
}

/* 🔹 Empty State */
function EmptyState({ onRetry }) {
  return (
    <div className="text-center text-gray-400 py-16">
      <p>No leaderboard data available.</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 px-4 py-2 bg-yellow-500/20 text-yellow-400 rounded-lg border border-yellow-400/30 hover:bg-yellow-500/30 transition"
        >
          Retry
        </button>
      )}
    </div>
  );
}

/* 🔹 Loading Skeleton */
function Skeleton() {
  return (
    <div className="animate-pulse text-center text-gray-500 py-16">
      Loading leaderboard...
    </div>
  );
}
