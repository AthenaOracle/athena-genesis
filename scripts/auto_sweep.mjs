import { ethers } from "ethers";

console.log("=======================================");
console.log("🧠 Athena Auto Sweep — Unclaimed Rewards");
console.log("=======================================\n");

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

// minimal ABI (no JSON file needed)
const abi = [
  "function epochs(uint256) view returns (bytes32 root, uint256 funded, uint256 start, uint256 claimsOpenAt)",
  "function totalClaimed(uint256) view returns (uint256)",
  "function sweepUnclaimed(uint256 epoch) external",
];

const claim = new ethers.Contract(process.env.REWARDCLAIM_ADDRESS, abi, wallet);

async function main() {
  console.log(`Connected as: ${wallet.address}`);
  console.log(`Contract: ${process.env.REWARDCLAIM_ADDRESS}\n`);

  for (let epoch = 0; epoch <= 20; epoch++) {
    const e = await claim.epochs(epoch);
    if (e.claimsOpenAt == 0n) continue;

    const funded = Number(e.funded) / 1e18;
    const claimed = Number(await claim.totalClaimed(epoch)) / 1e18;
    const unclaimed = funded - claimed;

    const claimWindow = Number(e.claimsOpenAt) + 48 * 60 * 60;
    const now = Math.floor(Date.now() / 1000);

    console.log(`🧾 Epoch ${epoch}: funded ${funded} ATA, claimed ${claimed} ATA, unclaimed ${unclaimed} ATA`);
    if (now > claimWindow) {
      console.log(`🧹 Sweep available — attempting...`);
      try {
        const tx = await claim.sweepUnclaimed(epoch);
        await tx.wait();
        console.log(`✅ Swept epoch ${epoch} | TX: ${tx.hash}\n`);
      } catch (err) {
        console.error(`❌ Sweep failed epoch ${epoch}:`, err.message);
      }
    } else {
      console.log(`⏳ Epoch ${epoch} still in claim window\n`);
    }
  }
}

main().catch(err => console.error("Fatal:", err));
