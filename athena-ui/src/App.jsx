import { useState, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useWallet } from "./context/WalletContext";
import { pages } from "./config/pages";
import { CONFIG_VERSION, UI_VERSION, MANIFESTO_IPFS } from "./config/config";
import ManifestoModal from "./components/ManifestoModal";
import WalletBanner from "./components/WalletBanner";
import { Menu, X, Sparkles } from "lucide-react";

export default function App() {
  const [currentPage, setCurrentPage] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showManifesto, setShowManifesto] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  const { isConnected } = useWallet();
  const PageComponent = pages[currentPage].component;

  // 🧠 Dynamic Title
  useEffect(() => {
    document.title = `△ Athena — ${pages[currentPage].name}`;
  }, [currentPage]);

  // 🔐 Wallet Navigation Guard
  const handleNav = (index) => {
    const page = pages[index];
    if (page.requiresWallet && !isConnected) {
      console.warn("Connect wallet to access this realm.");
      return;
    }
    setCurrentPage(index);
    setMobileMenuOpen(false);
  };

  // 🌀 Page Motion Variants
  const pageVariants = {
    enter: { opacity: 0, y: prefersReducedMotion ? 0 : 16 },
    center: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: prefersReducedMotion ? 0 : -16 },
  };

  return (
    <>
      {/* 🔹 Wallet Bar */}
      <WalletBanner />

      {/* 🌌 COSMIC CANVAS */}
      <div
        className="min-h-screen w-full text-white font-['Satoshi'] overflow-x-hidden"
        style={{
          background: `
            radial-gradient(circle at 50% 20%, rgba(250,204,21,0.06) 0%, transparent 60%),
            linear-gradient(135deg, #050505 0%, #0b0b0d 100%)
          `,
        }}
      >
        {/* △ HEADER / NAVBAR */}
        <header className="sticky top-0 z-40 border-b border-white/10 backdrop-blur-xl bg-black/80 w-full">
          <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 py-4 flex items-center justify-between w-full">
            {/* LOGO */}
            <motion.a
              href="/"
              className="flex items-center gap-3 flex-shrink-0"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              aria-label="Athena Oracle Home"
            >
              <svg width="38" height="38" viewBox="0 0 100 100" fill="none" className="drop-shadow-lg">
                <path
                  d="M50 15 L85 85 L15 85 Z"
                  fill="none"
                  stroke="url(#gold-gradient)"
                  strokeWidth="4"
                />
                <path
                  d="M50 85 L70 65 L30 65 Z"
                  fill="url(#gold-gradient)"
                  opacity="0.3"
                />
                <defs>
                  <linearGradient id="gold-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#facc15" />
                    <stop offset="100%" stopColor="#fbbf24" />
                  </linearGradient>
                </defs>
              </svg>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-white">ATHENA</h1>
                <p className="text-[10px] tracking-[0.25em] text-amber-400/70 font-medium -mt-1">
                  ORACLE ENGINE
                </p>
              </div>
            </motion.a>

            {/* DESKTOP NAV */}
            <nav className="hidden md:flex items-center gap-1 flex-1 justify-center">
              {pages.map((p, i) => (
                <motion.button
                  key={i}
                  onClick={() => handleNav(i)}
                  className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all relative overflow-hidden ${
                    currentPage === i
                      ? "text-amber-400"
                      : "text-gray-300 hover:text-white"
                  }`}
                  whileHover={{ backgroundColor: "rgba(251, 191, 36, 0.08)" }}
                  whileTap={{ scale: 0.95 }}
                >
                  <span className="flex items-center gap-2">
                    {p.icon && <p.icon size={15} />}
                    {p.name}
                  </span>
                  {currentPage === i && (
                    <motion.div
                      layoutId="activePill"
                      className="absolute inset-0 rounded-full bg-amber-400/10"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                </motion.button>
              ))}
              <motion.button
                onClick={() => setShowManifesto(true)}
                className="ml-3 px-5 py-2.5 rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 text-black text-sm font-semibold flex items-center gap-1.5 shadow-lg"
                whileHover={{
                  scale: 1.05,
                  boxShadow: "0 0 20px rgba(251, 191, 36, 0.4)",
                }}
                whileTap={{ scale: 0.95 }}
              >
                <Sparkles size={15} />
                Manifesto
              </motion.button>
            </nav>

            {/* MOBILE MENU BUTTON */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-white/10 transition ml-auto"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </header>

        {/* 📱 MOBILE NAV OVERLAY */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl md:hidden flex flex-col items-center justify-center space-y-8 px-4"
            >
              {pages.map((p, i) => (
                <motion.button
                  key={i}
                  onClick={() => handleNav(i)}
                  className="text-xl font-light text-gray-300 hover:text-amber-400 transition text-center w-full max-w-xs py-3"
                  whileHover={{ x: 10 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {p.name}
                </motion.button>
              ))}
              <motion.button
                onClick={() => {
                  setShowManifesto(true);
                  setMobileMenuOpen(false);
                }}
                className="px-8 py-3 rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-bold text-lg w-full max-w-xs"
                whileTap={{ scale: 0.95 }}
              >
                Reveal the Manifesto
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* MAIN CONTENT */}
        <main className="max-w-6xl mx-auto px-6 sm:px-10 lg:px-16 py-20 w-full space-y-20 fade-in">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentPage}
              variants={pageVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: prefersReducedMotion ? 0 : 0.3 }}
            >
              <PageComponent />
            </motion.div>
          </AnimatePresence>
        </main>

        {/* FOOTER */}
        <footer className="mt-32 border-t border-white/10 pt-10 pb-10 text-center text-xs text-gray-500 w-full">
          <p>
            Powered by <span className="text-amber-400 font-medium">△ Athena Protocol</span> • © 2025
          </p>
          <p className="mt-1">
            Config v{CONFIG_VERSION} • UI v{UI_VERSION}
          </p>
        </footer>
      </div>

      {/* MANIFESTO MODAL */}
      <ManifestoModal
        open={showManifesto}
        onClose={() => setShowManifesto(false)}
        ipfsUrl={MANIFESTO_IPFS}
      />
    </>
  );
}
