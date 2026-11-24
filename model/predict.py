"""Daily: analyse every upcoming match (next ~10 days) from SportScore and publish.

  .venv/bin/python predict.py --dry-run     # print, send nothing
  .venv/bin/python predict.py               # needs SUPABASE_URL, SUPABASE_ANON_KEY, INGEST_SECRET (+ RAPIDAPI_KEY in CI)

Single source: SportScore (fixtures, results, 1X2 odds). The model fits on the
last two seasons of results and anchors on the match's 1X2 odds (same settings
the backtest validated: xi=0.0019 decay, 70% weight on market, value bets off).
"""
from __future__ import annotations

import argparse
import json
from zoneinfo import ZoneInfo

import pandas as pd

from winala_model import dixon_coles, sportscore
from winala_model.blend import anchored_matrix, devig
from winala_model.markets import markets_from_matrix, model_output

XI = 0.0019
BLEND = 0.7
HAITI = ZoneInfo("America/Port-au-Prince")


def build(now: pd.Timestamp) -> list[dict]:
    out: list[dict] = []
    for lg in sportscore.LEAGUES:
        try:
            events: list[dict] = []
            for sid in sportscore.recent_season_ids(lg.ss_id):
                events += sportscore.season_events(sid)
        except Exception as e:  # one league failing must not sink the run
            print(f"! {lg.id}: {e}")
            continue
        results = sportscore.results_frame(events)
        fixtures = sportscore.upcoming(events, now)
        if results.empty or not fixtures:
            continue
        f = dixon_coles.fit(results, now, xi=XI)
        for fx in fixtures:
            lam, mu = f.rates(fx["home"], fx["away"])
            m1 = devig(fx["odds"]) if fx["odds"] else None
            mat = anchored_matrix(lam, mu, f.rho, m1, None, BLEND if m1 is not None else 0.0)
            mk = markets_from_matrix(mat)
            mid = sportscore.match_id(fx["event_id"])
            out.append(
                {
                    "kind": "prediction",
                    "analysis_type": "STANDARD",
                    "calibrated": False,
                    "match": {
                        "id": mid,
                        "league_id": lg.id,
                        "league_name": lg.name,
                        "home_team": fx["home"],
                        "away_team": fx["away"],
                        "kickoff_time": fx["kickoff"].isoformat(),
                    },
                    "output": model_output(mid, fx["home"], fx["away"], mk, None),
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
    preds = build(now)
    frees = free_matches(preds)
    if args.dry_run:
        print(json.dumps(preds[:1], indent=2, ensure_ascii=False))
        print(f"... {len(preds)} predictions across covered leagues; {len(frees)} free matches")
        return
    from winala_model.client import Backend

    be = Backend()
    stored = 0
    for p in preds:
        res = be.ingest(p)
        stored += int(bool(res.get("stored")))
    for fm in frees:
        be.ingest(fm)
    print(f"{len(preds)} predictions sent ({stored} new/updated); {len(frees)} free matches set")


if __name__ == "__main__":
    main()
