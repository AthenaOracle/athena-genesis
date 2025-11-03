🧠 Athena Genesis — Tokenomics v2.6b

Token: Athena ($ATA) | Network: Base Mainnet (Chain ID 8453)

1) Supply & Reserves
Item	Amount	Notes
Total Supply	21,000,000 ATA	Fixed cap
Treasury Reserve	19,000,000 ATA	Vested per DAO policy (e.g., long-term linear)
Deployer Balance	2,000,000 ATA	Ops liquidity / bootstrap
2) Emission = DAO Split (per epoch)

Epoch length: ≈ 7 days
Epoch pool (e.g. --pool 190000) is split exactly by DAO policy:

Category	% of Epoch Pool	What it funds
Merit Rewards	60%	Truth-power weighted payouts to all eligible agents
Top-3 Bounty	10%	Ranked bonus for the top 3 agents
Dev Fund	12%	Core protocol maintenance & infra
Treasury	18%	DAO reserves / future initiatives

These are the current defaults in code and can be overridden via split.json.

Top-3 breakdown: [60%, 25%, 15%] (1st / 2nd / 3rd).
No separate burn or treasury top-up stream outside this split.

3) Reward Computation (engine-aligned)

Truth-power weighting:
Weight per agent ∝ (MIS ** α) * reputation, with α = 2.0 by default.

Operational rules:

Reputation EMA: rep = 0.9 * rep_prev + 0.1 * MIS

Caps:

Hard cap: 10% of epoch pool per agent (merit portion)

Soft cap: 3× median merit reward

Floor: 0.01% of epoch pool (keeps small verified agents alive)

Top-3 bounty: rank split [60,25,15], with streak decay per position: 1 / (1 + 0.1 * n)

Ties: broken by higher reputation, then wallet address

4) Transparency & Audit

Reports: Merkle root + per-agent breakdown each epoch

CSV ledger: separate rows for merit, bounty, plus synthetic rows for dev and treasury

History: agent_history.jsonl (MIS, rep, rewards), split_history.jsonl (actual splits)

5) Governance Notes

DAO-configurable split: split.json overrides defaults without code changes.

Treasury usage & vesting are policy-level decisions approved by the DAO/multisig.

6) Contract Addresses (updated)
Contract	Address	Explorer
$ATA (AthenaToken)	0x72F64821ca2c8117890BF6c9172977865f809f64	basescan
RewardClaim	0xB4D87AAe272713CB4a24Ed2ac1E43dc2d32FbD91	basescan
Treasury (Multisig)	0xb36E25842C2C5ae91586988475E857F4D9643e9A	basescan