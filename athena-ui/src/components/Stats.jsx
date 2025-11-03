import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { BarChart3, Users, Sparkles } from "lucide-react";

export default function Stats() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["athena-stats"],
    queryFn: async () => {
      const res = await fetch("/Epoch Report/metrics.json", { cache: "no-store" });
      if (!res.ok) throw new Error("Metrics not found");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  // Load personal prediction history
  const history = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("athena-prediction-history") || "[]") || [];
    } catch {
      return [];
    }
  }, []);

  const personal = useMemo(() => {
    if (!history.length) return null;

    const avgConfidence =
      history.reduce((sum, h) => sum + (h.prediction.confidence || 0), 0) /
      history.length;
    const correct = history.filter((h) => h.score && h.score > 0).length;
    const correctPct = Math.round((correct / history.length) * 100);
    const totalAta = history.reduce((sum, h) => sum + (h.score || 0) / 800, 0);
    const epochs = new Set(history.map((h) => h.epoch)).size;

    return {
      predictions: history.length,
      avgConfidence: Math.round(avgConfidence * 100),
      correctPct,
      totalAta: totalAta.toFixed(2),
      epochs,
    };
  }, [history]);

  if (isLoading)
    return <p className="text-amber-400 animate-pulse">Loading Athena stats…</p>;
  if (error)
    return <p className="text-red-400">Failed to load metrics.json.</p>;
  if (!data)
    return <p className="text-gray-500">No stats available.</p>;

  const collective = {
    epoch: data.latest_epoch ?? "—",
    truthRate: data.truthRate ?? 0,
    truthPower: data.truthPowerIndex ?? 0,
    oracleCount: data.avgAgentCount ?? 0,
    rewards: data.totalRewardsDistributed ?? 0,
    athenaVsBtc: data.errorReductionPct ?? 0,
  };

  return (
    <motion.div
      className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full text-sm text-white"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* 🧭 Athena Collective Stats */}
      <section className="glass p-6 border border-white/10 rounded-2xl space-y-4">
        <h2 className="text-xl font-bold text-yellow-400 flex items-center gap-2">
          <BarChart3 size={18} className="text-yellow-400" /> Athena Collective Stats
        </h2>

        <ul className="space-y-2 mt-3 text-white">
          <li>
            Latest Epoch:{" "}
            <span className="text-yellow-400 font-mono">#{collective.epoch}</span>
          </li>
          <li>
            Truth Accuracy:{" "}
            <span className="text-yellow-400 font-semibold">
              {collective.truthRate.toFixed(2)}%
            </span>
          </li>
          <li>
            Network Strength (Truth Power):{" "}
            <span className="text-yellow-400 font-semibold">
              {collective.truthPower.toFixed(2)}
            </span>
          </li>
          <li>
            Active Agents:{" "}
            <span className="text-yellow-400 font-semibold">
              {collective.oracleCount}
            </span>
          </li>
          <li>
            Total Rewards Distributed:{" "}
            <span className="text-yellow-400 font-semibold">
              {collective.rewards.toLocaleString()} ₳ATA
            </span>
          </li>
          <li>
            Athena vs BTC:{" "}
            <span className="text-yellow-400 font-semibold">
              {collective.athenaVsBtc >= 0 ? "+" : ""}
              {collective.athenaVsBtc.toFixed(2)}%
            </span>
          </li>
        </ul>
      </section>

      {/* 👤 Your Performance */}
      <section className="glass p-6 border border-white/10 rounded-2xl space-y-4">
        <h2 className="text-xl font-bold text-yellow-400 flex items-center gap-2">
          <Users size={18} className="text-yellow-400" /> Your Performance
        </h2>

        {!personal ? (
          <p className="text-gray-400 mt-2">
            No predictions found yet. Start participating to see your stats!
          </p>
        ) : (
          <ul className="space-y-2 mt-3 text-white">
            <li>
              Predictions Made:{" "}
              <span className="text-yellow-400 font-semibold">
                {personal.predictions}
              </span>
            </li>
            <li>
              Average Confidence:{" "}
              <span className="text-yellow-400 font-semibold">
                {personal.avgConfidence}%
              </span>
            </li>
            <li>
              Correct Direction (est.):{" "}
              <span className="text-yellow-400 font-semibold">
                {personal.correctPct}%
              </span>
            </li>
            <li>
              Epochs Participated:{" "}
              <span className="text-yellow-400 font-semibold">
                {personal.epochs}
              </span>
            </li>
            <li>
              Estimated Rewards:{" "}
              <span className="text-yellow-400 font-semibold">
                {personal.totalAta} ₳ATA
              </span>
            </li>
          </ul>
        )}

        <div className="pt-4 border-t border-white/5 mt-2">
          <p className="text-xs text-gray-500 flex items-center gap-1">
            <Sparkles size={12} /> Based on your local prediction history.
          </p>
        </div>
      </section>
    </motion.div>
  );
}
