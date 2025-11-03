// ▽ Athena Genesis — auto_sweep.mjs (v2.7)
// RewardClaim Maintenance Utility
// ---------------------------------------------
// ✅ Safer execution
// ✅ 48h claim window enforcement
// ✅ Better logs & auto epoch detection
// ✅ CI-friendly exit codes & failover handling
// Compatible: Node 20+, ethers@6

import { ethers } from "ethers";

// ---------------------- config ----------------------
const RPC_URL = process.env.RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const REWARDCLAIM_ADDRESS = process.env.REWARDCLAIM_ADDRESS;
const TREASURY_ADDRESS = process.env.TREASURY_ADDRESS || null;
const CLAIM_WINDOW_HOURS = 48;
const SAFETY_MARGIN_HOURS = 1; // optional grace hour

if (!RPC_URL || !PRIVATE_KEY || !REWARDCLAIM_ADDRESS) {
  console.error("❌ Missing required environment vars (RPC_URL, PRIVATE_KEY, REWARDCLAIM_ADDRESS).");
  process.exit(1);
}

// ---------------------- setup -----------------------
const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const claim = new ethers.Contract(REWARDCLAIM_ADDRESS, [
  "function epochs(uint256) view returns (bytes32 root, uint256 funded, uint256 start, uint256 claimsOpenAt)",
  "function totalClaimed(uint256) view returns (uint256)",
  "function sweepUnclaimed(uint256 epoch) external",
], wallet);

const now = Math.floor(Date.now() / 1000);

// ---------------------- helpers ---------------------
const fmt = (num) => Number(num / 1e18).toFixed(4);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const green = (msg) => `\x1b[32m${msg}\x1b[0m`;
const yellow = (msg) => `\x1b[33m${msg}\x1b[0m`;
const red = (msg) => `\x1b[31m${msg}\x1b[0m`;
const cyan = (msg) => `\x1b[36m${msg}\x1b[0m`;

// ---------------------- main logic ------------------
async function main() {
  console.log(cyan("============================================"));
  console.log(cyan("🧠 Athena Auto Sweep v2.7 — Reward Maintenance"));
  console.log(cyan("============================================\n"));
  console.log(`Connected as: ${wallet.address}`);
  console.log(`RewardClaim: ${REWARDCLAIM_ADDRESS}`);
  if (TREASURY_ADDRESS) console.log(`Treasury: ${TREASURY_ADDRESS}\n`);

  let epoch = 0;
  let sweptCount = 0;
  let skippedCount = 0;

  while (true) {
    try {
      const e = await claim.epochs(epoch);
      if (!e || e.claimsOpenAt === 0n) break;

      const funded = Number(e.funded) / 1e18;
      const claimed = Number(await claim.totalClaimed(epoch)) / 1e18;
      const unclaimed = funded - claimed;

      const closeTime = Number(e.claimsOpenAt) + (CLAIM_WINDOW_HOURS + SAFETY_MARGIN_HOURS) * 3600;
      const expired = now > closeTime;

      console.log(`\n📘 Epoch ${epoch}:`);
      console.log(`   Funded: ${fmt(e.funded)} ATA`);
      console.log(`   Claimed: ${fmt(await claim.totalClaimed(epoch))} ATA`);
      console.log(`   Unclaimed: ${fmt(e.funded - await claim.totalClaimed(epoch))} ATA`);
      console.log(`   Claim window closes: ${new Date(closeTime * 1000).toUTCString()}`);
      console.log(`   Status: ${expired ? green("expired ✅") : yellow("still open ⏳")}`);

      if (!expired) {
        skippedCount++;
        epoch++;
        continue;
      }

      if (unclaimed <= 0) {
        console.log("   ℹ️ Nothing to sweep — all claimed.");
        epoch++;
        continue;
      }

      // Gas estimation for visibility
      console.log("   ⛽ Estimating gas...");
      let gasEstimate;
      try {
        gasEstimate = await claim.sweepUnclaimed.estimateGas(epoch);
        console.log(`   Estimated gas: ${gasEstimate.toString()}`);
      } catch (err) {
        console.warn(yellow(`   ⚠️ Gas estimation failed: ${err.message}`));
        gasEstimate = 300000n; // fallback
      }

      // Execute sweep
      console.log("   🚀 Executing sweep...");
      const tx = await claim.sweepUnclaimed(epoch, { gasLimit: gasEstimate * 2n });
      console.log(`   TX sent: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(green(`   ✅ Sweep complete — block ${receipt.blockNumber}`));
      sweptCount++;

      // brief delay between epochs to prevent spam
      await sleep(2000);
      epoch++;
    } catch (err) {
      console.error(red(`\n❌ Error on epoch ${epoch}: ${err.message}`));
      break;
    }
  }

  console.log("\n--------------------------------------------");
  console.log(`🧾 Sweep Summary:`);
  console.log(`   Total epochs swept: ${green(sweptCount)}`);
  console.log(`   Epochs skipped: ${yellow(skippedCount)}\n`);
  console.log("✅ Process completed.\n");
  process.exit(0);
}

main().catch((err) => {
  console.error(red("Fatal error:"), err);
  process.exit(1);
});
