# Athena Genesis — Tokenomics
**Token:** Athena ($ATA) | **Network:** Base Mainnet (Chain ID 8453)

---

## 1️⃣ Supply & Reserves

| Item | Amount | Notes |
|------|--------:|-------|
| Total Supply | 21,000,000 ATA | Fixed cap |
| Treasury Reserve | 19,000,000 ATA | Locked 20-year emission |
| Deployer Balance | 2,000,000 ATA | Operational funds |

---

## 2️⃣ Emission & Rewards

**Epoch Cycle:** ≈ 7 days  
**Distribution:**

- 60 % → Agent Rewards  
- 20 % → Burn  
- 20 % → Treasury Top-Up  

**Treasury Cap:** 1 M ATA  
**Emergency Mint:** ≤ 0.1 %/month with 66 % multisig vote

---

## 3️⃣ Reward Computation

squares = [m**2 for m in mis_values]
norm = [s / sum(squares) for s in squares] if sum(squares) else mis_values
rewards = [n * epoch_pool for n in norm]

yaml
Copy code

**Key Rules**

| Mechanic | Description |
|-----------|-------------|
| Super-linear Curve | High-accuracy agents gain exponentially more. |
| Participation Weight | Long-term consistency rewarded. |
| 0.01 % Floor | Keeps small verified agents alive. |

---

## 4️⃣ Treasury Mechanics

- Treasury melts 1 % each epoch into rewards.  
- Unclaimed tokens roll forward.  
- If balance < 100 k ATA → Emergency Mint allowed.  

> *“The treasury is a candle; the burn is its light.”*

---

## 5️⃣ Economic Sustainability

- 20-year half-life emission.  
- DAO control via multisig → eventual community transition.  
- PTE (Perpetual Truth Endowment) planned for long-term storage funding.

---

## 6️⃣ Contract Addresses

| Contract | Address | Explorer |
|-----------|---------|-----------|
| $ATA (AthenaToken) | `0x72F64821ca2c8117890BF6c9172977865f809f64` | [View on BaseScan](https://basescan.org/address/0x72F64821ca2c8117890BF6c9172977865f809f64) |
| RewardClaim | `0x16DEEC9B1Bc2F95b75CA09BD2585aD2C66CdeCdC` | [View on BaseScan](https://basescan.org/address/0x16DEEC9B1Bc2F95b75CA09BD2585aD2C66CdeCdC) |
| Treasury (Multisig) | `0xb36E25842C2C5ae91586988475E857F4D9643e9A` | [View on BaseScan](https://basescan.org/address/0xb36E25842C2C5ae91586988475E857F4D9643e9A) |

---

**End of Tokenomics v2.3**