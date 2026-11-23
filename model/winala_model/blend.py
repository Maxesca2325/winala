"""Market-anchored Dixon-Coles.

The pure model is well calibrated but less sharp than bookmaker odds, which
already price injuries, line-ups and news. We blend the two probability views
and then re-solve the two goal rates (lam, mu) so that ONE coherent score
matrix reproduces the blended 1X2 and +/-2.5. Every market (BTTS, exact score)
then comes from that single matrix, so all numbers stay consistent.
"""
from __future__ import annotations

import numpy as np
from scipy.optimize import minimize

from .dixon_coles import score_matrix


def devig(odds: list[float | None]) -> np.ndarray | None:
    try:
        o = np.array([float(x) for x in odds])
    except (TypeError, ValueError):
        return None
    if not np.all(np.isfinite(o)) or np.any(o <= 1.01):
        return None
    p = 1 / o
    return p / p.sum()


def _summary(m: np.ndarray) -> np.ndarray:
    i, j = np.indices(m.shape)
    return np.array([m[i > j].sum(), m[i < j].sum(), m[(i + j) >= 3].sum()])


def anchored_matrix(
    lam: float,
    mu: float,
    rho: float,
    market_1x2: np.ndarray | None,
    market_over: float | None,
    weight: float,
) -> np.ndarray:
    base = score_matrix(lam, mu, rho)
    if market_1x2 is None or weight <= 0:
        return base
    s = _summary(base)
    target = s.copy()
    target[0] = (1 - weight) * s[0] + weight * market_1x2[0]
    target[1] = (1 - weight) * s[1] + weight * market_1x2[2]
    if market_over is not None:
        target[2] = (1 - weight) * s[2] + weight * market_over

    def loss(x):
        return float(np.sum((_summary(score_matrix(np.exp(x[0]), np.exp(x[1]), rho)) - target) ** 2))

    res = minimize(loss, np.log([lam, mu]), method="Nelder-Mead", options={"xatol": 1e-5, "fatol": 1e-10, "maxiter": 400})
    return score_matrix(float(np.exp(res.x[0])), float(np.exp(res.x[1])), rho)
