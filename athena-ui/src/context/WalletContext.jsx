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
import EthereumProvider from "@walletconnect/ethereum-provider";

// -------------------------------------------------------
// Constants
// -------------------------------------------------------
const WalletContext = createContext({});
const BASE_CHAIN_ID = 8453; // Base Mainnet Chain ID

// Replace with your own WalletConnect Project ID from https://cloud.walletconnect.com
const WC_PROJECT_ID = import.meta.env.VITE_WC_PROJECT_ID || "demo-project-id";

// -------------------------------------------------------
// Provider Component
// -------------------------------------------------------
export function WalletProvider({ children }) {
  const [account, setAccount] = useState(null);
  const [client, setClient] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [provider, setProvider] = useState(null); // MetaMask or WalletConnect

  // -------------------------------------------------------
  // Auto-Reconnect (on page load)
  // -------------------------------------------------------
  const reconnect = useCallback(async () => {
    const stored = localStorage.getItem("athena-wallet");
    if (!stored) return;

    try {
      // Try WalletConnect session first
      const wcSession = sessionStorage.getItem("walletconnect");
      if (wcSession) {
        const wc = await EthereumProvider.init({
          projectId: WC_PROJECT_ID,
          chains: [BASE_CHAIN_ID],
          showQrModal: false,
        });
        await wc.enable();

        const walletClient = createWalletClient({
          chain: base,
          transport: custom(wc),
        });

        const [addr] = await walletClient.getAddresses();
        setAccount(addr);
        setClient(walletClient);
        setProvider(wc);
        return;
      }

      // Else fallback to MetaMask
      if (!window.ethereum) return;
      const walletClient = createWalletClient({
        chain: base,
        transport: custom(window.ethereum),
      });
      const [addr] = await walletClient.getAddresses();
      setAccount(addr);
      setClient(walletClient);
      setProvider(window.ethereum);
    } catch (err) {
      console.warn("Auto-reconnect failed:", err);
    }
  }, []);

  // -------------------------------------------------------
  // Connect wallet (MetaMask or WalletConnect)
  // -------------------------------------------------------
  const connect = async (type = "injected") => {
    setIsConnecting(true);
    setError(null);

    try {
      let ethProvider;

      if (type === "walletconnect") {
        // 🔹 Create WalletConnect instance
        const wc = await EthereumProvider.init({
          projectId: WC_PROJECT_ID,
          chains: [BASE_CHAIN_ID],
          optionalChains: [BASE_CHAIN_ID],
          showQrModal: true,
        });
        await wc.enable();
        ethProvider = wc;
      } else {
        // 🔹 Default to MetaMask / Rabby
        if (!window.ethereum)
          throw new Error("Please install MetaMask or Rabby.");
        ethProvider = window.ethereum;
        await ethProvider.request({ method: "eth_requestAccounts" });
      }

      // 🔹 Create Viem client
      const walletClient = createWalletClient({
        chain: base,
        transport: custom(ethProvider),
      });

      const [addr] = await walletClient.requestAddresses();
      const chainId = await walletClient.getChainId();

      if (chainId !== BASE_CHAIN_ID) {
        setError("Please switch to Base network.");
        return;
      }

      setAccount(addr);
      setClient(walletClient);
      setProvider(ethProvider);
      localStorage.setItem("athena-wallet", addr);
    } catch (err) {
      console.error("❌ Connection failed:", err);
      setError(err.message || "Connection failed.");
    } finally {
      setIsConnecting(false);
    }
  };

  // -------------------------------------------------------
  // Disconnect wallet
  // -------------------------------------------------------
  const disconnect = async () => {
    try {
      if (provider?.disconnect) {
        await provider.disconnect();
      }
    } catch (err) {
      console.warn("Wallet disconnect error:", err);
    }
    setAccount(null);
    setClient(null);
    setProvider(null);
    localStorage.removeItem("athena-wallet");
    sessionStorage.removeItem("walletconnect");
  };

  // -------------------------------------------------------
  // Event listeners
  // -------------------------------------------------------
  useEffect(() => {
    if (!provider) return;

    const handleAccountsChanged = (accounts) => {
      if (!accounts.length) return disconnect();
      if (accounts[0] !== account) setAccount(accounts[0]);
    };

    const handleChainChanged = (chainId) => {
      const parsed = parseInt(chainId, 16) || chainId;
      if (parsed !== BASE_CHAIN_ID)
        setError("Wrong network. Please switch to Base.");
      else setError(null);
    };

    if (provider.on) {
      provider.on("accountsChanged", handleAccountsChanged);
      provider.on("chainChanged", handleChainChanged);
    }

    const timeout = setTimeout(() => reconnect(), 500);

    return () => {
      clearTimeout(timeout);
      if (provider.removeListener) {
        provider.removeListener("accountsChanged", handleAccountsChanged);
        provider.removeListener("chainChanged", handleChainChanged);
      }
    };
  }, [provider, account, reconnect]);

  // -------------------------------------------------------
  // Exposed context values
  // -------------------------------------------------------
  const value = {
    account,
    client,
    connect,
    disconnect,
    isConnecting,
    error,
    isConnected: !!account,
    isCorrectChain: account && !error?.includes("network"),
    providerType:
      provider === window.ethereum
        ? "injected"
        : provider
        ? "walletconnect"
        : null,
  };

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}

// -------------------------------------------------------
// Hook Shortcut
// -------------------------------------------------------
export const useWallet = () => useContext(WalletContext);
