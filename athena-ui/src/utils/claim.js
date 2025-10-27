/**
 * @file claim.js
 * @description Handles ATA reward claims and status checks via Viem (Base network).
 */

import {
  createWalletClient,
  custom,
  parseEther,
  createPublicClient,
  getContract,
} from "viem";
import { base } from "viem/chains";
import RewardClaimABI from "../abi/RewardClaimABI.json";

const CONTRACT_ADDRESS = "0x16DEEC9B1Bc2F95b75CA09BD2585aD2C66CdeCdC";

/* 🔹 Shared Clients */
const publicClient = createPublicClient({
  chain: base,
  transport: custom(window.ethereum || null),
});

/**
 * Ensures wallet is connected to Base network.
 * Prompts user if connected elsewhere.
 */
export async function ensureBaseNetwork() {
  if (!window.ethereum) throw new Error("No wallet provider detected");
  const chainId = await window.ethereum.request({ method: "eth_chainId" });
  if (chainId !== "0x2105") {
    // 0x2105 = Base Mainnet
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0x2105" }],
    });
  }
}

/**
 * Executes the on-chain claim() for an eligible wallet.
 * @param {Object} params
 * @param {number|string} params.epoch - Epoch number
 * @param {string|number} params.amount - Human-readable ATA amount (e.g., "12.3456")
 * @param {string[]} params.proof - Merkle proof array
 * @returns {Promise<string>} Transaction hash
 */
export async function claimReward({ epoch, amount, proof }) {
  if (!epoch || !amount || !Array.isArray(proof))
    throw new Error("Invalid or missing claim parameters");
  if (!window.ethereum) throw new Error("No wallet provider found");

  await ensureBaseNetwork();

  const client = createWalletClient({
    chain: base,
    transport: custom(window.ethereum),
  });

  const [account] = await client.requestAddresses();
  const amountWei = parseEther(String(amount));

  try {
    console.log(
      `🔹 Submitting claim for epoch ${epoch} from ${account} (${amount} ATA)`
    );

    const hash = await client.writeContract({
      address: CONTRACT_ADDRESS,
      abi: RewardClaimABI,
      functionName: "claim",
      args: [epoch, amountWei, proof],
      account,
    });

    console.log(`✅ Claim TX submitted: ${hash}`);
    return hash;
  } catch (err) {
    console.error("❌ Claim failed:", err);
    err.shortMessage ||= "Transaction failed — check gas, chain, or proof data";
    throw err;
  }
}

/**
 * Checks if a given wallet has already claimed rewards for a specific epoch.
 * @param {string} wallet - User address
 * @param {number|string} epoch - Epoch number
 * @returns {Promise<boolean>}
 */
export async function checkClaimed(wallet, epoch) {
  if (!wallet || !epoch) throw new Error("Missing wallet or epoch");
  try {
    const contract = getContract({
      address: CONTRACT_ADDRESS,
      abi: RewardClaimABI,
      client: publicClient,
    });

    const result = await contract.read.claimed([wallet, BigInt(epoch)]);
    console.log(`ℹ️ Claim status for ${wallet} (epoch ${epoch}):`, result);
    return Boolean(result);
  } catch (err) {
    console.error("⚠️ Failed to check claim status:", err);
    return false;
  }
}
