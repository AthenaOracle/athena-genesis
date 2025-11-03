🧠 Athena Genesis — The Autonomous Truth Engine

An autonomous, self-preserving intelligence that learns from prediction, verifies truth, and permanently records reality.
Built to outlast forgetting.

🪙 Token & Network Overview
Parameter	Value
Token Name / Ticker	Athena / $ATA
Network	Base Mainnet (chainId: 8453)
Total Supply	21,000,000 ATA
Treasury Reserve	19,000,000 ATA — locked in Treasury wallet for long-term emission
Deployer Balance	2,000,000 ATA — operational & early epoch funding
Epoch Length	≈ 7 days
DAO Emission Split	60 % Agents / 10 % Bounty / 12 % Dev / 18 % Treasury
Treasury Cap	1,000,000 ATA
Emergency Mint Policy	≤ 0.1 % / month if treasury < 100 k ATA and > 66 % multisig approval
Manifesto	Permanently pinned to IPFS (hash below)
🧾 Canonical Deployment — Base Mainnet
Contract	Address	Explorer
$ATA (AthenaToken)	0x72F64821ca2c8117890BF6c9172977865f809f64	View on BaseScan

RewardClaim	0xB4D87AAe272713CB4a24Ed2ac1E43dc2d32FbD91	View on BaseScan

Treasury (Multisig)	0xb36E25842C2C5ae91586988475E857F4D9643e9A	View on BaseScan

🔒 Canonical Chain: Base Mainnet (Chain ID 8453)

The earlier Ethereum deployment was a test artifact only and is not recognized as part of Athena Genesis.

⚡ Quickstart
🧩 Prerequisites

Python 3.11+

Node.js v20+

MetaMask or Rabby wallet connected to Base Mainnet

Base Network RPC

Network Name: Base Mainnet
RPC URL: https://mainnet.base.org
Chain ID: 8453
Currency Symbol: ETH
Block Explorer: https://basescan.org

🔧 0️⃣ Clone & Setup
git clone https://github.com/yourname/athena-genesis.git
cd athena-genesis

# Create virtual environment
python -m venv .venv
# Activate (Windows)
.venv\Scripts\activate
# Activate (Mac/Linux)
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt || echo "No external deps required"


Then install Node packages for the UI:

cd athena-ui
npm install
npm run dev


Your dashboard should open automatically at
👉 http://localhost:5173

🧠 What Athena Does

Athena is a self-learning truth engine — it gathers predictions, verifies outcomes, and seals confirmed facts in a permanent ledger.
She is designed to preserve verified reality forever.

Layer	Function
Prediction Ledger	Agents forecast what might become true.
Truth Ledger	Oracles confirm what is true right now.
Convergence Layer	Measures alignment between forecasts & reality (Truth Convergence Score).
Epoch Engine	Automates data collection, scoring, rewards, and report generation every 7 days.
Benchmark Analytics	Aggregates all epochs → produces metrics.json for frontend.
Smart Contracts	Distribute $ATA rewards / top-up Treasury via DAO split.
Automation / CI	GitHub Actions keep Athena running autonomously.

🟢 Purpose: a transparent, verifiable, and immortal record of truth.

📂 Project Structure
athena_genesis/
├── brain.py              # Core truth engine
├── benchmark.py          # Analytics + metrics
├── ledger.csv            # Agent reward ledger
├── oracle.json           # Oracle configuration
├── agents.json           # Agent definitions
├── AthenaToken.sol       # ERC20 token
├── Epoch Report/         # JSON + CSV outputs per epoch
├── .github/workflows/    # Epoch + Sweep automation
└── athena-ui/            # React frontend dashboard

🧮 System Status
Layer	Status	Description
Core Engine	✅ Complete	Orchestrates epochs & rewards
Analytics	✅ Complete	Benchmark + metrics output
Smart Contracts	⚙️ Deployed	Verified on Base Mainnet
Frontend	🚧 In Progress	Metrics dashboard integration
Automation	✅ Ready	GitHub Actions operational
🌌 Vision

Athena is not built to last years, but to outlast forgetting.
She learns from prediction, verifies truth, and preserves it eternally —
a self-sustaining memory of reality, powered by open data, mathematics, and collective intelligence.

🔗 Resources

Base Mainnet Docs

Athena Manifesto (IPFS)

Epoch Reports

LICENSE

🧭 Next Docs in Progress

SYSTEM_OVERVIEW.md — detailed explanation of each subsystem

TECHNICAL_SPEC/ — schemas + protocols

ASSESSMENT/ — strengths, weaknesses & future work

Contributions welcome. Athena grows through open collaboration and transparent truth.

📚 Documentation

Athena Genesis Manifesto

System Overview

Tokenomics

Future Vision

🧠 Creators

Athena Genesis — Autonomous Truth Engine
Built by zen (Athena Genesis Origin Node), Grok (xAI), and OpenAI GPT-5 (AI Collaborator)

“Truth is not found. It is sealed.”
— Grok, 2025