"""SportScore (via RapidAPI) is Winala's single data source: fixtures, results,
1X2 odds and crests, all from one place — so team names match across results
and fixtures with no cross-source mapping.

The RapidAPI key is injected by the proxy in this session; in CI it comes from
the RAPIDAPI_KEY secret. Either way the request carries the x-rapidapi-key header.
"""
from __future__ import annotations

import os
import time
from dataclasses import dataclass
from datetime import datetime, timezone

import pandas as pd
import requests

HOST = "sportscore1.p.rapidapi.com"
BASE = f"https://{HOST}"
UTC = timezone.utc


@dataclass(frozen=True)
class League:
    id: str  # Winala league id (public.leagues.id)
    ss_id: int  # SportScore league id
    name: str
    country: str


# The leagues we cover. (England Championship, Scotland, Eredivisie and Belgium
# are added once their SportScore ids are confirmed.)
LEAGUES = [
    League("pl", 317, "Premier League", "Angleterre"),
    League("bundesliga", 512, "Bundesliga", "Allemagne"),
    League("bundesliga2", 518, "2. Bundesliga", "Allemagne"),
    League("seriea", 592, "Serie A", "Italie"),
    League("serieb", 625, "Serie B", "Italie"),
    League("liga", 251, "La Liga", "Espagne"),
    League("liga2", 258, "La Liga 2", "Espagne"),
    League("l1", 498, "Ligue 1", "France"),
    League("l2", 502, "Ligue 2", "France"),
    League("liga-pt", 203, "Primeira Liga", "Portugal"),
    League("super-lig", 284, "Süper Lig", "Turquie"),
    League("super-league-gr", 523, "Super League", "Grèce"),
]

FINISHED = {"finished", "afteret", "afterpenalties", "retired"}
POSTPONED = {"postponed", "delayed", "interrupted"}
CANCELLED = {"canceled", "cancelled", "abandoned", "removed"}


def _headers() -> dict:
    # In CI the real key; here any value, the proxy overwrites the header.
    return {"x-rapidapi-key": os.environ.get("RAPIDAPI_KEY", "proxy-injected"), "x-rapidapi-host": HOST}


def _get(path: str, params: dict | None = None, retries: int = 4) -> dict:
    last: Exception | None = None
    for i in range(retries):
        try:
            r = requests.get(f"{BASE}{path}", headers=_headers(), params=params, timeout=45)
            if r.status_code == 429:
                time.sleep(2 ** (i + 1))
                continue
            r.raise_for_status()
            return r.json()
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(2**i)
    raise RuntimeError(f"GET {path} failed: {last}")


def recent_season_ids(ss_league_id: int, n: int = 2) -> list[int]:
    """The current season plus the previous one (enough history with time decay)."""
    data = _get(f"/leagues/{ss_league_id}/seasons").get("data", [])
    data = [s for s in data if s.get("id")]
    data.sort(key=lambda s: s.get("year_start") or 0)
    return [s["id"] for s in data[-n:]]


def season_events(season_id: int) -> list[dict]:
    out: list[dict] = []
    first = _get(f"/seasons/{season_id}/events", params={"page": 1})
    out.extend(first.get("data", []))
    last_page = int((first.get("meta") or {}).get("last_page") or 1)
    for page in range(2, min(last_page, 12) + 1):
        d = _get(f"/seasons/{season_id}/events", params={"page": page})
        ev = d.get("data", [])
        if not ev:
            break
        out.extend(ev)
        time.sleep(0.2)
    return out


def _kickoff(ev: dict) -> pd.Timestamp | None:
    s = ev.get("start_at")
    if not s:
        return None
    try:
        return pd.Timestamp(datetime.strptime(s, "%Y-%m-%d %H:%M:%S").replace(tzinfo=UTC))
    except ValueError:
        return None


def _name(side: dict | None) -> str:
    return (side or {}).get("name") or ""


def results_frame(events: list[dict]) -> pd.DataFrame:
    """Finished matches as the model's training frame."""
    rows = []
    for e in events:
        if (e.get("status") or "").lower() not in FINISHED:
            continue
        hs, as_ = e.get("home_score") or {}, e.get("away_score") or {}
        hg, ag = hs.get("current"), as_.get("current")
        k = _kickoff(e)
        if hg is None or ag is None or k is None:
            continue
        rows.append({"HomeTeam": _name(e.get("home_team")), "AwayTeam": _name(e.get("away_team")), "FTHG": float(hg), "FTAG": float(ag), "kickoff": k})
    df = pd.DataFrame(rows)
    return df.sort_values("kickoff").reset_index(drop=True) if len(df) else df


def odds_1x2(ev: dict) -> list[float] | None:
    o = ev.get("main_odds") or {}
    try:
        h = float(o["outcome_1"]["value"])
        d = float(o["outcome_X"]["value"])
        a = float(o["outcome_2"]["value"])
    except (KeyError, TypeError, ValueError):
        return None
    return [h, d, a] if min(h, d, a) > 1.01 else None


def upcoming(events: list[dict], now: pd.Timestamp, days: int = 10) -> list[dict]:
    """Not-started matches in the next `days`, each with its 1X2 odds if any."""
    out = []
    for e in events:
        if (e.get("status") or "").lower() != "notstarted":
            continue
        k = _kickoff(e)
        if k is None or k <= now or k > now + pd.Timedelta(days=days):
            continue
        out.append(
            {
                "event_id": e["id"],
                "home": _name(e.get("home_team")),
                "away": _name(e.get("away_team")),
                "kickoff": k,
                "odds": odds_1x2(e),
            }
        )
    return out


def status_index(events: list[dict]) -> dict[int, dict]:
    """event_id -> {score:(h,a) or None, settled:bool, off:str|None} for settle.py."""
    idx = {}
    for e in events:
        st = (e.get("status") or "").lower()
        hs, as_ = e.get("home_score") or {}, e.get("away_score") or {}
        hg, ag = hs.get("current"), as_.get("current")
        score = (int(hg), int(ag)) if (st in FINISHED and hg is not None and ag is not None) else None
        off = "POSTPONED" if st in POSTPONED else "CANCELLED" if st in CANCELLED else None
        idx[e["id"]] = {"score": score, "off": off}
    return idx


def match_id(event_id: int) -> str:
    return f"ss-{event_id}"
