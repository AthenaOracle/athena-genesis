Network: Base (Chain ID 8453)

Token Name / Ticker: Athena / $ATA

Total Supply: 21,000,000 ATA

Treasury Reserve: 19,000,000 ATA (locked in Treasury wallet for long-term emission)

Deployer Balance: 2,000,000 ATA (operational + early epoch funding)

Epoch Length: ≈ 7 days

Reward Split: 60% agents / 20% burn / 20% treasury top-up

Treasury Cap: 1,000,000 ATA

Emergency Mint: ≤ 0.1% / month if treasury < 100k ATA and > 66% multisig vote (policy; see below)

Manifesto: Pinned to IPFS (hash below)

🪙 Canonical Deployment
Contract	Address	Explorer
$ATA (AthenaToken)	0x72F64821ca2c8117890BF6c9172977865f809f64	View on BaseScan

RewardClaim	0x16DEEC9B1Bc2F95b75CA09BD2585aD2C66CdeCdC	View on BaseScan

Treasury (Multisig)	0xb36E25842C2C5ae91586988475E857F4D9643e9A	View on BaseScan

🔒 Canonical Chain: Base Mainnet (Chain ID 8453)
The Ethereum deployment of $ATA was an early test artifact. It is not active, funded, or recognized as part of Athena Genesis.

🚀 Quickstart
Prerequisites

Python 3.11+

Node.js (v20+)

MetaMask or Rabby wallet connected to Base Mainnet

Network: Base Mainnet
RPC URL: https://mainnet.base.org
Chain ID: 8453
Symbol: ETH
Block Explorer: https://basescan.org

0️⃣ Clone & Setup
git clone https://github.com/yourname/athena-genesis.git
cd athena-genesis
python -m venv .venv && source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt || echo "No external deps required"