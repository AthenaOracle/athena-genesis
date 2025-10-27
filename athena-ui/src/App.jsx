import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "./context/WalletContext";
import { pages } from "./config/pages";
import { CONFIG_VERSION, UI_VERSION, MANIFESTO_IPFS } from "./config/config";
import ManifestoModal from "./components/ManifestoModal";
import WalletBanner from "./components/WalletBanner";
import { Menu, X } from "lucide-react";

export default function App() {
  const [currentPage, setCurrentPage] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showManifesto, setShowManifesto] = useState(false);
  const PageComponent = pages[currentPage].component;

  const { isConnected } = useWallet();

  // 🧠 Dynamic tab title
  useEffect(() => {
    document.title = `Athena — ${pages[currentPage].name}`;
  }, [currentPage]);

  // 🛡️ Wallet gating for restricted routes
  const handleNav = (index) => {
    const page = pages[index];
    if (page.requiresWallet && !isConnected) {
      alert("Please connect your wallet to access this page.");
      return;
    }
    setCurrentPage(index);
    setMobileMenuOpen(false);
  };

  return (
    <>
      {/* Wallet Banner */}
      <WalletBanner />

      <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-black to-purple-950 text-white">
        {/* Header */}
        <header className="border-b border-white/10 backdrop-blur-md bg-black/40 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            {/* Logo + Title */}
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="flex items-center gap-3"
            >
              <img
                src="/logo.svg"
                alt="Athena Oracle"
                className="w-9 h-9 logo-glow drop-shadow-md"
              />
              <h1 className="text-xl font-bold bg-gradient-to-r from-yellow-400 to-amber-600 bg-clip-text text-transparent">
                Athena Oracle
              </h1>
            </motion.div>

            {/* Desktop Nav */}
            <nav className="hidden md:flex gap-1">
              {pages.map((p, i) => (
                <button
                  key={i}
                  onClick={() => handleNav(i)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${
                    currentPage === i
                      ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/50"
                      : "hover:bg-white/10"
                  }`}
                >
                  {p.icon && <p.icon size={16} />}
                  {p.name}
                </button>
              ))}
              <button
                onClick={() => setShowManifesto(true)}
                className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/10 transition"
              >
                About
              </button>
            </nav>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </header>

        {/* Mobile Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md md:hidden"
            >
              <div className="p-6 space-y-3">
                {pages.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => handleNav(i)}
                    className="block w-full text-left p-4 rounded-xl bg-white/5 hover:bg-white/10 text-lg font-medium"
                  >
                    {p.name}
                  </button>
                ))}
                <button
                  onClick={() => {
                    setShowManifesto(true);
                    setMobileMenuOpen(false);
                  }}
                  className="block w-full text-left p-4 rounded-xl bg-white/5 hover:bg-white/10 text-lg font-medium"
                >
                  About Athena
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 py-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentPage}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              <PageComponent />
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Footer */}
        <footer className="mt-16 pb-8 text-center text-xs text-gray-500">
          <p>
            Powered by <span className="text-yellow-400">Athena Protocol</span> • © 2025
          </p>
          <p className="mt-1">
            <a
              href="https://github.com/yourname/athena-ui"
              target="_blank"
              className="underline hover:text-yellow-400"
            >
              Fork on GitHub
            </a>
          </p>
          {/* 🔹 Config + UI version display */}
          <p className="mt-1 text-[10px] opacity-70">
            Config v{CONFIG_VERSION} • UI v{UI_VERSION}
          </p>
        </footer>
      </div>

      {/* Manifesto Modal */}
      <ManifestoModal
        open={showManifesto}
        onClose={() => setShowManifesto(false)}
        ipfsUrl={MANIFESTO_IPFS}
      />
    </>
  );
}
