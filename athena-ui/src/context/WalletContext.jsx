import { createContext, useContext } from "react";
import {
  useAccount,
  useConnect,
  useDisconnect,
} from "wagmi";
import {
  injected,
  walletConnect,
  coinbaseWallet,
} from "wagmi/connectors";

// 🧠 Athena Wallet Context (Wagmi-based)
export const WalletContext = createContext({});
export const useWallet = () => useContext(WalletContext);

/**
 * WalletProvider — handles all wallet connections and exposes clean state
 * Supports:
 *  - MetaMask (non-Rabby)
 *  - Rabby
 *  - Coinbase Wallet
 *  - WalletConnect (QR modal)
 */
export function WalletProvider({ children }) {
  const { address, isConnected, chainId } = useAccount();
  const { connectAsync, connectors, isPending } = useConnect({
    connectors: [
      // ---- Separate Rabby and MetaMask ----
      injected({
        target: (provider) => provider?.isMetaMask && !provider?.isRabby,
        shimDisconnect: true,
        name: "MetaMask",
      }),
      injected({
        target: (provider) => provider?.isRabby,
        shimDisconnect: true,
        name: "Rabby",
      }),
      coinbaseWallet({ appName: "Athena" }),
      walletConnect({
        projectId: "7b323dea483eaf89a30b2e36716992e2",
        showQrModal: true,
      }),
    ],
  });

  const { disconnectAsync } = useDisconnect();

  // ---- Connect helper ----
  const connect = async (name) => {
    const connector = connectors.find((c) =>
      c.name.toLowerCase().includes(name.toLowerCase())
    );
    if (!connector) throw new Error(`Connector not found: ${name}`);
    await connectAsync({ connector });
  };

  // ---- Disconnect helper ----
  const disconnect = async () => {
    try {
      await disconnectAsync();
    } catch (err) {
      console.warn("Wallet disconnect failed:", err);
    }
  };

  const isConnecting = isPending;
  const isCorrectChain = chainId === 8453; // Base mainnet

  return (
    <WalletContext.Provider
      value={{
        account: address,
        isConnected,
        isConnecting,
        connect,
        disconnect,
        isCorrectChain,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}
