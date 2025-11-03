import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "../context/WalletContext";
import { Wallet, Loader2, LogOut, Smartphone, X as XIcon } from "lucide-react";

export default function WalletBanner() {
  const { isConnected, connect, disconnect, isConnecting, account } = useWallet();
  const [showModal, setShowModal] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  // 🔹 Allow closing with ESC key
  useEffect(() => {
    const escHandler = (e) => e.key === "Escape" && setShowModal(false);
    window.addEventListener("keydown", escHandler);
    return () => window.removeEventListener("keydown", escHandler);
  }, []);

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      await disconnect();
    } finally {
      setIsDisconnecting(false);
    }
  };

  const short = account ? `${account.slice(0, 6)}...${account.slice(-4)}` : null;

  return (
    <div className="w-full bg-black/30 border-b border-white/10 text-sm text-center py-3 px-4 flex items-center justify-center">
      {/* ---------------- CONNECTED ---------------- */}
      {isConnected ? (
        <button
          onClick={handleDisconnect}
          disabled={isDisconnecting}
          className="px-5 py-2 rounded-xl font-semibold text-sm bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-500 hover:to-amber-500 text-black transition flex items-center gap-2"
        >
          {isDisconnecting ? (
            <>
              <Loader2 size={14} className="animate-spin" /> Disconnecting...
            </>
          ) : (
            <>
              <LogOut size={14} />
              {short} — Disconnect
            </>
          )}
        </button>
      ) : (
        /* ---------------- DISCONNECTED ---------------- */
        <button
          onClick={() => setShowModal(true)}
          disabled={isConnecting}
          className="inline-flex items-center gap-2 px-5 py-2 rounded-xl font-semibold text-sm bg-gradient-to-r from-amber-500 to-yellow-500 text-black shadow-md transition-transform duration-200 hover:scale-[1.02]"
        >
          {isConnecting ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <Wallet size={16} />
              Connect Wallet
            </>
          )}
        </button>
      )}

      {/* ---------------- MODAL ---------------- */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            className="fixed inset-0 z-[10000] flex items-start justify-end pt-24 pr-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowModal(false)}
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              className="relative w-[92%] max-w-sm md:w-[360px] bg-neutral-950 border border-yellow-400/30 rounded-2xl shadow-2xl p-6"
              initial={{ x: 40, opacity: 0, scale: 0.98 }}
              animate={{ x: 0, opacity: 1, scale: 1 }}
              exit={{ x: 40, opacity: 0, scale: 0.98 }}
              transition={{ type: "spring", damping: 24, stiffness: 240 }}
            >
              {/* Close */}
              <button
                onClick={() => setShowModal(false)}
                className="absolute top-3 right-3 text-gray-500 hover:text-white transition"
              >
                <XIcon size={18} />
              </button>

              <h2 className="text-base font-semibold text-white mb-4">
                Connect Wallet
              </h2>

              <div className="flex flex-col gap-3">
                {/* Rabby / MetaMask / Coinbase */}
                <button
                  onClick={() =>
                    connect("injected").then(() => setShowModal(false))
                  }
                  disabled={isConnecting}
                  className="w-full py-2 rounded-lg bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-semibold flex items-center justify-center gap-2 transition-transform hover:scale-[1.02]"
                >
                  {isConnecting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Connecting...
                    </>
                  ) : (
                    <>
                      <Wallet size={16} /> Rabby / MetaMask / Coinbase
                    </>
                  )}
                </button>

                {/* WalletConnect (QR) */}
                <button
                  onClick={() =>
                    connect("walletconnect").then(() => setShowModal(false))
                  }
                  disabled={isConnecting}
                  className="w-full py-2 rounded-lg bg-gradient-to-r from-yellow-500 to-amber-500 text-black font-semibold flex items-center justify-center gap-2 transition-transform hover:scale-[1.02]"
                >
                  {isConnecting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Connecting...
                    </>
                  ) : (
                    <>
                      <Smartphone size={16} /> WalletConnect (QR)
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
