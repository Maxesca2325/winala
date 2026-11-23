"""Match data from football-data.co.uk (free, no key): results, odds, fixtures.

Times in these files are UK local time (Europe/London).
"""
from __future__ import annotations

import io
import re
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import pandas as pd
import requests

BASE = "https://football-data.co.uk"
CACHE = Path(__file__).resolve().parent.parent / ".cache"
LONDON = ZoneInfo("Europe/London")
UTC = ZoneInfo("UTC")


@dataclass(frozen=True)
class League:
    id: str  # Winala league id (matches public.leagues.id)
    div: str  # football-data division code
    name: str


LEAGUES = [
    League("pl", "E0", "Premier League"),
    League("liga", "SP1", "La Liga"),
    League("seriea", "I1", "Serie A"),
    League("l1", "F1", "Ligue 1"),
]
LEAGUE_BY_DIV = {lg.div: lg for lg in LEAGUES}


def season_codes(first_start_year: int, last_start_year: int) -> list[str]:
    return [f"{y % 100:02d}{(y + 1) % 100:02d}" for y in range(first_start_year, last_start_year + 1)]


def current_season_start(today: datetime | None = None) -> int:
    today = today or datetime.now(UTC)
    return today.year if today.month >= 7 else today.year - 1


def _get(url: str, retries: int = 4) -> bytes:
    last: Exception | None = None
    for i in range(retries):
        try:
            r = requests.get(url, timeout=40, headers={"User-Agent": "winala-model/1.0"})
            if r.status_code == 404:
                raise FileNotFoundError(url)
            r.raise_for_status()
            return r.content
        except FileNotFoundError:
            raise
        except Exception as e:  # network hiccup: back off and retry
            last = e
            time.sleep(2**i)
    raise RuntimeError(f"download failed: {url}: {last}")


def _read_csv(raw: bytes) -> pd.DataFrame:
    text = raw.decode("utf-8-sig", errors="replace")
    df = pd.read_csv(io.StringIO(text), on_bad_lines="skip")
    df = df.loc[:, [c for c in df.columns if not str(c).startswith("Unnamed")]]
    return df.dropna(how="all")


def _kickoff_utc(df: pd.DataFrame) -> pd.Series:
    d = df["Date"].astype(str)
    # dd/mm/yy in old files, dd/mm/yyyy in recent ones.
    date = pd.to_datetime(d, format="%d/%m/%Y", errors="coerce").fillna(pd.to_datetime(d, format="%d/%m/%y", errors="coerce"))
    tm = df["Time"].fillna("15:00") if "Time" in df.columns else pd.Series("15:00", index=df.index)
    local = pd.to_datetime(date.dt.strftime("%Y-%m-%d") + " " + tm.astype(str), errors="coerce")
    return local.dt.tz_localize(LONDON, ambiguous="NaT", nonexistent="shift_forward").dt.tz_convert(UTC)


def load_season(div: str, season: str, refresh: bool = False) -> pd.DataFrame:
    """One league-season of results. Past seasons are cached forever, the current one is refreshed."""
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / f"{div}_{season}.csv"
    if refresh or not path.exists():
        path.write_bytes(_get(f"{BASE}/mmz4281/{season}/{div}.csv"))
    df = _read_csv(path.read_bytes())
    df = df[df["HomeTeam"].notna() & df["AwayTeam"].notna()].copy()
    df["kickoff"] = _kickoff_utc(df)
    df["season"] = season
    df["Div"] = div
    for c in ("FTHG", "FTAG"):
        df[c] = pd.to_numeric(df[c], errors="coerce")
    return df


def load_history(div: str, first_start_year: int, refresh_current: bool = True) -> pd.DataFrame:
    cur = current_season_start()
    frames = []
    for s in season_codes(first_start_year, cur):
        try:
            frames.append(load_season(div, s, refresh=refresh_current and s == season_codes(cur, cur)[0]))
        except FileNotFoundError:
            continue
    df = pd.concat(frames, ignore_index=True)
    df = df[df["FTHG"].notna() & df["FTAG"].notna() & df["kickoff"].notna()]
    return df.sort_values("kickoff").reset_index(drop=True)


def load_fixtures() -> pd.DataFrame:
    """Upcoming matches (about a week ahead) with pre-match odds, all divisions."""
    df = _read_csv(_get(f"{BASE}/fixtures.csv"))
    df = df[df["Div"].isin(LEAGUE_BY_DIV)].copy()
    df["kickoff"] = _kickoff_utc(df)
    return df[df["kickoff"].notna()].reset_index(drop=True)


def slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def match_id(div: str, kickoff_utc: pd.Timestamp, home: str, away: str) -> str:
    """Stable id shared by predict.py and settle.py."""
    return f"fd-{div}-{kickoff_utc:%Y%m%d}-{slug(home)}-{slug(away)}"
