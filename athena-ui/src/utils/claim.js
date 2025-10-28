/**
 * @file claim.js
 * @description Handles ATA reward claims, verification, and status checks via Viem (Base network).
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

// 🪙 Contract: RewardClaim.sol
export const CONTRACT_ADDRESS = "0x16DEEC9B1Bc2F95b75CA09BD2585aD2C66CdeCdC";

// ---------------------------------------------------------------------------
// 🔹 Shared Clients
// ---------------------------------------------------------------------------
export const publicClient = createPublicClient({
  chain: base,
  transport: custom(window.ethereum || null),
});

// ---------------------------------------------------------------------------
// 🔸 Network Guard
// ---------------------------------------------------------------------------
/**
 * Ensures the connected wallet is on Base Mainnet (chainId 8453 / 0x2105).
 * Prompts the user to switch networks if needed.
 */
export async function ensureBaseNetwork() {
  if (!window.ethereum) throw new Error("No wallet provider detected");
  const chainId = await window.ethereum.request({ method: "eth_chainId" });
  if (chainId !== "0x2105") {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0x2105" }],
    });
  }
}

// ---------------------------------------------------------------------------
// 🔸 Verify Merkle Proof (local utility)
// ---------------------------------------------------------------------------
/**
 * Verifies a Merkle proof locally for off-chain validation before claim.
 * @param {string} leaf - The computed keccak256 leaf.
 * @param {string[]} proof - Array of proof nodes.
 * @param {string} root - Merkle root for the epoch.
 * @returns {boolean}
 */
export function verifyProofLocally(leaf, proof, root) {
  try {
    if (!leaf || !proof || !root) return false;
    let computed = leaf;
    for (const p of proof) {
      computed =
        computed < p
          ? `0x${keccak256(`${computed}${p}`).slice(2)}`
          : `0x${keccak256(`${p}${computed}`).slice(2)}`;
    }
    return computed.toLowerCase() === root.toLowerCase();
  } catch (err) {
    console.warn("⚠️ Local proof verification failed:", err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// 🔸 Estimate Claim Gas
// ---------------------------------------------------------------------------
/**
 * Estimates gas for a given claim transaction.
 * @param {number|string} epoch - Epoch number
 * @param {string|number} amount - ATA amount (human-readable)
 * @param {string[]} proof - Merkle proof
 * @returns {Promise<number>} Estimated gas limit
 */
export async function estimateClaimGas(epoch, amount, proof) {
  if (!window.ethereum) throw new Error("No wallet provider detected");
  await ensureBaseNetwork();

  const client = createWalletClient({
    chain: base,
    transport: custom(window.ethereum),
  });

  const [account] = await client.requestAddresses();
  const amountWei = parseEther(String(amount));

  try {
    const contract = getContract({
      address: CONTRACT_ADDRESS,
      abi: RewardClaimABI,
      client,
    });
    const gas = await contract.estimateGas.claim([epoch, amountWei, proof], {
      account,
    });
    console.log(`⛽ Estimated gas: ${gas}`);
    return Number(gas);
  } catch (err) {
    console.warn("⚠️ Gas estimation failed:", err);
    return 0;
  }
}

// ---------------------------------------------------------------------------
// 🔸 Claim Reward
// ---------------------------------------------------------------------------
/**
 * Executes the on-chain claim() function for eligible addresses.
 * @param {Object} params
 * @param {number|string} params.epoch - Epoch number
 * @param {string|number} params.amount - ATA amount (e.g. "12.3456")
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

// ---------------------------------------------------------------------------
// 🔸 Check Claimed Status
// ---------------------------------------------------------------------------
/**
 * Checks if a wallet has already claimed rewards for a specific epoch.
 * @param {string} wallet - Address to check
 * @param {number|string} epoch - Epoch number
 * @returns {Promise<boolean>}
 */
export async function checkClaimed(wallet, epoch) {
  if (!wallet || epoch === undefined) throw new Error("Missing wallet or epoch");

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
