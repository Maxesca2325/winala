"""Daily: settle the public track record from SportScore results, and flag
matches that were postponed or cancelled (→ automatic refund in the database).

  .venv/bin/python settle.py       # needs SUPABASE_URL, SUPABASE_ANON_KEY, INGEST_SECRET (+ RAPIDAPI_KEY in CI)
"""
from __future__ import annotations

import pandas as pd

from winala_model import sportscore
from winala_model.client import Backend


def outcome(market: str, pick: str, home: str, away: str, hg: int, ag: int) -> str:
    if market == "1X2":
        actual = home if hg > ag else away if ag > hg else "Nul"
        return "WIN" if pick == actual else "LOSS"
    if market == "BTTS":
        return "WIN" if pick == ("Oui" if hg > 0 and ag > 0 else "Non") else "LOSS"
    if market == "Plus/Moins 2,5":
        return "WIN" if pick == ("Over" if hg + ag > 2.5 else "Under") else "LOSS"
    if market == "Score exact":
        return "WIN" if pick == f"{hg}-{ag}" else "LOSS"
    raise ValueError(market)


def main() -> None:
    be = Backend()
    now = pd.Timestamp.now(tz="UTC")
    rows = be.rpc("get_public_tracker", {"p_limit": 500})
    pending = [r for r in rows if r["result"] is None and pd.Timestamp(r["kickoff_time"]) < now - pd.Timedelta(hours=2)]
    if not pending:
        print("nothing to settle")
        return

    # Build event_id -> status/score from the current season of every league.
    index: dict[int, dict] = {}
    for lg in sportscore.LEAGUES:
        try:
            for sid in sportscore.recent_season_ids(lg.ss_id, n=1):
                index.update(sportscore.status_index(sportscore.season_events(sid)))
        except Exception as e:  # noqa: BLE001
            print(f"! {lg.id}: {e}")

    settled = finished = offed = 0
    done: set[str] = set()
    for r in pending:
        mid = r["match_id"]
        if not mid.startswith("ss-"):
            continue
        ev = index.get(int(mid[3:]))
        if not ev:
            continue
        if ev["score"]:
            hg, ag = ev["score"]
            be.ingest({"kind": "settle", "match_id": mid, "market": r["market"], "result": outcome(r["market"], r["predicted_pick"], r["home_team"], r["away_team"], hg, ag)})
            settled += 1
            if mid not in done:
                be.ingest({"kind": "status", "match_id": mid, "status": "FINISHED"})
                done.add(mid)
                finished += 1
        elif ev["off"] and mid not in done:
            be.ingest({"kind": "status", "match_id": mid, "status": ev["off"]})
            done.add(mid)
            offed += 1
    print(f"settled {settled} picks, {finished} matches finished, {offed} postponed/cancelled (refunded)")


if __name__ == "__main__":
    main()
