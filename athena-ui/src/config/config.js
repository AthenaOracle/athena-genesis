// src/config/config.js

export const CONFIG_VERSION = "2.4.1";
export const UI_VERSION = "v2.4.1";
export const MANIFESTO_IPFS = "ipfs://athena-genesis-manifesto-v1.0";

// 🧠 Global App Metadata
export const APP_INFO = {
  name: "Athena",
  description:
    "Autonomous oracle and analytics layer for decentralized truth computation.",
  network: "Base Mainnet",
  chainId: 8453,
};

// 💎 Core Contracts (Base Mainnet)
export const CONTRACTS = {
  token: "0x72F64821ca2c8117890BF6c9172977865f809f64", // $ATA
  rewardClaim: "0xB4D87AAe272713CB4a24Ed2ac1E43dc2d32FbD91", // RewardClaim v2
  treasury: "0xb36E25842C2C5ae91586988475E857F4D9643e9A", // Treasury Multisig
};

// 🪙 Tokenomics (v2.4 Truth Bounty Model)
export const TOKENOMICS = {
  totalSupply: 21_000_000,
  distribution: {
    agentRewards: 0.8, // includes Truth Bounty
    treasury: 0.15,
    systemReserve: 0.05,
  },
  epochLengthDays: 7,
  truthBounty: {
    enabled: true,
    poolPercent: 0.1, // 10% of rewards set aside
    description:
      "Agents with above-average truth accuracy receive a bounty multiplier from the epoch reward pool.",
  },
  notes: [
    "Burn mechanism removed to enhance early participation incentives.",
    "Treasury melts 0.5% each epoch into rewards.",
    "Emergency mint capped at 0.1% per month by multisig vote.",
  ],
};

// 🧩 External Resources
export const LINKS = {
  baseScan: "https://basescan.org",
  github: "https://github.com/AthenaProtocol",
  x: "https://x.com/AthenaIsTruth",
  discord: "https://discord.gg/5SECf3KTKH",
};

