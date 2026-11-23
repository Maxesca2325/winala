"""Daily: settle the public track record after matches, and flag matches that
never got played (→ automatic refund in the database).

  .venv/bin/python settle.py       # needs SUPABASE_URL, SUPABASE_ANON_KEY, INGEST_SECRET
"""
from __future__ import annotations

import pandas as pd

from winala_model import data
from winala_model.client import Backend

# football-data.co.uk adds results within a few days. If a match is still
# missing a week after kickoff, treat it as postponed (credits are refunded).
POSTPONED_AFTER = pd.Timedelta(days=7)


def outcome(market: str, pick: str, home: str, away: str, hg: int, ag: int) -> str:
    if market == "1X2":
        actual = home if hg > ag else away if ag > hg else "Nul"
        return "WIN" if pick == actual else "LOSS"
    if market == "BTTS":
        actual = "Oui" if hg > 0 and ag > 0 else "Non"
        return "WIN" if pick == actual else "LOSS"
    if market == "Plus/Moins 2,5":
        actual = "Over" if hg + ag > 2.5 else "Under"
        return "WIN" if pick == actual else "LOSS"
    if market == "Score exact":
        return "WIN" if pick == f"{hg}-{ag}" else "LOSS"
    raise ValueError(market)


def main() -> None:
    be = Backend()
    now = pd.Timestamp.now(tz="UTC")
    rows = be.rpc("get_public_tracker", {"p_limit": 500})
    pending = [r for r in rows if r["result"] is None and pd.Timestamp(r["kickoff_time"]) < now - pd.Timedelta(hours=3)]
    if not pending:
        print("nothing to settle")
        return

    results: dict[str, tuple[int, int]] = {}
    season = data.season_codes(data.current_season_start(), data.current_season_start())[0]
    for lg in data.LEAGUES:
        df = data.load_season(lg.div, season, refresh=True)
        df = df[df["FTHG"].notna() & df["kickoff"].notna()]
        for _, r in df.iterrows():
            results[data.match_id(lg.div, r["kickoff"], r["HomeTeam"], r["AwayTeam"])] = (int(r["FTHG"]), int(r["FTAG"]))

    settled = finished = postponed = 0
    done_matches: set[str] = set()
    for r in pending:
        mid = r["match_id"]
        if mid in results:
            hg, ag = results[mid]
            res = outcome(r["market"], r["predicted_pick"], r["home_team"], r["away_team"], hg, ag)
            be.ingest({"kind": "settle", "match_id": mid, "market": r["market"], "result": res})
            settled += 1
            if mid not in done_matches:
                be.ingest({"kind": "status", "match_id": mid, "status": "FINISHED"})
                done_matches.add(mid)
                finished += 1
        elif pd.Timestamp(r["kickoff_time"]) < now - POSTPONED_AFTER and mid not in done_matches:
            be.ingest({"kind": "status", "match_id": mid, "status": "POSTPONED"})
            done_matches.add(mid)
            postponed += 1
    print(f"settled {settled} picks, {finished} matches finished, {postponed} postponed (refunded)")


if __name__ == "__main__":
    main()
