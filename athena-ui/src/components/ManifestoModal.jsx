import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, RefreshCw, AlertTriangle } from "lucide-react";

/**
 * ManifestoModal — v2.2
 * Displays Athena Manifesto from IPFS with graceful fallbacks and live status
 */
export default function ManifestoModal({ open, onClose, ipfsUrl }) {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retryKey, setRetryKey] = useState(0); // forces iframe reload

  // Reset state when reopened
  useEffect(() => {
    if (open) {
      setLoading(true);
      setFailed(false);
    }
  }, [open, retryKey]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose} // close on backdrop click
      >
        <motion.div
          className="bg-black/70 border border-white/10 rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl relative"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex justify-between items-center px-4 py-3 border-b border-white/10 bg-white/5">
            <h2 className="text-lg font-semibold text-yellow-400">Athena Manifesto</h2>
            <div className="flex items-center gap-2">
              {failed && (
                <button
                  onClick={() => setRetryKey((k) => k + 1)}
                  className="p-1 hover:bg-white/10 rounded-full transition"
                  title="Retry loading"
                >
                  <RefreshCw size={16} className="text-cyan-400" />
                </button>
              )}
              <button
                onClick={onClose}
                className="p-1 hover:bg-white/10 rounded-full transition"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="relative">
            {loading && !failed && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 text-sm bg-black/60 z-10">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                >
                  <RefreshCw size={22} className="text-yellow-400 mb-2" />
                </motion.div>
                Loading from IPFS...
              </div>
            )}

            {failed && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 text-sm bg-black/70 z-10 p-6 text-center">
                <AlertTriangle size={24} className="text-red-400 mb-2" />
                <p>Failed to load Manifesto from IPFS.</p>
                <p className="mt-1 opacity-75">Check your internet or gateway availability.</p>
                <button
                  onClick={() => setRetryKey((k) => k + 1)}
                  className="mt-4 px-4 py-2 text-sm font-medium bg-yellow-500/20 hover:bg-yellow-500/30 rounded-lg transition text-yellow-300"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Embedded IPFS document */}
            <iframe
              key={retryKey}
              src={ipfsUrl}
              title="Athena Manifesto"
              className="w-full h-[80vh] sm:h-[70vh] bg-black border-0"
              sandbox="allow-scripts allow-same-origin allow-popups"
              loading="lazy"
              onLoad={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                setFailed(true);
              }}
            />
          </div>

          {/* Footer */}
          <div className="p-3 text-center border-t border-white/10 text-sm text-gray-400">
            Powered by <span className="text-cyan-400">IPFS</span> •{" "}
            <span className="text-yellow-400">Immutable & Open</span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
