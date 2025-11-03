import React, { useEffect, useState, Suspense } from "react";
import { useLocation, useNavigate, Routes, Route } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { useWallet } from "./context/WalletContext";
import { pages } from "./config/pages";
import { MANIFESTO_IPFS } from "./config/config";
import ManifestoModal from "./components/ManifestoModal";
import WalletBanner from "./components/WalletBanner";

export default function App() {
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showManifesto, setShowManifesto] = useState(false);
  const [nextPulseCountdown, setNextPulseCountdown] = useState("—");
  const [oracleCount, setOracleCount] = useState(10);
  const { isConnected } = useWallet();
  const location = useLocation();
  const navigate = useNavigate();

  // 🔹 Initial loading splash
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  // 🔹 Mock pulse timer
  useEffect(() => {
    let seconds = 83 * 60;
    const interval = setInterval(() => {
      seconds--;
      if (seconds <= 0) seconds = 4 * 60 * 60;
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      setNextPulseCountdown(`${h}h ${m.toString().padStart(2, "0")}m`);
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-black text-white">
        <svg
          width="100"
          height="100"
          viewBox="0 0 100 100"
          fill="none"
          className="animate-spin-slow"
        >
          <path
            d="M50 85 L85 15 L15 15 Z"
            stroke="url(#glow)"
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <defs>
            <linearGradient id="glow" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#facc15" />
              <stop offset="100%" stopColor="#00e0ff" />
            </linearGradient>
          </defs>
        </svg>
        <p className="mt-6 text-sm tracking-[0.25em] text-amber-300/80 uppercase animate-pulse">
          Initializing Athena Engine...
        </p>
      </div>
    );
  }

  return (
    <>
      <div
        className="min-h-screen w-full text-white font-satoshi overflow-x-hidden"
        style={{
          background: `
            radial-gradient(circle at 50% 20%, rgba(250,204,21,0.06) 0%, transparent 60%),
            linear-gradient(135deg, #050505 0%, #0b0b0d 100%)
          `,
        }}
      >
        {/* 🔹 Header */}
        <header className="sticky top-0 z-40 backdrop-blur-md bg-gradient-to-b from-[#070c08] via-[#0b0f0b] to-black shadow-[0_0_25px_rgba(250,204,21,0.04)]">
          <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 py-4 flex items-center justify-between">
            {/* Logo */}
            <div
              onClick={() => navigate("/")}
              aria-label="Athena Home"
              className="flex items-center gap-3 cursor-pointer hover:scale-105 transition-transform"
            >
              <svg
                width="38"
                height="38"
                viewBox="0 0 100 100"
                fill="none"
                className="drop-shadow-lg"
              >
                <path
                  d="M50 85 L85 15 L15 15 Z"
                  fill="none"
                  stroke="#facc15"
                  strokeWidth="4"
                  className="filter drop-shadow-[0_0_6px_#facc15]"
                />
              </svg>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-white">
                  ATHENA
                </h1>
                <p className="text-[10px] tracking-[0.25em] text-amber-400/70 font-medium -mt-1">
                  TRUTH ENGINE
                </p>
              </div>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center justify-center flex-1 gap-6">
              {pages.map(({ name, path, requiresWallet }) => {
                const active = location.pathname === path;
                const disabled = requiresWallet && !isConnected;
                return (
                  <button
                    key={path}
                    onClick={() => {
                      if (!disabled) navigate(path);
                    }}
                    disabled={disabled}
                    className={`text-sm font-medium tracking-wide transition ${
                      active
                        ? "text-amber-300"
                        : disabled
                        ? "text-gray-600 cursor-not-allowed"
                        : "text-amber-400 hover:text-yellow-300"
                    }`}
                  >
                    {name}
                  </button>
                );
              })}
              <span className="text-xs text-amber-300 font-semibold ml-4">
                Next Pulse: {nextPulseCountdown} ⏳
              </span>
            </nav>

            {/* Wallet */}
            <div className="hidden md:flex items-center ml-6">
              <WalletBanner minimal />
            </div>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-white/10 transition"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </header>

        {/* 🔹 Mobile Menu */}
        {mobileMenuOpen && (
          <div className="fixed right-0 top-0 h-full w-3/4 bg-black/95 backdrop-blur-md flex flex-col items-center justify-center space-y-8 z-50">
            {pages.map(({ name, path, requiresWallet }) => {
              const disabled = requiresWallet && !isConnected;
              return (
                <button
                  key={path}
                  onClick={() => {
                    if (!disabled) {
                      navigate(path);
                      setMobileMenuOpen(false);
                    }
                  }}
                  disabled={disabled}
                  className={`text-xl font-light ${
                    disabled
                      ? "text-gray-600 cursor-not-allowed"
                      : "text-amber-400 hover:text-yellow-300"
                  }`}
                >
                  {name}
                </button>
              );
            })}
            <button
              onClick={() => setShowManifesto(true)}
              className="px-8 py-3 rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-bold text-lg shadow-md"
            >
              Manifesto
            </button>
            <div className="pt-4">
              <WalletBanner minimal />
            </div>
          </div>
        )}

        {/* 🔹 Page content */}
        <main className="max-w-6xl mx-auto px-6 sm:px-10 lg:px-16 py-8 w-full space-y-20">
          <Suspense fallback={<p className="text-amber-400">Loading...</p>}>
            <Routes>
              {pages.map(({ path, component: Component }) => (
                <Route key={path} path={path} element={<Component />} />
              ))}
            </Routes>
          </Suspense>
        </main>

        {/* 🔹 Footer */}
        <footer className="bg-gradient-to-t from-[#070c08] via-[#0b0f0b] to-black backdrop-blur-md pt-6 pb-6 text-center text-xs text-gray-400 w-full shadow-[0_0_25px_rgba(250,204,21,0.04)]">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-2">
            {[
              { label: "GitHub", href: "https://github.com/AthenaProtocol" },
              { label: "X", href: "https://x.com/AthenaIsTruth" },
              { label: "Discord", href: "https://discord.gg/5SECf3KTKH" },
            ].map((item) => (
              <a
                key={item.label}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="footer-link text-amber-400 hover:text-yellow-300 transition"
              >
                {item.label}
              </a>
            ))}
          </div>

          <p>
            Powered by{" "}
            <span className="text-amber-400 font-medium">▽ Athena Protocol</span>{" "}
            • © 2025
          </p>
          <p className="mt-1 text-amber-400/80">
            Oracles: {oracleCount}/10 Active
          </p>
        </footer>
      </div>

      {/* 🔹 Manifesto Modal */}
      <ManifestoModal
        open={showManifesto}
        onClose={() => setShowManifesto(false)}
        ipfsUrl={MANIFESTO_IPFS}
      />
    </>
  );
}
