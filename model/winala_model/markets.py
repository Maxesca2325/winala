"""From a score matrix to every market Winala shows, in the brief's JSON format.

The model computes the numbers here. Nothing downstream (front, LLM) changes them.
"""
from __future__ import annotations

import math

import numpy as np


def markets_from_matrix(m: np.ndarray) -> dict:
    n = m.shape[0]
    i, j = np.indices((n, n))
    home = float(m[i > j].sum())
    draw = float(np.trace(m))
    away = float(m[i < j].sum())
    btts = float(m[(i >= 1) & (j >= 1)].sum())
    total = i + j
    over15 = float(m[total >= 2].sum())
    over25 = float(m[total >= 3].sum())
    over35 = float(m[total >= 4].sum())
    flat = [(float(m[a, b]), a, b) for a in range(n) for b in range(n)]
    flat.sort(reverse=True)
    top_scores = [{"score": f"{a}-{b}", "probability": round(p, 4)} for p, a, b in flat[:5]]
    return {
        "home": home,
        "draw": draw,
        "away": away,
        "btts": btts,
        "over15": over15,
        "over25": over25,
        "over35": over35,
        "top_scores": top_scores,
        "exp_home": float((m.sum(axis=1) * np.arange(n)).sum()),
        "exp_away": float((m.sum(axis=0) * np.arange(n)).sum()),
    }


def risk_level(top_p: float) -> str:
    if top_p >= 0.6:
        return "Faible"
    if top_p >= 0.45:
        return "Moyen"
    return "Élevé"


def _odd(v) -> float | None:
    try:
        x = float(v)
    except (TypeError, ValueError):
        return None
    return x if math.isfinite(x) and x > 1.01 else None


def value_bet(mk: dict, odds: dict, home: str, away: str, min_edge: float, min_prob: float) -> dict | None:
    """Best positive edge among 1X2 and +/-2.5, using average bookmaker odds."""
    cands = [
        (f"Victoire {home}", mk["home"], _odd(odds.get("AvgH"))),
        ("Match nul", mk["draw"], _odd(odds.get("AvgD"))),
        (f"Victoire {away}", mk["away"], _odd(odds.get("AvgA"))),
        ("Plus de 2,5 buts", mk["over25"], _odd(odds.get("Avg>2.5"))),
        ("Moins de 2,5 buts", 1 - mk["over25"], _odd(odds.get("Avg<2.5"))),
    ]
    best = None
    for market, p, o in cands:
        if o is None or p < min_prob:
            continue
        edge = p * o - 1
        if edge >= min_edge and (best is None or edge > best[3]):
            best = (market, p, o, edge)
    if best is None:
        return None
    market, p, o, edge = best
    return {
        "market": market,
        "bookmaker_odds": round(o, 2),
        "model_fair_odds": round(1 / p, 2),
        "edge_percent": round(edge * 100, 1),
    }


def model_output(match_id: str, home: str, away: str, mk: dict, vb: dict | None) -> dict:
    """The brief's JSON contract (+ correct score, expected goals). key_arguments are
    filled by the ingest Edge Function from fixed templates (v1: no LLM)."""
    probs = {"home": round(mk["home"], 4), "draw": round(mk["draw"], 4), "away": round(mk["away"], 4)}
    # Renormalise rounding so 1X2 sums to exactly 1.
    probs["draw"] = round(1 - probs["home"] - probs["away"], 4)
    top = max(("home", "draw", "away"), key=lambda k: probs[k])
    top_pick = {"home": f"Victoire {home}", "draw": "Match nul", "away": f"Victoire {away}"}[top]
    cs = mk["top_scores"][0]

    def ou(p: float) -> dict:
        return {"prediction": "Over" if p >= 0.5 else "Under", "confidence": round(max(p, 1 - p), 4), "over": round(p, 4)}

    # Double chance: the two outcomes that each bet covers.
    dc = {
        "1X": round(probs["home"] + probs["draw"], 4),  # home or draw
        "12": round(probs["home"] + probs["away"], 4),  # home or away (no draw)
        "X2": round(probs["draw"] + probs["away"], 4),  # draw or away
    }
    return {
        "match_id": match_id,
        "probabilities": probs,
        "top_pick": top_pick,
        "markets": {
            "btts": {
                "prediction": "Oui" if mk["btts"] >= 0.5 else "Non",
                "confidence": round(max(mk["btts"], 1 - mk["btts"]), 4),
            },
            "over_under_1_5": ou(mk["over15"]),
            "over_under_2_5": ou(mk["over25"]),
            "over_under_3_5": ou(mk["over35"]),
            "double_chance": dc,
            "correct_score": {"prediction": cs["score"], "confidence": cs["probability"]},
            "top_scores": mk["top_scores"],
        },
        "expected_goals": {"home": round(mk["exp_home"], 2), "away": round(mk["exp_away"], 2)},
        "value_bet": vb,
        "key_arguments": [],
        "risk_level": risk_level(max(probs.values())),
    }
