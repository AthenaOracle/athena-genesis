import { useState } from "react";
import { useWallet } from "../context/WalletContext";
import { useEnsName } from "../hooks/useEnsName";
import {
  Wallet,
  Check,
  XCircle,
  Loader2,
  LogOut,
  Smartphone,
} from "lucide-react";

/**
 * 🔹 WalletBanner — top bar for connection status and controls
 * Supports MetaMask, Rabby, and WalletConnect (Base Mainnet)
 */
export default function WalletBanner() {
  const {
    isConnected,
    connect,
    disconnect,
    isConnecting,
    account,
    isCorrectChain,
    providerType,
  } = useWallet();

  const { ensName, formatted } = useEnsName(account);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const displayName = ensName || formatted || "";

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      await disconnect();
    } finally {
      setIsDisconnecting(false);
    }
  };

  // ----------------------------------------------------
  //  🔹 Not Connected
  // ----------------------------------------------------
  if (!isConnected) {
    return (
      <div className="text-center py-3 px-4 bg-black/30 border-b border-white/10 flex flex-col sm:flex-row justify-center gap-3">
        <button
          onClick={() => connect("injected")}
          disabled={isConnecting}
          className="inline-flex items-center gap-2 text-sm px-5 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:opacity-70 rounded-xl font-semibold transition shadow-lg"
        >
          {isConnecting ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <Wallet size={16} />
              Connect MetaMask / Rabby
            </>
          )}
        </button>

        <button
          onClick={() => connect("walletconnect")}
          disabled={isConnecting}
          className="inline-flex items-center gap-2 text-sm px-5 py-2 bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-500 hover:to-teal-500 disabled:opacity-70 rounded-xl font-semibold transition shadow-lg"
        >
          {isConnecting ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <Smartphone size={16} />
              WalletConnect
            </>
          )}
        </button>
      </div>
    );
  }

  // ----------------------------------------------------
  //  🔹 Connected Banner
  // ----------------------------------------------------
  return (
    <div className="text-center py-3 px-4 bg-black/30 border-b border-white/10 flex flex-col sm:flex-row items-center justify-center gap-3 flex-wrap text-sm">
      {/* Network Status */}
      <div className="flex items-center gap-2">
        {isCorrectChain ? (
          <Check size={14} className="text-green-400" />
        ) : (
          <XCircle size={14} className="text-red-400" />
        )}
        <span className="text-gray-400">
          {isCorrectChain ? "Base Mainnet" : "Wrong Network"}
        </span>
      </div>

      {/* ENS or Address */}
      <span className="font-mono text-yellow-400 truncate max-w-[160px]">
        {displayName}
      </span>

      {/* Provider Type */}
      <span className="text-gray-500 italic text-xs">
        {providerType === "walletconnect"
          ? "via WalletConnect"
          : "via MetaMask"}
      </span>

      {/* Disconnect */}
      <button
        onClick={handleDisconnect}
        disabled={isDisconnecting}
        className="text-gray-400 hover:text-red-400 transition flex items-center gap-1 text-xs"
      >
        {isDisconnecting ? (
          <Loader2 size={12} className="animate-spin" />
        ) : (
          <LogOut size={12} />
        )}
        Disconnect
      </button>
    </div>
  );
}
