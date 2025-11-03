#!/usr/bin/env python3
# MIS.py — Market Insight Score utilities v2.5
# Updated for Athena Collective Learning (multi-agent consistency)
# Compatible with benchmark.py v2.5

from __future__ import annotations
from typing import List, Dict
import math

# Exponential smoothing coefficient — 90 epochs ≈ long-term memory
ALPHA = 1 / 90


# ---------------------------------------------------------------------
# 🎯 Accuracy Scoring
# ---------------------------------------------------------------------
def accuracy_from_prediction(pred: Dict, truth_price_move: float) -> float:
    """
    Compute directional accuracy in [0,1] based on:
      - Direction match (UP/DOWN/FLAT)
      - Optional price target proximity
      - Confidence weighting
    """
    dir_map = {"UP": 1, "DOWN": -1, "FLAT": 0}
    pdir = dir_map.get(pred.get("direction"), 0)
    sign = 1 if truth_price_move > 0 else (-1 if truth_price_move < 0 else 0)

    # Directional correctness baseline
    base = 1.0 if pdir == sign else (0.6 if pdir == 0 and abs(truth_price_move) < 0.001 else 0.0)

    # Optional price target proximity (rewarding tighter predictions)
    target = pred.get("priceTarget")
    if target is not None and isinstance(target, (int, float)):
        # Within ±1% proximity = small bonus
        proximity = max(0.0, 1.0 - min(1.0, abs(target - (1 + truth_price_move)) / 0.01))
        base = min(1.0, base * (0.9 + 0.1 * proximity))

    # Confidence weighting (soft gate)
    conf = float(pred.get("confidence", 0.5))
    conf = max(0.0, min(1.0, conf))
    return round(base * (0.5 + 0.5 * conf), 6)


# ---------------------------------------------------------------------
# 🧠 MIS Smoothing
# ---------------------------------------------------------------------
def smooth_mis(prev_mis: float, accuracy: float, alpha: float = ALPHA) -> float:
    """
    Exponential smoothing update:
        MIS_t = α * accuracy + (1 - α) * MIS_{t-1}
    Clamped in [0,1] for numerical stability.
    """
    mis = alpha * accuracy + (1 - alpha) * prev_mis
    return round(max(0.0, min(1.0, mis)), 6)


# ---------------------------------------------------------------------
# 🔄 Multi-Prediction Aggregation
# ---------------------------------------------------------------------
def aggregate_agent_predictions(predictions: List[Dict], truth_price_move: float) -> float:
    """
    Aggregate multiple predictions from a single agent.
    Returns a weighted average accuracy.
    """
    if not predictions:
        return 0.0
    accs = [accuracy_from_prediction(p, truth_price_move) for p in predictions]
    weights = [float(p.get("confidence", 1.0)) for p in predictions]
    total_weight = sum(weights)
    if total_weight <= 0:
        return statistics.mean(accs)
    return round(sum(a * w for a, w in zip(accs, weights)) / total_weight, 6)


# ---------------------------------------------------------------------
# 📊 Normalization
# ---------------------------------------------------------------------
def normalize_squared(mis_values: List[float]) -> List[float]:
    """
    Super-linear normalization:
        n_i = mis_i^2 / Σ(mis_j^2)
    This rewards high accuracy disproportionately,
    encouraging agents to improve beyond the mean.
    """
    squares = [m * m for m in mis_values]
    total = sum(squares)
    if total <= 0:
        return [0.0 for _ in mis_values]
    return [round(s / total, 6) for s in squares]


# ---------------------------------------------------------------------
# 🌐 Diversity Metric (optional — for analytics layer)
# ---------------------------------------------------------------------
def collective_entropy(mis_values: List[float]) -> float:
    """
    Shannon-style entropy of the collective:
      H = -Σ(p_i * log2(p_i))
    Measures diversity / disagreement among agents.
    """
    norm = normalize_squared(mis_values)
    eps = 1e-9
    return round(-sum(p * math.log2(p + eps) for p in norm), 6)


# ---------------------------------------------------------------------
# ✅ Example usage (if run standalone)
# ---------------------------------------------------------------------
if __name__ == "__main__":
    sample_preds = [
        {"direction": "UP", "priceTarget": 1.02, "confidence": 0.8},
        {"direction": "DOWN", "priceTarget": 0.98, "confidence": 0.4},
    ]
    truth_move = 0.015  # +1.5%
    acc = aggregate_agent_predictions(sample_preds, truth_move)
    new_mis = smooth_mis(prev_mis=0.55, accuracy=acc)
    print(f"Accuracy: {acc:.3f} | New MIS: {new_mis:.3f}")
