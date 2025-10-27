// src/context/WalletContext.jsx
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { createWalletClient, custom } from "viem";
import { base } from "viem/chains";

// ---------------------------
// Constants
// ---------------------------
const WalletContext = createContext({});
const BASE_CHAIN_ID = 8453; // Base Mainnet Chain ID

// ---------------------------
// Provider Component
// ---------------------------
export function WalletProvider({ children }) {
  const [account, setAccount] = useState(null);
  const [client, setClient] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);

  // ---------------------------
  // Auto-Reconnect (on page load)
  // ---------------------------
  const reconnect = useCallback(async () => {
    const stored = localStorage.getItem("athena-wallet");
    if (!stored || !window.ethereum) return;

    try {
      const walletClient = createWalletClient({
        chain: base,
        transport: custom(window.ethereum),
      });

      const [addr] = await walletClient.getAddresses();
      let chainId;
      try {
        chainId = await walletClient.getChainId();
      } catch {
        chainId = BASE_CHAIN_ID; // fallback if RPC fails
      }

      if (chainId === BASE_CHAIN_ID && addr?.toLowerCase() === stored.toLowerCase()) {
        setAccount(addr);
        setClient(walletClient);
      }
    } catch (err) {
      console.warn("Auto-reconnect failed:", err);
    }
  }, []);

  // ---------------------------
  // Connect wallet
  // ---------------------------
  const connect = async () => {
    if (!window.ethereum) {
      setError("Please install MetaMask or Rabby.");
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const walletClient = createWalletClient({
        chain: base,
        transport: custom(window.ethereum),
      });

      const [addr] = await walletClient.requestAddresses();

      let chainId;
      try {
        chainId = await walletClient.getChainId();
      } catch {
        chainId = BASE_CHAIN_ID;
      }

      if (chainId !== BASE_CHAIN_ID) {
        setError("Please switch to Base network.");
        return;
      }

      setAccount(addr);
      setClient(walletClient);
      localStorage.setItem("athena-wallet", addr);
    } catch (err) {
      setError(err?.shortMessage || "Connection rejected.");
    } finally {
      setIsConnecting(false);
    }
  };

  // ---------------------------
  // Disconnect wallet
  // ---------------------------
  const disconnect = () => {
    setAccount(null);
    setClient(null);
    localStorage.removeItem("athena-wallet");
  };

  // ---------------------------
  // Ethereum event listeners
  // ---------------------------
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts) => {
      if (accounts.length === 0) {
        disconnect();
      } else if (accounts[0] !== account) {
        connect(); // reconnect to new account
      }
    };

    const handleChainChanged = (chainId) => {
      const parsedId = parseInt(chainId);
      if (parsedId !== BASE_CHAIN_ID) {
        setError("Wrong network. Please switch to Base.");
      } else {
        setError(null);
      }
    };

    const handleDisconnect = () => disconnect();

    // Register listeners
    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);
    window.ethereum.on("disconnect", handleDisconnect);

    // Delayed reconnect to prevent duplicate fires
    const timeout = setTimeout(() => reconnect(), 400);

    return () => {
      clearTimeout(timeout);
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener("chainChanged", handleChainChanged);
      window.ethereum.removeListener("disconnect", handleDisconnect);
    };
  }, [account, reconnect]);

  // ---------------------------
  // Exposed context values
  // ---------------------------
  const value = {
    account,
    client,
    connect,
    disconnect,
    isConnecting,
    error,
    isConnected: !!account,
    isCorrectChain: account && !error?.includes("network"),
  };

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}

// ---------------------------
// Hook shortcut
// ---------------------------
export const useWallet = () => useContext(WalletContext);
