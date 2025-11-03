/**
 * @file claim.js
 * @description Handles ATA reward claims, verification, and status checks via Viem (Base network).
 */

import {
  createWalletClient,
  createPublicClient,
  getContract,
  parseEther,
  custom,
} from "viem";
import { base } from "viem/chains";
import RewardClaimABI from "../abi/RewardClaimABI.json";
import { CONTRACTS } from "../config/config";

// ---------------------------------------------------------------------------
// 🔹 Public + Wallet Clients
// ---------------------------------------------------------------------------
export const publicClient = createPublicClient({
  chain: base,
  transport: custom(window.ethereum || null),
});

// ---------------------------------------------------------------------------
// 🔸 Network Guard
// ---------------------------------------------------------------------------
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
// 🔸 Local Merkle Proof Check (optional)
// ---------------------------------------------------------------------------
export function verifyProofLocally(leaf, proof, root) {
  try {
    if (!leaf || !proof || !root) return false;
    let computed = leaf;
    for (const p of proof) {
      computed =
        computed.toLowerCase() < p.toLowerCase()
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
 * Estimates gas cost for a given claim() call.
 * @param {Object} params
 * @param {number|string} params.epoch - Epoch number
 * @param {string|number} params.amount - Human-readable ATA amount
 * @param {string[]} params.proof - Merkle proof array
 * @param {string} [params.contract] - Override contract address
 */
export async function estimateClaimGas({ epoch, amount, proof, contract }) {
  if (!window.ethereum) throw new Error("No wallet provider detected");
  await ensureBaseNetwork();

  const address = contract || CONTRACTS.rewardClaim;
  const client = createWalletClient({
    chain: base,
    transport: custom(window.ethereum),
  });

  const [account] = await client.requestAddresses();
  const amountWei = parseEther(String(amount));

  try {
    const c = getContract({
      address,
      abi: RewardClaimABI,
      client,
    });

    const gas = await c.estimateGas.claim([epoch, amountWei, proof], { account });
    const gasEth = Number(gas) * 0.000000001; // rough gwei -> ETH conversion
    const usd = (gasEth * 2500).toFixed(2); // approximate
    console.log(`⛽ Estimated gas: ${gas} (${gasEth} ETH ≈ $${usd})`);
    return { gas, eth: gasEth.toFixed(6), usd };
  } catch (err) {
    console.warn("⚠️ Gas estimation failed:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// 🔸 Claim Reward
// ---------------------------------------------------------------------------
/**
 * Executes on-chain claim() for the connected user.
 * @param {Object} params
 * @param {number|string} params.epoch
 * @param {string|number} params.amount
 * @param {string[]} params.proof
 * @param {string} [params.contract]
 * @returns {Promise<string>} Transaction hash
 */
export async function claimReward({ epoch, amount, proof, contract }) {
  if (!epoch || !amount || !Array.isArray(proof))
    throw new Error("Invalid claim parameters");
  if (!window.ethereum) throw new Error("No wallet provider found");

  await ensureBaseNetwork();

  const address = contract || CONTRACTS.rewardClaim;
  const client = createWalletClient({
    chain: base,
    transport: custom(window.ethereum),
  });

  const [account] = await client.requestAddresses();
  const amountWei = parseEther(String(amount));

  try {
    console.log(
      `🔹 Claiming epoch ${epoch} (${amount} ATA) from ${account} → ${address}`
    );

    const hash = await client.writeContract({
      address,
      abi: RewardClaimABI,
      functionName: "claim",
      args: [epoch, amountWei, proof],
      account,
    });

    console.log(`✅ TX submitted: ${hash}`);
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
export async function checkClaimed(wallet, epoch) {
  if (!wallet || epoch === undefined) throw new Error("Missing wallet or epoch");
  const contract = getContract({
    address: CONTRACTS.rewardClaim,
    abi: RewardClaimABI,
    client: publicClient,
  });

  try {
    const result = await contract.read.claimed([wallet, BigInt(epoch)]);
    console.log(`ℹ️ Claim status for ${wallet} (epoch ${epoch}):`, result);
    return Boolean(result);
  } catch (err) {
    console.error("⚠️ Failed to check claim status:", err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// 🔸 Read Truth Bounty Info (v2 support)
// ---------------------------------------------------------------------------
/**
 * Reads Truth Bounty pool parameters if supported by RewardClaim v2.
 * @returns {Promise<Object|null>}
 */
export async function getTruthBountyInfo() {
  try {
    const contract = getContract({
      address: CONTRACTS.rewardClaim,
      abi: RewardClaimABI,
      client: publicClient,
    });
    const [pool, eligible, avgBoost] = await Promise.all([
      contract.read.truthBountyPool?.() ?? 0n,
      contract.read.eligibleAgents?.() ?? 0n,
      contract.read.avgBoostPct?.() ?? 0n,
    ]);

    return {
      pool: Number(pool) / 1e18,
      eligibleAgents: Number(eligible),
      avgBoost: Number(avgBoost) / 100,
    };
  } catch (err) {
    console.warn("Truth bounty info unavailable:", err.message);
    return null;
  }
}
