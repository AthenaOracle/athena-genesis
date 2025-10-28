// src/hooks/useEnsName.js
import { useQuery } from "@tanstack/react-query";
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";

/**
 * 🧠 useEnsName — Resolves ENS name for a given address (with Base fallback)
 * Uses Ethereum Mainnet ENS resolver via viem.
 * If ENS not found, returns truncated address instead.
 */

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
});

/**
 * Utility: shortens an Ethereum/Base address for display
 * @param {string} address
 * @returns {string}
 */
export function truncateAddress(address) {
  if (!address || address.length < 10) return "";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/**
 * Hook: resolves ENS name (or returns shortened Base address)
 * @param {string} address - Wallet address
 * @returns {Object} { data, isLoading, error, formatted }
 */
export function useEnsName(address) {
  const query = useQuery({
    queryKey: ["ens", address],
    queryFn: async () => {
      if (!address) return null;
      try {
        const name = await client.getEnsName({ address });
        return name || null;
      } catch (err) {
        console.warn("ENS lookup failed:", err);
        return null;
      }
    },
    enabled: !!address,
    staleTime: 3600_000, // 1 hour cache
  });

  // Derived data
  const ensName = query.data;
  const formatted = ensName || truncateAddress(address);

  return {
    ...query,
    ensName,
    formatted, // Always safe to render
  };
}
