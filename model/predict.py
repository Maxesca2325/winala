"""Daily: predict upcoming matches and publish them (before kickoff).

  .venv/bin/python predict.py --dry-run      # print JSON, send nothing
  .venv/bin/python predict.py                # needs SUPABASE_URL, SUPABASE_ANON_KEY, INGEST_SECRET

Settings come from the backtest (reports/backtest.json):
  xi=0.0019 time decay, 70 % weight on pre-match market odds,
  value bets OFF (negative ROI in every league tested).
"""
from __future__ import annotations

import argparse
import json
from zoneinfo import ZoneInfo

import pandas as pd

from winala_model import data, dixon_coles
from winala_model.blend import anchored_matrix, devig
from winala_model.markets import markets_from_matrix, model_output, value_bet

XI = 0.0019
BLEND = 0.7
VALUE_BETS = False  # turn on per league only after a backtest shows positive ROI
MIN_EDGE, MIN_PROB = 0.05, 0.2
HAITI = ZoneInfo("America/Port-au-Prince")


def build(fixtures: pd.DataFrame, now: pd.Timestamp) -> list[dict]:
    out = []
    for lg in data.LEAGUES:
        fx = fixtures[(fixtures["Div"] == lg.div) & (fixtures["kickoff"] > now)]
        if fx.empty:
            continue
        hist = data.load_history(lg.div, 2019)
        f = dixon_coles.fit(hist, now, xi=XI)
        for _, r in fx.iterrows():
            home, away = r["HomeTeam"], r["AwayTeam"]
            lam, mu = f.rates(home, away)
            m1 = devig([r.get("AvgH"), r.get("AvgD"), r.get("AvgA")])
            mo = devig([r.get("Avg<2.5"), r.get("Avg>2.5")])
            mat = anchored_matrix(lam, mu, f.rho, m1, None if mo is None else float(mo[1]), BLEND)
            mk = markets_from_matrix(mat)
            vb = value_bet(mk, r.to_dict(), home, away, MIN_EDGE, MIN_PROB) if VALUE_BETS else None
            mid = data.match_id(lg.div, r["kickoff"], home, away)
            out.append(
                {
                    "kind": "prediction",
                    "analysis_type": "STANDARD",
                    "calibrated": False,
                    "match": {
                        "id": mid,
                        "league_id": lg.id,
                        "league_name": lg.name,
                        "home_team": home,
                        "away_team": away,
                        "kickoff_time": r["kickoff"].isoformat(),
                    },
                    "output": model_output(mid, home, away, mk, vb),
                }
            )
    return out


def free_matches(preds: list[dict]) -> list[dict]:
    """One free match per Haiti day: the one the model is most sure about."""
    best: dict[str, tuple[float, str]] = {}
    for p in preds:
        day = pd.Timestamp(p["match"]["kickoff_time"]).tz_convert(HAITI).date().isoformat()
        top = max(p["output"]["probabilities"].values())
        if day not in best or top > best[day][0]:
            best[day] = (top, p["match"]["id"])
    return [{"kind": "free_match", "day": d, "match_id": mid} for d, (_, mid) in sorted(best.items())]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    now = pd.Timestamp.now(tz="UTC")
    preds = build(data.load_fixtures(), now)
    frees = free_matches(preds)
    if args.dry_run:
        print(json.dumps(preds[:2], indent=2, ensure_ascii=False))
        print(f"... {len(preds)} predictions, free matches: {frees}")
        return
    from winala_model.client import Backend

    be = Backend()
    stored = 0
    for p in preds:
        res = be.ingest(p)
        stored += int(bool(res.get("stored")))
    for fm in frees:
        be.ingest(fm)
    print(f"{len(preds)} predictions sent, {stored} new; {len(frees)} free matches set")


if __name__ == "__main__":
    main()
