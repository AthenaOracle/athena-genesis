// src/hooks/useEnsName.js
import { useQuery } from "@tanstack/react-query";
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";

const client = createPublicClient({ chain: mainnet, transport: http() });

export function useEnsName(address) {
  return useQuery({
    queryKey: ["ens", address],
    queryFn: async () => {
      if (!address) return null;
      try {
        return await client.getEnsName({ address });
      } catch {
        return null;
      }
    },
    enabled: !!address,
    staleTime: 3600_000,
  });
}