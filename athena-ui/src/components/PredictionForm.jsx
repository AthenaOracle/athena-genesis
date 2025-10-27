import { useState, useEffect } from "react";
import { useWallet } from "../context/WalletContext";
import { downloadJSON } from "../utils/helpers";
import { useEpochLog } from "../hooks/useAthenaData";
import { CONFIG_VERSION } from "../config/config";
import {
  Sparkles,
  Download,
  TrendingUp,
  TrendingDown,
  Minus,
  Info,
} from "lucide-react";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";

export default function PredictionForm() {
  const { account, isConnected } = useWallet();
  const { data: log } = useEpochLog();

  // ✅ Load saved draft
  const draft =
    JSON.parse(localStorage.getItem("athena-prediction-draft") || "{}") || {};

  const [direction, setDirection] = useState(draft.direction || "UP");
  const [confidence, setConfidence] = useState(draft.confidence || 0.5);
  const [target, setTarget] = useState(draft.target || "");
  const [simResult, setSimResult] = useState(draft.simResult || null);

  const currentEpoch = log?.current ?? 0;
  const oraclePrice = log?.epochs?.[currentEpoch]?.oraclePrice ?? null;
  const currentPriceStr = oraclePrice
    ? `$${oraclePrice.toLocaleString()}`
    : "—";

  // ✅ Persist draft on every change
  const saveDraft = (newData = {}) => {
    const next = { direction, confidence, target, ...newData };
    localStorage.setItem("athena-prediction-draft", JSON.stringify(next));
  };

  // 🧹 Auto-clear stale sim
  useEffect(() => {
    setSimResult(null);
  }, [direction, confidence, target]);

  const handleSimulate = () => {
    if (!target || isNaN(Number(target))) {
      toast.error("Please enter a valid price target.");
      return;
    }

    const priceTarget = Number(target);
    if (priceTarget <= 0) return toast.error("Target must be greater than zero.");
    if (priceTarget > 1_000_000) return toast.error("Target too high — check input.");
    if (!oraclePrice) return toast.error("Oracle price not available yet.");

    const payload = {
      version: CONFIG_VERSION,
      address: account || null,
      agentId: account || "guest_" + Date.now().toString(36),
      epoch: currentEpoch,
      prediction: {
        market: "BTC-USD",
        direction,
        horizon: "24h",
        confidence: Number(confidence),
        priceTarget,
        submittedAt: new Date().toISOString(),
      },
      signature: null,
    };

    // === Mock Reward Calculation ===
    const actualMove =
      priceTarget > oraclePrice
        ? "UP"
        : priceTarget < oraclePrice
        ? "DOWN"
        : "FLAT";

    const correct = actualMove === direction;
    const accuracy = correct
      ? 1 - Math.abs((priceTarget - oraclePrice) / oraclePrice)
      : 0;
    const baseReward = 1000;
    const mockReward = (baseReward * accuracy * confidence).toFixed(2);

    const result = { ...payload, mockReward };
    setSimResult(result);
    saveDraft({ simResult: result });
    toast.success("Simulation complete!");
  };

  const handleDownload = () => {
    if (!simResult) return;
    downloadJSON(
      simResult,
      `athena_prediction_epoch_${simResult.epoch}_${direction}.json`
    );
    toast.success("JSON downloaded!");
  };

  const handleReset = () => {
    localStorage.removeItem("athena-prediction-draft");
    setDirection("UP");
    setConfidence(0.5);
    setTarget("");
    setSimResult(null);
    toast.success("Draft cleared!");
  };

  const DirectionIcon =
    direction === "UP" ? TrendingUp : direction === "DOWN" ? TrendingDown : Minus;

  return (
    <div className="max-w-xl mx-auto glass p-6 md:p-8 rounded-2xl space-y-6 border border-white/10">
      <div className="text-center">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-yellow-400 to-amber-600 bg-clip-text text-transparent">
          Predict BTC/USD (24h)
        </h2>
        <p className="text-sm text-gray-400 mt-1">
          Current price:{" "}
          <span className="text-green-400 font-mono">{currentPriceStr}</span>
        </p>
        <p className="text-xs text-gray-500 mt-1 flex items-center justify-center gap-1">
          <Info size={12} /> Simulate predictions before on-chain submission opens.
        </p>
      </div>

      {/* Direction */}
      <div>
        <label className="text-xs text-gray-400 uppercase tracking-wider">
          Direction
        </label>
        <div className="grid grid-cols-3 gap-2 mt-2">
          {["UP", "DOWN", "FLAT"].map((opt) => {
            const Icon =
              opt === "UP" ? TrendingUp : opt === "DOWN" ? TrendingDown : Minus;
            return (
              <button
                key={opt}
                onClick={() => {
                  setDirection(opt);
                  saveDraft({ direction: opt });
                }}
                aria-label={`Set direction ${opt}`}
                className={`py-3 rounded-lg text-sm font-medium transition flex items-center justify-center gap-1.5 ${
                  direction === opt
                    ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/50"
                    : "bg-white/5 hover:bg-white/10"
                }`}
              >
                <Icon size={16} />
                {opt}
              </button>
            );
          })}
        </div>
      </div>

      {/* Confidence */}
      <div>
        <label
          htmlFor="confidence"
          className="text-xs text-gray-400 uppercase tracking-wider flex justify-between"
        >
          <span>Confidence</span>
          <span className="text-yellow-400">
            {(confidence * 100).toFixed(0)}%
          </span>
        </label>
        <div className="mt-2 relative">
          <input
            id="confidence"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={confidence}
            aria-label="Confidence slider"
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setConfidence(val);
              saveDraft({ confidence: val });
            }}
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
        <label
          htmlFor="price-target"
          className="text-xs text-gray-400 uppercase tracking-wider"
        >
          Price Target (USD)
        </label>
        <input
          id="price-target"
          type="number"
          placeholder={oraclePrice ? `e.g. ${oraclePrice + 1000}` : "68000"}
          value={target}
          aria-label="Price target input"
          onChange={(e) => {
            setTarget(e.target.value);
            saveDraft({ target: e.target.value });
          }}
          className="w-full mt-2 px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white text-lg font-mono focus:outline-none focus:border-yellow-400 transition"
        />
      </div>

      {/* Buttons */}
      <div className="flex flex-col sm:flex-row justify-center gap-3">
        <button
          onClick={handleSimulate}
          className="flex items-center justify-center gap-2 bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-500 hover:to-amber-500 px-6 py-3 rounded-xl font-semibold transition shadow-lg"
        >
          <Sparkles size={18} />
          Simulate Prediction
        </button>

        {isConnected && (
          <button
            disabled
            className="px-6 py-3 rounded-xl bg-white/10 cursor-not-allowed opacity-70 text-sm"
            title="On-chain submission coming soon"
          >
            Submit (Soon)
          </button>
        )}
      </div>

      <div className="text-center">
        <button
          onClick={handleReset}
          className="text-xs text-gray-400 hover:text-yellow-400 underline mt-2"
        >
          Reset Draft
        </button>
      </div>

      {/* Animated Result */}
      <AnimatePresence>
        {simResult && (
          <motion.div
            key="sim-result"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4 }}
            className="p-5 bg-black/40 border border-yellow-500/30 rounded-xl text-center"
          >
            <p className="text-sm text-gray-400 mb-2">Simulation Result</p>
            <p className="text-2xl font-bold text-yellow-400 font-mono">
              {simResult.mockReward
                ? `≈ ${simResult.mockReward} ATA`
                : "No reward data"}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {direction === "UP"
                ? "📈 If BTC rises to your target"
                : direction === "DOWN"
                ? "📉 If BTC falls"
                : "➖ If BTC stays flat"}
            </p>
            <button
              onClick={handleDownload}
              className="mt-4 flex items-center gap-2 mx-auto text-sm text-yellow-400 hover:text-yellow-300 transition"
            >
              <Download size={16} />
              Download Prediction JSON
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
