// src/main.jsx
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WalletProvider } from "./context/WalletContext.jsx";
import { WagmiProvider, createConfig, http } from "wagmi";
import { base } from "wagmi/chains";
import { BrowserRouter } from "react-router-dom"; // ✅ add this

// Create global React Query client
const queryClient = new QueryClient();

// ✅ Create Wagmi config for Base Mainnet
const wagmiConfig = createConfig({
  chains: [base],
  transports: {
    [base.id]: http(),
  },
});

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {/* 🧠 Provides wagmi context to useAccount, useConfig, etc. */}
    <WagmiProvider config={wagmiConfig}>
      {/* ✅ Provides React Query to all hooks */}
      <QueryClientProvider client={queryClient}>
        {/* 💼 Provides wallet connection state to entire app */}
        <WalletProvider>
          {/* ✅ Wrap App in BrowserRouter so routing works */}
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </WalletProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
);
