import { useState, useEffect, useCallback } from "react";
import { useWallet } from "../context/WalletContext";
import useAthenaData from "../hooks/useAthenaData";
import {
  claimReward,
  checkClaimed,
  estimateClaimGas,
  verifyProofLocally,
} from "../utils/claim";
import {
  ExternalLink,
  CheckCircle,
  AlertCircle,
  Copy,
  Loader2,
  History,
  ChevronDown,
  ChevronUp,
  Settings,
  Share2,
  ShieldCheck,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import Confetti from "react-confetti";
import { formatNumber, sanitizeIpfsUrl } from "../utils/helpers";

/* 🧩 Regex validator */
const isValidAddress = (addr) => /^0x[a-fA-F0-9]{40}$/.test(addr);

/* 🧩 IPFS gateways with failover */
const IPFS_GATEWAYS = [
  "https://ipfs.io/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
  "https://nftstorage.link/ipfs/",
];

export default function ClaimRewards() {
  const { account, isConnected, isCorrectChain, connect, switchNetwork } = useWallet();
  const { claim, epoch, refetchAll } = useAthenaData();

  const [inputAddress, setInputAddress] = useState("");
  const [eligible, setEligible] = useState(null);
  const [alreadyClaimed, setAlreadyClaimed] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [gasEstimate, setGasEstimate] = useState(null);
  const [ataPrice, setAtaPrice] = useState(null);
  const [confetti, setConfetti] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [claimHistory, setClaimHistory] = useState([]);
  const [debugOpen, setDebugOpen] = useState(false);
  const [proofModal, setProofModal] = useState(false);
  const [proofResult, setProofResult] = useState(null);
  const [gatewayIndex, setGatewayIndex] = useState(0);

  /* 🪙 Autofill wallet when connected */
  useEffect(() => {
    if (isConnected && account) setInputAddress(account);
  }, [isConnected, account]);

  /* 🔁 Load previous claims from localStorage */
  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem("athena-claim-history") || "[]");
    setClaimHistory(saved);
  }, []);

  /* 💡 Reminder for unclaimed rewards */
  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem("athena-last-unclaimed") || "{}");
    if (saved?.epoch && saved?.amount) {
      toast(`💡 You still have ${saved.amount} ATA unclaimed (Epoch ${saved.epoch})`, {
        icon: "⚡",
      });
    }
  }, []);

  /* 💵 Fetch ATA/USD price for fiat hint (best-effort) */
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=athena-token&vs_currencies=usd"
        );
        const data = await res.json();
        setAtaPrice(data["athena-token"]?.usd || null);
      } catch {
        setAtaPrice(null);
      }
    })();
  }, []);

  /* 🧠 Check eligibility */
  const checkEligibility = useCallback(async () => {
    if (!inputAddress) return toast.error("Enter an address first");
    if (!isValidAddress(inputAddress)) return toast.error("Invalid wallet address");
    if (!epoch?.claims?.length) return toast.error("No epoch data available yet");

    setIsChecking(true);
    setEligible(null);
    setTxHash("");
    setAlreadyClaimed(false);
    setGasEstimate(null);
    setProofResult(null);

    try {
      const match = epoch.claims.find(
        (c) => c.wallet.toLowerCase() === inputAddress.toLowerCase()
      );
      if (!match) {
        toast("No claimable rewards for this address");
        setEligible({ eligible: false });
        return;
      }

      const readableAmount = formatNumber(match.amount, 2);
      const proof = claim?.proof || match.proof || [];
      const reportUrl = sanitizeIpfsUrl(
        IPFS_GATEWAYS[gatewayIndex] + `epoch_${epoch.epoch}_report.json`
      );

      // ✅ Local proof check (best-effort — depends on your verifyProofLocally impl)
      try {
        const verified = await verifyProofLocally(proof, match.amount, match.wallet);
        setProofResult(verified ? "valid" : "invalid");
      } catch {
        setProofResult(null); // unknown / skipped
      }

      // ✅ Claimed check
      const claimed = await checkClaimed(inputAddress, epoch.epoch);
      setAlreadyClaimed(claimed);
      if (claimed) toast("✅ Rewards already claimed");

      // ✅ Gas estimate
      try {
        const gas = await estimateClaimGas({
          epoch: epoch.epoch,
          amount: readableAmount,
          proof,
        });
        setGasEstimate(gas);
      } catch {
        setGasEstimate(null);
      }

      setEligible({
        eligible: true,
        epoch: epoch.epoch,
        amount: readableAmount,
        proof,
        reportUrl,
      });

      if (!claimed) {
        toast.success(`Eligible for ${readableAmount} ATA`);
        localStorage.setItem(
          "athena-last-unclaimed",
          JSON.stringify({ epoch: epoch.epoch, amount: readableAmount })
        );
      }
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to check eligibility");
    } finally {
      setIsChecking(false);
    }
  }, [inputAddress, epoch, claim, gatewayIndex]);

  /* ⚡ Auto-check on wallet connect */
  useEffect(() => {
    if (isConnected && inputAddress) checkEligibility();
  }, [isConnected, inputAddress, checkEligibility]);

  /* 🚀 Execute claim transaction */
  const executeClaim = useCallback(async () => {
    if (!eligible?.eligible) return;
    if (!isConnected || !isCorrectChain)
      return toast.error("Connect to Base network first");
    if (alreadyClaimed) return toast("Already claimed for this epoch");

    setIsClaiming(true);
    try {
      const hash = await claimReward({
        epoch: eligible.epoch,
        amount: eligible.amount,
        proof: eligible.proof,
      });
      setTxHash(hash);
      setConfetti(true);

      // 🧾 Save claim history (lightweight "TX queue")
      const newHistory = [
        { epoch: eligible.epoch, amount: eligible.amount, hash, time: Date.now() },
        ...claimHistory,
      ].slice(0, 10);
      localStorage.setItem("athena-claim-history", JSON.stringify(newHistory));
      setClaimHistory(newHistory);

      // 🎉 UX feedback
      toast.success("🎉 Claim successful!");
      localStorage.removeItem("athena-last-unclaimed");
      refetchAll();
      setAlreadyClaimed(true);

      // 🕐 Stop confetti
      setTimeout(() => setConfetti(false), 4000);
    } catch (err) {
      console.error(err);
      toast.error(err?.shortMessage || "Claim failed");
    } finally {
      setIsClaiming(false);
    }
  }, [eligible, isConnected, isCorrectChain, alreadyClaimed, claimHistory, refetchAll]);

  /* 💡 Allow Enter key to trigger */
  const handleKeyPress = (e) => e.key === "Enter" && checkEligibility();

  /* 🔁 Cycle IPFS gateway if a link is slow / blocked */
  const cycleGateway = () => {
    setGatewayIndex((i) => (i + 1) % IPFS_GATEWAYS.length);
    toast("Switched IPFS gateway");
  };

  /* 🧩 Social share */
  const handleShare = () => {
    if (!eligible?.eligible) return;
    const text = `I just claimed ${eligible.amount} $ATA on Athena Protocol ⚡ #DeFi #Base`;
    const url = "https://athena-protocol.app";
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${url}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  return (
    <div className="relative max-w-xl mx-auto glass p-6 md:p-8 rounded-2xl space-y-6 border border-white/10">
      {confetti && <Confetti numberOfPieces={150} recycle={false} />}
      <button
        onClick={() => setDebugOpen(!debugOpen)}
        className="absolute top-3 right-3 text-gray-500 hover:text-yellow-400 transition"
        title="Toggle debug panel"
      >
        <Settings size={18} />
      </button>

      {/* Title */}
      <div className="text-center">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-yellow-400 to-amber-600 bg-clip-text text-transparent">
          Claim Your ATA Rewards
        </h2>
        <p className="text-sm text-gray-400 mt-1">
          Enter any address to check eligibility • Claim requires wallet connection
        </p>
      </div>

      {/* Address Input */}
      <div>
        <label className="text-xs text-gray-400 uppercase tracking-wider">Wallet Address</label>
        <div className="flex gap-2 mt-2">
          <input
            type="text"
            placeholder="0x..."
            value={inputAddress}
            onChange={(e) => setInputAddress(e.target.value)}
            onKeyPress={handleKeyPress}
            className="flex-1 px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-yellow-400 transition"
          />
          <button
            onClick={checkEligibility}
            disabled={isChecking || !inputAddress}
            title={!inputAddress ? "Enter an address to check" : ""}
            className="px-5 py-3 bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-500 hover:to-amber-500 rounded-xl font-semibold transition flex items-center gap-2 disabled:opacity-50"
          >
            {isChecking ? <Loader2 size={18} className="animate-spin" /> : "Check"}
          </button>
        </div>
      </div>

      {/* Eligibility */}
      <AnimatePresence>
        {eligible && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className={`p-5 rounded-xl border ${
              eligible.eligible
                ? "bg-green-900/20 border-green-500/30"
                : "bg-red-900/20 border-red-500/30"
            }`}
          >
            {eligible.eligible ? (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-green-400 flex items-center gap-2">
                    <CheckCircle size={20} />
                    {alreadyClaimed ? (
                      <span className="text-yellow-400">Verified on Base Mainnet</span>
                    ) : (
                      <>
                        Eligible for{" "}
                        <strong className="text-xl">{eligible.amount} ATA</strong>
                      </>
                    )}
                  </p>
                  <CopyButton text={eligible.amount} />
                </div>

                <p className="text-xs text-gray-400 mt-1">
                  Epoch {eligible.epoch} • Proof:{" "}
                  {proofResult === "valid" ? (
                    <span className="text-green-400">Verified</span>
                  ) : proofResult === "invalid" ? (
                    <span className="text-red-400">Invalid</span>
                  ) : (
                    <span className="text-gray-400">Unknown</span>
                  )}
                </p>

                {/* Gas Estimate + Fiat value */}
                {gasEstimate && !alreadyClaimed && (
                  <p className="text-xs text-gray-500 mt-2">
                    ⛽ Estimated gas: {gasEstimate.eth} ETH (~${gasEstimate.usd})
                  </p>
                )}
                {ataPrice && (
                  <p className="text-xs text-gray-500 mt-1">
                    ≈ ${(ataPrice * Number(eligible.amount)).toFixed(2)} USD
                  </p>
                )}

                {/* IPFS Report + Gateway switcher */}
                <div className="flex items-center gap-2 mt-2">
                  <a
                    href={eligible.reportUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  >
                    View Epoch Report <ExternalLink size={12} />
                  </a>
                  <button
                    onClick={cycleGateway}
                    className="text-xs text-gray-400 hover:text-gray-200 flex items-center gap-1"
                    title="Switch IPFS gateway"
                  >
                    <RefreshCw size={12} /> Gateway
                  </button>
                </div>

                <button
                  onClick={() => setProofModal(true)}
                  className="mt-3 flex items-center gap-1 text-xs text-yellow-400 hover:text-yellow-300"
                >
                  <ShieldCheck size={12} /> Verify Proof
                </button>
              </>
            ) : (
              <p className="text-red-400 flex items-center gap-2">
                <AlertCircle size={20} /> No claimable rewards this epoch — check again later.
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Claim Button */}
      {eligible?.eligible && (
        <div className="flex justify-center">
          {!isConnected ? (
            <button
              onClick={connect}
              className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-xl font-semibold transition shadow-lg"
            >
              Connect Wallet to Claim
            </button>
          ) : !isCorrectChain ? (
            <button
              onClick={switchNetwork}
              className="px-8 py-3 bg-yellow-600 hover:bg-yellow-500 rounded-xl font-semibold transition shadow-lg"
            >
              Switch to Base Network
            </button>
          ) : (
            <button
              onClick={executeClaim}
              disabled={isClaiming || alreadyClaimed}
              title={
                alreadyClaimed
                  ? "Rewards already claimed"
                  : isClaiming
                  ? "Submitting transaction..."
                  : ""
              }
              className={`px-8 py-3 rounded-xl font-semibold transition shadow-lg flex items-center gap-2 ${
                alreadyClaimed
                  ? "bg-gray-700/50 cursor-not-allowed text-gray-400"
                  : "bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500"
              }`}
            >
              {isClaiming ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> Waiting for confirmation...
                </>
              ) : alreadyClaimed ? (
                <>
                  <CheckCircle size={18} /> Claimed
                </>
              ) : (
                <>
                  <Sparkles size={18} /> Claim {eligible.amount} ATA
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Share & Tx Link */}
      {txHash && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center p-4 bg-black/30 rounded-xl"
        >
          <p className="text-sm text-gray-400">Transaction Sent to Base</p>
          <a
            href={`https://basescan.org/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-yellow-400 hover:text-yellow-300 font-mono text-sm flex items-center justify-center gap-1 mt-1"
          >
            {txHash.slice(0, 10)}...{txHash.slice(-8)} <ExternalLink size={14} />
          </a>
          <button
            onClick={handleShare}
            className="mt-2 flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 mx-auto"
          >
            <Share2 size={12} /> Share on X
          </button>
        </motion.div>
      )}

      {/* Claim History */}
      {claimHistory.length > 0 && (
        <div className="mt-6">
          <button
            onClick={() => setHistoryOpen(!historyOpen)}
            className="flex items-center justify-center gap-2 text-yellow-400 hover:text-yellow-300 transition text-sm mx-auto"
          >
            <History size={14} /> Claim History
            {historyOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <AnimatePresence>
            {historyOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 text-xs text-gray-400 space-y-1"
              >
                {claimHistory.map((c, i) => (
                  <div key={i} className="flex justify-between">
                    <span>
                      Epoch {c.epoch} → {c.amount} ATA
                    </span>
                    <a
                      href={`https://basescan.org/tx/${c.hash}`}
                      target="_blank"
                      className="text-yellow-400 hover:text-yellow-300 flex items-center gap-1"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink size={12} />
                    </a>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Proof Modal */}
      <AnimatePresence>
        {proofModal && (
          <motion.div
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setProofModal(false)}
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              className="bg-black/60 p-6 rounded-xl border border-white/10 max-w-md w-full text-center space-y-4"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
            >
              <h3 className="text-lg text-yellow-400 font-semibold flex items-center justify-center gap-2">
                <ShieldCheck size={18} /> Proof Verification
              </h3>
              <p className="text-sm text-gray-400">
                {proofResult === "valid"
                  ? "✅ This proof is valid for the provided address and amount."
                  : proofResult === "invalid"
                  ? "❌ Proof invalid — data mismatch or altered JSON."
                  : "ℹ️ Unable to verify locally (skipped or unavailable)."}
              </p>
              <button
                onClick={() => setProofModal(false)}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm"
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Debug Panel */}
      {debugOpen && (
        <motion.pre
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-xs text-gray-400 bg-black/40 p-3 rounded-xl mt-4 overflow-x-auto border border-white/5"
        >
          {JSON.stringify(
            {
              epoch: epoch?.epoch,
              inputAddress,
              eligible,
              proofResult,
              gasEstimate,
              alreadyClaimed,
              txHash,
              gatewayIndex,
            },
            null,
            2
          )}
        </motion.pre>
      )}
    </div>
  );
}

/* 📋 Copy Helper */
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(String(text));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      className="p-1.5 rounded bg-white/10 hover:bg-white/20 transition"
      title="Copy amount"
    >
      {copied ? (
        <CheckCircle size={16} className="text-green-400" />
      ) : (
        <Copy size={16} />
      )}
    </button>
  );
}
