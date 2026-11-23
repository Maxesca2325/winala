"""Walk-forward backtest (brief §6): judge the model on CALIBRATION and on ROI
against real odds, not on raw hit rate.

For each league and each test week: fit only on matches played before that
week, predict the week, compare with what happened and with the market.

  .venv/bin/python backtest.py                    # all leagues, last 3 seasons + current
  .venv/bin/python backtest.py --leagues pl --xi 0.001 0.0019 0.003
Writes reports/backtest.json and reports/backtest.md.
"""
from __future__ import annotations

import argparse
import json
import math
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

from winala_model import data, dixon_coles
from winala_model.blend import anchored_matrix, devig
from winala_model.markets import markets_from_matrix

REPORTS = Path(__file__).resolve().parent / "reports"
EDGES = [0.03, 0.05, 0.08, 0.10]


def implied(df: pd.DataFrame, cols: list[str]) -> np.ndarray | None:
    if not all(c in df.columns for c in cols):
        return None
    o = df[cols].apply(pd.to_numeric, errors="coerce").to_numpy(float)
    p = 1 / o
    return p / p.sum(axis=1, keepdims=True)  # remove the bookmaker margin


def first_available(df: pd.DataFrame, options: list[list[str]]) -> np.ndarray | None:
    for cols in options:
        p = implied(df, cols)
        if p is not None and np.isfinite(p).mean() > 0.9:
            return p
    return None


def predict_walk_forward(hist: pd.DataFrame, test_from: pd.Timestamp, xi: float, blend: float = 0.0) -> pd.DataFrame:
    test = hist[hist["kickoff"] >= test_from]
    out = []
    week = pd.Timedelta(days=7)
    cutoff = test_from
    end = hist["kickoff"].max() + pd.Timedelta(days=1)
    while cutoff < end:
        chunk = test[(test["kickoff"] >= cutoff) & (test["kickoff"] < cutoff + week)]
        if len(chunk):
            f = dixon_coles.fit(hist, cutoff, xi=xi)
            for _, r in chunk.iterrows():
                lam, mu = f.rates(r["HomeTeam"], r["AwayTeam"])
                # Only PRE-MATCH odds (what exists when we publish), never closing odds.
                m1 = devig([r.get("AvgH"), r.get("AvgD"), r.get("AvgA")])
                mo = devig([r.get("Avg<2.5"), r.get("Avg>2.5")])
                mat = anchored_matrix(lam, mu, f.rho, m1, None if mo is None else float(mo[1]), blend)
                mk = markets_from_matrix(mat)
                out.append({**r.to_dict(), **{f"m_{k}": v for k, v in mk.items()}})
        cutoff += week
    return pd.DataFrame(out)


def logloss(p: np.ndarray, y: np.ndarray) -> float:
    return float(-np.mean(np.log(np.clip(p[np.arange(len(y)), y], 1e-12, 1))))


def brier(p: np.ndarray, y: np.ndarray) -> float:
    onehot = np.eye(p.shape[1])[y]
    return float(np.mean(np.sum((p - onehot) ** 2, axis=1)))


def ece(p: np.ndarray, y: np.ndarray, bins: int = 10) -> tuple[float, list[dict]]:
    """Expected calibration error over every (match, outcome) probability."""
    probs = p.ravel()
    hits = np.eye(p.shape[1])[y].ravel()
    edges = np.linspace(0, 1, bins + 1)
    table, total = [], 0.0
    for lo, hi in zip(edges[:-1], edges[1:]):
        sel = (probs >= lo) & (probs < hi if hi < 1 else probs <= hi)
        if sel.sum() == 0:
            continue
        pred, obs = probs[sel].mean(), hits[sel].mean()
        total += sel.sum() / len(probs) * abs(pred - obs)
        table.append({"bin": f"{lo:.1f}-{hi:.1f}", "n": int(sel.sum()), "predicted": round(float(pred), 3), "observed": round(float(obs), 3)})
    return float(total), table


def value_roi(df: pd.DataFrame, edge_min: float, min_prob: float = 0.2) -> dict:
    """Flat 1-unit bets on the best positive edge per match, pre-match average odds."""
    stake = profit = 0.0
    n = wins = 0
    for _, r in df.iterrows():
        cands = []
        for key, p, ocol, won in [
            ("H", r["m_home"], "AvgH", r["FTHG"] > r["FTAG"]),
            ("D", r["m_draw"], "AvgD", r["FTHG"] == r["FTAG"]),
            ("A", r["m_away"], "AvgA", r["FTHG"] < r["FTAG"]),
            ("O", r["m_over25"], "Avg>2.5", r["FTHG"] + r["FTAG"] > 2.5),
            ("U", 1 - r["m_over25"], "Avg<2.5", r["FTHG"] + r["FTAG"] < 2.5),
        ]:
            o = pd.to_numeric(r.get(ocol), errors="coerce")
            if pd.isna(o) or o <= 1.01 or p < min_prob:
                continue
            e = p * o - 1
            if e >= edge_min:
                cands.append((e, o, won))
        if not cands:
            continue
        e, o, won = max(cands)
        n += 1
        stake += 1
        profit += (o - 1) if won else -1
        wins += int(won)
    roi = profit / stake if stake else None
    # Rough 95% band for ROI on flat stakes, to show how much is luck.
    se = None
    if n > 1:
        se = 1.96 * math.sqrt(max(wins / n * (1 - wins / n), 1e-9)) * (stake and (profit + stake) / max(wins, 1)) / math.sqrt(n)
    return {"edge_min": edge_min, "bets": n, "wins": wins, "roi": None if roi is None else round(roi, 4), "roi_95_halfwidth": None if se is None else round(se, 4)}


def evaluate(df: pd.DataFrame) -> dict:
    y = np.where(df["FTHG"] > df["FTAG"], 0, np.where(df["FTHG"] == df["FTAG"], 1, 2))
    pm = df[["m_home", "m_draw", "m_away"]].to_numpy(float)
    res: dict = {"matches": int(len(df))}
    res["model_1x2"] = {"logloss": round(logloss(pm, y), 4), "brier": round(brier(pm, y), 4)}
    e, table = ece(pm, y)
    res["model_1x2"]["ece"] = round(e, 4)
    res["calibration_1x2"] = table
    res["model_1x2"]["top_pick_hit_rate"] = round(float(np.mean(pm.argmax(1) == y)), 4)

    pc = first_available(df, [["PSCH", "PSCD", "PSCA"], ["AvgCH", "AvgCD", "AvgCA"], ["AvgH", "AvgD", "AvgA"]])
    if pc is not None:
        ok = np.isfinite(pc).all(axis=1)
        res["market_1x2_closing"] = {
            "matches": int(ok.sum()),
            "logloss": round(logloss(pc[ok], y[ok]), 4),
            "brier": round(brier(pc[ok], y[ok]), 4),
            "model_logloss_same_matches": round(logloss(pm[ok], y[ok]), 4),
            "top_pick_hit_rate": round(float(np.mean(pc[ok].argmax(1) == y[ok])), 4),
        }

    yo = (df["FTHG"] + df["FTAG"] > 2.5).astype(int).to_numpy()
    po = np.column_stack([1 - df["m_over25"], df["m_over25"]])
    res["model_ou25"] = {"logloss": round(logloss(po, yo), 4), "brier": round(brier(po, yo), 4), "ece": round(ece(po, yo)[0], 4)}
    mo = first_available(df, [["PC<2.5", "PC>2.5"], ["AvgC<2.5", "AvgC>2.5"], ["Avg<2.5", "Avg>2.5"]])
    if mo is not None:
        ok = np.isfinite(mo).all(axis=1)
        res["market_ou25_closing"] = {"logloss": round(logloss(mo[ok], yo[ok]), 4), "model_logloss_same_matches": round(logloss(po[ok], yo[ok]), 4)}

    yb = ((df["FTHG"] > 0) & (df["FTAG"] > 0)).astype(int).to_numpy()
    pb = np.column_stack([1 - df["m_btts"], df["m_btts"]])
    base = yb.mean()
    res["model_btts"] = {
        "logloss": round(logloss(pb, yb), 4),
        "baseline_logloss": round(float(-np.mean(yb * np.log(base) + (1 - yb) * np.log(1 - base))), 4),
        "ece": round(ece(pb, yb)[0], 4),
    }

    top = df["m_top_scores"].map(lambda t: t[0]["score"])
    topp = df["m_top_scores"].map(lambda t: t[0]["probability"])
    actual = df["FTHG"].astype(int).astype(str) + "-" + df["FTAG"].astype(int).astype(str)
    res["correct_score"] = {
        "hit_rate": round(float(np.mean(top == actual)), 4),
        "mean_predicted_probability": round(float(topp.mean()), 4),
    }
    res["value_bets_pre_match_avg_odds"] = [value_roi(df, e) for e in EDGES]
    return res


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--leagues", nargs="*", default=[lg.id for lg in data.LEAGUES])
    ap.add_argument("--xi", nargs="*", type=float, default=[0.0019])
    ap.add_argument("--blend", nargs="*", type=float, default=[0.0], help="weight of pre-match market odds")
    ap.add_argument("--test-seasons", type=int, default=3, help="complete seasons tested before the current one")
    ap.add_argument("--first-season", type=int, default=2016)
    args = ap.parse_args()

    cur = data.current_season_start()
    test_start_year = cur - args.test_seasons
    test_from = pd.Timestamp(f"{test_start_year}-07-01", tz="UTC")
    report: dict = {"generated_at": datetime.now(timezone.utc).isoformat(), "test_from": str(test_from.date()), "leagues": {}}

    for lg in [l for l in data.LEAGUES if l.id in args.leagues]:
        hist = data.load_history(lg.div, args.first_season)
        for xi in args.xi:
          for bl in args.blend:
            preds = predict_walk_forward(hist, test_from, xi, bl)
            r = evaluate(preds)
            report["leagues"].setdefault(lg.id, {})[f"xi={xi},blend={bl}"] = r
            m, mk = r["model_1x2"], r.get("market_1x2_closing", {})
            print(f"{lg.name:16s} xi={xi:<7} blend={bl:<4} n={r['matches']:5d}  model LL={m['logloss']:.4f} ECE={m['ece']:.3f}  "
                  f"market LL={mk.get('logloss', float('nan')):.4f}  score-exact hit={r['correct_score']['hit_rate']:.3f}  "
                  f"VB5%: {r['value_bets_pre_match_avg_odds'][1]}")

    REPORTS.mkdir(exist_ok=True)
    (REPORTS / "backtest.json").write_text(json.dumps(report, indent=2, ensure_ascii=False, default=str))
    print(f"\nreport: {REPORTS / 'backtest.json'}")


if __name__ == "__main__":
    main()
