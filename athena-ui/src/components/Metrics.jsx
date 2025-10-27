// src/components/Metrics.jsx
import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Gauge, TrendingUp, Users, Zap, Shield, Activity } from "lucide-react";

// ----------------------
// Utility helpers
// ----------------------
const safeNum = (n) => (typeof n === "number" && !isNaN(n) ? n : 0);
const fmt = (n, decimals = 2) =>
  n !== null && n !== undefined && !isNaN(n) ? n.toFixed(decimals) : "–";

const trendArrow = (val) =>
  val === null || val === undefined
    ? ""
    : val > 0
    ? "↑"
    : val < 0
    ? "↓"
    : "→";

// ----------------------
// Animated Gauge Component
// ----------------------
const TruthRateGauge = ({ value = 0 }) => {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  return (
    <motion.div
      animate={
        value > 80
          ? {
              scale: [1, 1.05, 1],
              boxShadow: "0 0 20px rgba(139,92,246,0.5)",
            }
          : {}
      }
      transition={{ repeat: Infinity, duration: 2 }}
      className="relative w-24 h-24"
    >
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0 w-full h-full -rotate-90"
      >
        <circle
          cx="50"
          cy="50"
          r={radius}
          stroke="rgba(139, 92, 246, 0.15)"
          strokeWidth="10"
          fill="none"
        />
        <motion.circle
          cx="50"
          cy="50"
          r={radius}
          stroke="#8B5CF6"
          strokeWidth="10"
          fill="none"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          style={{ strokeLinecap: "round" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-purple-400">
          {fmt(value, 1)}%
        </span>
        <span className="text-xs text-purple-300">TruthRate</span>
      </div>
    </motion.div>
  );
};

// ----------------------
// Main Metrics Component
// ----------------------
export default function Metrics() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["metrics"],
    queryFn: async () => {
      // use relative path to access Epoch Report from main repo root
      const res = await fetch("../Epoch Report/metrics.json");
      if (!res.ok) throw new Error("Failed to load metrics.json");
      return res.json();
    },
    staleTime: 60_000,
    refetchInterval: 300_000,
  });

  const metrics = useMemo(() => {
    if (!data) return {};
    return {
      version: data.version,
      latest_epoch: data.latest_epoch,
      truthRate: safeNum(data.truthRate),
      truthPowerIndex: safeNum(data.truthPowerIndex),
      avgAgentCount: safeNum(data.avgAgentCount),
      roiVsInitialPool: safeNum(data.roiVsInitialPool),
      outperformanceRate: safeNum(data.outperformanceRate),
      errorReductionPct: safeNum(data.errorReductionPct),
      avgCollectiveMIS: safeNum(data.avgCollectiveMIS),
      agentGrowthPct: safeNum(data.agentGrowthPct),
    };
  }, [data]);

  if (isLoading)
    return (
      <div className="p-6 text-center text-gray-400">
        <Activity className="w-6 h-6 animate-spin mx-auto mb-2" />
        Loading TruthRate…
      </div>
    );

  if (error)
    return (
      <div className="p-6 text-center text-red-400">
        <Shield className="w-6 h-6 mx-auto mb-2" />
        Failed to load metrics
      </div>
    );

  const m = metrics;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
          Athena Truth Engine
        </h2>
        <p className="text-xs text-gray-500 mt-1">
          v{m.version} — Epoch {m.latest_epoch}
        </p>
      </div>

      {/* TruthRate Gauge */}
      <div className="flex justify-center">
        <TruthRateGauge value={m.truthRate} />
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <MetricCard
          icon={<Zap className="w-5 h-5 text-yellow-400" />}
          title="TruthPower™"
          value={fmt(m.truthPowerIndex)}
          trend={trendArrow(m.agentGrowthPct)}
        />
        <MetricCard
          icon={<Users className="w-5 h-5 text-blue-400" />}
          title="Agents"
          value={fmt(m.avgAgentCount, 0)}
          trend={trendArrow(m.agentGrowthPct)}
        />
        <MetricCard
          icon={<TrendingUp className="w-5 h-5 text-green-400" />}
          title="ROI vs Pool"
          value={`${fmt(m.roiVsInitialPool)}%`}
          trend={trendArrow(m.roiVsInitialPool)}
        />
        <MetricCard
          icon={<Gauge className="w-5 h-5 text-purple-400" />}
          title="Outperformance"
          value={`${fmt(m.outperformanceRate)}%`}
          trend={trendArrow(m.outperformanceRate)}
        />
        <MetricCard
          icon={<Shield className="w-5 h-5 text-red-400" />}
          title="Error Reduction"
          value={`${fmt(m.errorReductionPct)}%`}
          trend={trendArrow(m.errorReductionPct)}
        />
        <MetricCard
          icon={<Activity className="w-5 h-5 text-pink-400" />}
          title="Avg MIS"
          value={`${fmt(m.avgCollectiveMIS * 100, 2)}%`}
        />
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-gray-500">
        TruthRate = Collective MIS × 100 | TruthPower = TruthRate × log₁₀(agents + 1)
      </div>
    </div>
  );
}

// ----------------------
// Reusable Metric Card
// ----------------------
function MetricCard({ icon, title, value, trend = "" }) {
  const trendColor =
    trend === "↑"
      ? "text-green-400"
      : trend === "↓"
      ? "text-red-400"
      : "text-gray-400";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-4 flex flex-col items-center justify-center border border-purple-500/20 shadow-lg"
    >
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs text-gray-400">{title}</span>
      </div>
      <div className="text-xl font-bold text-white flex items-center gap-1">
        {value}
        {trend && <span className={trendColor}>{trend}</span>}
      </div>
    </motion.div>
  );
}
