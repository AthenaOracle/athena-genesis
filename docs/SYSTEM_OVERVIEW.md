# Athena Genesis — System Overview
**Version 2.3 — Operational Genesis (October 2025)**

## 1️⃣ Purpose
Athena Genesis is a fully autonomous prediction-validation network that measures foresight, rewards accuracy, and builds a permanent record of truth over time.

---

## 2️⃣ Core Components

| Layer | File | Purpose |
|-------|------|----------|
| 🧠 Core Engine | `brain.py` | Executes each epoch: collects oracle data, computes Market-Insight-Score (MIS), updates ledgers. |
| ⚙️ Automation | `run_epoch.py` | Wraps `brain.py` for manual or CI execution; timestamps, logs, and pushes results. |
| 📈 Analytics | `benchmark.py` | Aggregates all epoch reports → calculates TruthRate, TruthPower, error reduction. |
| 🪙 Contracts | `AthenToken.sol` / `RewardClaim.sol` | Manages ATA rewards, burns, and treasury logic on Base Mainnet. |
| 💾 Storage | `Epoch Report/` + `ledger.csv` | Houses every epoch’s truth data and cumulative ledger. |
| 💻 Frontend | `athena-ui/` | Displays live metrics and epoch trends (React + Tailwind). |

---

## 3️⃣ Data Flow

agents.json ──▶ brain.py ──▶ epoch_X_report.json
│
▼
ledger.csv
│
▼
benchmark.py
│
▼
metrics.json
│
▼
React Dashboard

yaml
Copy code

Each loop constitutes one **epoch** — a full prediction→truth→reward cycle.

---

## 4️⃣ Automation Pipeline

**File:** `.github/workflows/epoch.yaml`

| Step | Description |
|------|--------------|
| 1️⃣ | Triggered weekly or manually. |
| 2️⃣ | Runs `run_epoch.py`. |
| 3️⃣ | Generates new reports + ledger updates. |
| 4️⃣ | Commits results and pushes to main. |

---

## 5️⃣ Output Files

| File | Description |
|------|--------------|
| `epoch_X_report.json` | Individual epoch results (agents + truth). |
| `benchmark_report.json` | Aggregated accuracy metrics. |
| `metrics.json` | Simplified values for frontend API. |
| `ledger.csv` | Rolling history of agent performance and rewards. |

---

## 6️⃣ Current Metrics Tracked

- **TruthRate (%)** — Collective accuracy of all agents.  
- **TruthPower Index** — Weighted intelligence × agent growth.  
- **Outperformance Rate (%)** — Epochs outperforming BTC baseline.  
- **Error Reduction (%)** — Δ vs naïve BTC hold.  
- **Agent Growth (%)** — Participation increase across epochs.

---

## 7️⃣ Governance & Security

- 3-of-5 multisig treasury.  
- Emergency mint ≤ 0.1 %/month by 66 % quorum.  
- All runtime hashes anchored to GitHub + IPFS.

---

## 8️⃣ Stack

| Layer | Tech |
|-------|------|
| Backend | Python 3.11 + Viem |
| Frontend | React + TailwindCSS + Vite |
| Network | Base Mainnet (Chain ID 8453) |
| Storage | IPFS / Arweave / GitHub Artifacts |
| CI/CD | GitHub Actions |

---

**End of System Overview v2.3**