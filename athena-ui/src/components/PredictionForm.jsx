// src/components/PredictionForm.jsx
import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Download,
  TrendingUp,
  TrendingDown,
  Minus,
  Info,
  AlertTriangle,
  History as HistoryIcon,
  RotateCcw,
} from "lucide-react";
import toast from "react-hot-toast";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { useWallet } from "../context/WalletContext";
import { downloadJSON } from "../utils/helpers";
import { CONFIG_VERSION } from "../config/config";
import useBtcHistory from "../hooks/useBtcPrice";

// small helpers
const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
const fmt = (n, d = 2) => (typeof n === "number" && !Number.isNaN(n) ? n.toFixed(d) : "—");

// fetch pulse (latest epoch) from metrics.json
async function fetchPulseMeta() {
  try {
    const res = await fetch("/Epoch Report/metrics.json", { cache: "no-store" });
    if (!res.ok) throw new Error("metrics not found");
    const data = await res.json();
    return {
      latestEpoch: data.latest_epoch ?? data.latestEpoch ?? "—",
      startedAt: data.timestamp ? new Date(data.timestamp) : null,
    };
  } catch {
    return { latestEpoch: "—", startedAt: null };
  }
}

const TIMEFRAMES = ["1h", "4h", "1d", "1w"];

export default function PredictionForm() {
  const { account, isConnected } = useWallet();

  // Load draft (if any)
  const draft = JSON.parse(localStorage.getItem("athena-prediction-draft") || "{}") || {};
  const [timeframe, setTimeframe] = useState(draft.timeframe || "1d");
  const [direction, setDirection] = useState(draft.direction || "UP");
  const [confidence, setConfidence] = useState(draft.confidence ?? 0.5);
  const [target, setTarget] = useState(draft.target || "");
  const [previewResult, setPreviewResult] = useState(null);

  // Pulse link
  const [pulse, setPulse] = useState({ latestEpoch: "—", startedAt: null });
  useEffect(() => {
    let cancel = false;
    (async () => {
      const p = await fetchPulseMeta();
      if (!cancel) setPulse(p);
    })();
    return () => (cancel = true);
  }, []);

  // BTC history (multi-timeframe, backfilled, smart polling)
  const { price, series, isLoading, error } = useBtcHistory(timeframe);

  // Persist draft whenever inputs change
  useEffect(() => {
    localStorage.setItem(
      "athena-prediction-draft",
      JSON.stringify({ timeframe, direction, confidence, target })
    );
  }, [timeframe, direction, confidence, target]);

  // Derive some UX hints
  const currentPrice = typeof price === "number" ? price : null;
  const currentPriceStr = currentPrice ? `$${currentPrice.toLocaleString()}` : "—";

  // Validation hints based on direction & target vs live price
  const targetNum = useMemo(() => {
    const n = Number(target);
    return Number.isFinite(n) ? n : null;
  }, [target]);

  const targetHint = useMemo(() => {
    if (!currentPrice || !targetNum) return null;
    if (direction === "UP" && targetNum <= currentPrice)
      return "For UP, target is usually above the current price.";
    if (direction === "DOWN" && targetNum >= currentPrice)
      return "For DOWN, target is usually below the current price.";
    if (direction === "FLAT" && Math.abs(targetNum - currentPrice) > currentPrice * 0.0025)
      return "For FLAT, target should be near the current price (±0.25%).";
    return null;
  }, [direction, targetNum, currentPrice]);

  // Preview logic (score only – on-chain later)
  function previewOutcome() {
    if (!currentPrice) {
      toast.error("Live price not available yet. Try again in a moment.");
      return;
    }
    if (targetNum === null || targetNum <= 0) {
      toast.error("Please enter a valid positive price target.");
      return;
    }
    if (targetNum > 1_000_000) {
      toast.error("Target too high — sanity check your input.");
      return;
    }

    // “Correctness” vs intent (UP/DOWN/FLAT)
    const moveDir =
      targetNum > currentPrice ? "UP" : targetNum < currentPrice ? "DOWN" : "FLAT";
    const correct = moveDir === direction;

    // Distance factor (closer target to current = less ambitious)
    const dist = Math.abs(targetNum - currentPrice) / currentPrice; // 0..big
    const ambition = clamp(1 - dist, 0, 1); // big distance => smaller ambition

    // FLAT gets a tight band bonus if within ±0.15%
    let flatBonus = 0;
    if (direction === "FLAT") {
      const band = Math.abs(targetNum - currentPrice) / currentPrice;
      flatBonus = band <= 0.0015 ? 0.1 : band <= 0.0025 ? 0.05 : 0;
    }

    // A playful scoring heuristic
    const base = 800; // notional
    const score =
      (correct ? 1 : 0) *
      (base * (0.4 + 0.6 * ambition) * clamp(confidence, 0, 1) * (1 + flatBonus));

    const result = {
      version: CONFIG_VERSION,
      address: account || null,
      agentId: account || `guest_${Date.now().toString(36)}`,
      epoch: pulse.latestEpoch, // tie to current Pulse
      prediction: {
        market: "BTC-USD",
        direction,
        horizon: timeframe,
        confidence: Number(confidence),
        priceTarget: targetNum,
        submittedAt: new Date().toISOString(),
      },
      score: Number(fmt(score, 2)),
    };

    setPreviewResult(result);

    // Save to local history (top, max 10)
    const prev = JSON.parse(localStorage.getItem("athena-prediction-history") || "[]") || [];
    const next = [result, ...prev].slice(0, 10);
    localStorage.setItem("athena-prediction-history", JSON.stringify(next));

    toast.success("Preview ready!");
  }

  function resetDraft() {
    localStorage.removeItem("athena-prediction-draft");
    setTimeframe("1d");
    setDirection("UP");
    setConfidence(0.5);
    setTarget("");
    setPreviewResult(null);
  }

  function download() {
    if (!previewResult) return;
    const file = `athena_prediction_pulse_${previewResult.epoch}_${previewResult.prediction.horizon}_${Date.now()}.json`;
    downloadJSON(previewResult, file);
    toast.success("JSON downloaded!");
  }

  // Label formatting by timeframe for the X axis
  const chartData = useMemo(() => {
    const fmtLabel =
      timeframe === "1w"
        ? (ms) => new Date(ms).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit" })
        : timeframe === "1d"
        ? (ms) => new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : (ms) => new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    return (series || []).map(({ t, p }) => ({
      t,
      label: fmtLabel(t),
      p,
    }));
  }, [series, timeframe]);

  // Load & show recent predictions toggle
  const [historyOpen, setHistoryOpen] = useState(false);
  const localHistory = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("athena-prediction-history") || "[]") || [];
    } catch {
      return [];
    }
  }, [previewResult]); // re-read after new preview

  const loadFromHistory = (h) => {
    setTimeframe(h.prediction.horizon);
    setDirection(h.prediction.direction);
    setConfidence(h.prediction.confidence);
    setTarget(String(h.prediction.priceTarget));
    setPreviewResult(h);
    toast("Loaded from history");
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
      {/* RIGHT: live chart (fills more) */}
      <section className="md:col-span-7 md:order-2 glass p-4 md:p-6 rounded-2xl border border-white/10">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm text-gray-400">BTC / USD</h3>
            <div className="flex items-end gap-3">
              <p className="text-3xl font-bold text-green-400">
                {currentPrice ? `$${fmt(currentPrice, 2)}` : "—"}
              </p>
              {!!currentPrice && (
                <p className="text-xs text-gray-500">auto ~{timeframe === "1h" ? "15s" : timeframe === "4h" ? "60s" : timeframe === "1d" ? "5m" : "30m"}</p>
              )}
            </div>
          </div>

          {/* timeframe selector */}
          <div className="flex items-center gap-2">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition border ${
                  timeframe === tf
                    ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/50"
                    : "bg-white/5 hover:bg-white/10 border-white/10"
                }`}
              >
                {tf.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="h-72 md:h-80 lg:h-[420px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
              <defs>
                <linearGradient id="btcGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#facc15" stopOpacity={0.55} />
                  <stop offset="100%" stopColor="#facc15" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#bbb" }} />
              <YAxis hide />
              <Tooltip
                contentStyle={{
                  background: "rgba(0,0,0,0.7)",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
                labelStyle={{ color: "#ddd" }}
                formatter={(v) => [`$${fmt(v, 2)}`, "Price"]}
              />
              <Area
                type="monotone"
                dataKey="p"
                stroke="#facc15"
                fill="url(#btcGrad)"
                strokeWidth={2}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {!currentPrice && (
          <div className="mt-3 text-xs text-gray-500 flex items-center gap-2">
            <AlertTriangle size={14} className="text-yellow-400" />
            Live price not yet available. You can still preview with a manual target.
          </div>
        )}

        {error && (
          <p className="mt-2 text-xs text-red-400">
            Failed to load price history. Retrying automatically…
          </p>
        )}
      </section>

      {/* LEFT: form + history */}
      <section className="md:col-span-5 md:order-1 glass p-5 md:p-6 rounded-2xl border border-white/10 space-y-6">
        <div className="text-center">
          <h2 className="text-xl font-bold bg-gradient-to-r from-yellow-400 to-amber-600 bg-clip-text text-transparent">
            Predict BTC/USD
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Pulse <span className="text-amber-300 font-mono">#{pulse.latestEpoch}</span>
          </p>
          <p className="text-sm text-gray-400 mt-1">
            Current price:{" "}
            <span className="text-green-400 font-mono">{currentPriceStr}</span>
          </p>
          <p className="text-xs text-gray-500 mt-1 flex items-center justify-center gap-1">
            <Info size={12} /> Preview outcomes before on-chain submission opens.
          </p>
        </div>

        {/* Direction */}
        <div>
          <label className="text-xs text-gray-400 uppercase tracking-wider">Direction</label>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {[
              { key: "UP", Icon: TrendingUp },
              { key: "DOWN", Icon: TrendingDown },
              { key: "FLAT", Icon: Minus },
            ].map(({ key, Icon }) => (
              <button
                key={key}
                onClick={() => setDirection(key)}
                className={`py-3 rounded-lg text-sm font-medium transition flex items-center justify-center gap-1.5 ${
                  direction === key
                    ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/50"
                    : "bg-white/5 hover:bg-white/10 border border-white/10"
                }`}
              >
                <Icon size={16} />
                {key}
              </button>
            ))}
          </div>
        </div>

        {/* Confidence */}
        <div>
          <label
            htmlFor="confidence"
            className="text-xs text-gray-400 uppercase tracking-wider flex justify-between"
          >
            <span>Confidence</span>
            <span className="text-yellow-400">{Math.round(confidence * 100)}%</span>
          </label>
          <div className="mt-2 relative">
            <input
              id="confidence"
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={confidence}
              onChange={(e) => setConfidence(parseFloat(e.target.value))}
              className="w-full h-2 accent-yellow-500 rounded-lg appearance-none cursor-pointer slider"
            />
            <div
              className="absolute top-0 left-0 h-2 bg-gradient-to-r from-yellow-600 to-amber-500 rounded-lg pointer-events-none"
              style={{ width: `${confidence * 100}%` }}
            />
          </div>
        </div>

        {/* Price Target */}
        <div>
          <label htmlFor="price-target" className="text-xs text-gray-400 uppercase tracking-wider">
            Price Target (USD)
          </label>
          <input
            id="price-target"
            type="number"
            placeholder={currentPrice ? `e.g. ${Math.round(currentPrice + 500)}` : "68000"}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="w-full mt-2 px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white text-lg font-mono focus:outline-none focus:border-yellow-400 transition"
          />
          {targetHint && <p className="text-xs text-yellow-400 mt-1">{targetHint}</p>}
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row justify-center gap-3">
          <button
            onClick={previewOutcome}
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-500 hover:to-amber-500 px-6 py-3 rounded-xl font-semibold transition shadow-lg"
          >
            <Sparkles size={18} />
            Preview Outcome
          </button>

          {isConnected ? (
            <button
              disabled
              className="px-6 py-3 rounded-xl bg-white/10 cursor-not-allowed opacity-70 text-sm"
              title="On-chain submission coming soon"
            >
              Submit (Soon)
            </button>
          ) : null}

          <button
            onClick={() => {
              resetDraft();
              toast.success("Draft reset");
            }}
            className="px-6 py-3 rounded-xl border border-white/10 hover:border-yellow-400 transition flex items-center gap-2"
          >
            <RotateCcw size={16} /> Reset
          </button>
        </div>

        {/* Preview card */}
        <AnimatePresence>
          {previewResult && (
            <motion.div
              key="preview-result"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35 }}
              className="p-5 bg-black/40 border border-yellow-500/30 rounded-xl text-center"
            >
              <p className="text-sm text-gray-400 mb-2">
                Pulse #{previewResult.epoch} • {previewResult.prediction.horizon.toUpperCase()}
              </p>
              <p className="text-2xl font-bold text-yellow-400 font-mono">
                Score ≈ {fmt(previewResult.score, 0)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {direction === "UP"
                  ? "📈 If BTC rises to your target"
                  : direction === "DOWN"
                  ? "📉 If BTC falls to your target"
                  : "➖ If BTC remains near your target"}
              </p>
              <button
                onClick={download}
                className="mt-4 flex items-center gap-2 mx-auto text-sm text-yellow-400 hover:text-yellow-300 transition"
              >
                <Download size={16} />
                Download Prediction JSON
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Personal history */}
        <div className="pt-2">
          <button
            onClick={() => setHistoryOpen((v) => !v)}
            className="text-sm text-amber-300 hover:text-amber-200 flex items-center gap-2"
          >
            <HistoryIcon size={16} /> {historyOpen ? "Hide" : "Show"} Recent Predictions
          </button>

          <AnimatePresence>
            {historyOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 space-y-2 text-xs text-gray-400 max-h-48 overflow-auto pr-1"
              >
                {localHistory.length === 0 && <p>No predictions yet.</p>}
                {localHistory.map((h, i) => (
                  <div
                    key={`${h.prediction.submittedAt}-${i}`}
                    className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2 border border-white/10"
                  >
                    <div className="truncate">
                      <span className="text-amber-300 mr-2">Pulse #{h.epoch}</span>
                      <span>
                        {h.prediction.horizon.toUpperCase()} • {h.prediction.direction}
                      </span>
                      <span className="ml-2 font-mono">${fmt(h.prediction.priceTarget, 0)}</span>
                    </div>
                    <button
                      onClick={() => loadFromHistory(h)}
                      className="text-amber-300 hover:text-amber-200"
                      title="Load into form"
                    >
                      Use
                    </button>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>
    </div>
  );
}
