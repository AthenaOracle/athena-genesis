// src/components/WalletBanner.jsx
import { useState } from "react";
import { useWallet } from "../context/WalletContext";
import { useEnsName } from "../hooks/useEnsName";
import { Wallet, Check, XCircle, Loader2, LogOut } from "lucide-react";

export default function WalletBanner() {
  const { isConnected, connect, disconnect, isConnecting, account, isCorrectChain } = useWallet();
  const { data: ensName } = useEnsName(account);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const displayName = ensName || (account ? `${account.slice(0, 6)}...${account.slice(-4)}` : "");

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      await disconnect();
    } finally {
      setIsDisconnecting(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="text-center py-3 px-4 bg-black/30 border-b border-white/10">
        <button
          onClick={connect}
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
              Connect Wallet
            </>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="text-center py-3 px-4 bg-black/30 border-b border-white/10 flex items-center justify-center gap-3 flex-wrap text-sm">
      {/* Status */}
      <div className="flex items-center gap-2">
        {isCorrectChain ? (
          <Check size={14} className="text-green-400" />
        ) : (
          <XCircle size={14} className="text-red-400" />
        )}
        <span className="text-gray-400">
          {isCorrectChain ? "Base" : "Wrong Network"}
        </span>
      </div>

      {/* Address / ENS */}
      <span className="font-mono text-yellow-400">
        {displayName}
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