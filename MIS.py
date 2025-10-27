# MIS.py — Market Insight Score utilities (light comments)
from __future__ import annotations
from typing import List, Dict


ALPHA = 1/90 # exponential smoothing for rolling MIS




def accuracy_from_prediction(pred: Dict, truth_price_move: float) -> float:
"""Return accuracy in [0,1] based on direction match and magnitude tolerance.
- pred['direction'] in {UP, DOWN, FLAT}
- truth_price_move: realized pct change over horizon (e.g., 0.012 for +1.2%)
"""
dir_map = {"UP": 1, "DOWN": -1, "FLAT": 0}
pdir = dir_map.get(pred.get("direction"), 0)
sign = 1 if truth_price_move > 0 else (-1 if truth_price_move < 0 else 0)


# base score for direction
base = 1.0 if pdir == sign else (0.6 if pdir == 0 and abs(truth_price_move) < 0.001) else 0.0


# optional: price target proximity bonus
target = pred.get("priceTarget")
if target is not None and isinstance(target, (int, float)):
# Within 1% of realized close → small bonus
# Use a gentle clamp to avoid extreme boosts
proximity = max(0.0, 1.0 - min(1.0, abs(target - (1 + truth_price_move)) / 0.01))
base = min(1.0, base * (0.9 + 0.1 * proximity))


# confidence gating
conf = float(pred.get("confidence", 0.5))
conf = max(0.0, min(1.0, conf))


return base * (0.5 + 0.5 * conf)




def smooth_mis(prev_mis: float, accuracy: float, alpha: float = ALPHA) -> float:
"""Exponential smoothing: MIS_t = alpha*acc + (1-alpha)*MIS_{t-1}"""
return alpha * accuracy + (1 - alpha) * prev_mis




def normalize_squared(mis_values: List[float]) -> List[float]:
"""Super-linear normalization: n_i = mis_i^2 / sum(mis^2) with safe fallback."""
squares = [m * m for m in mis_values]
total = sum(squares)
if total <= 0:
return [0 for _ in mis_values]
return [s / total for s in squares]