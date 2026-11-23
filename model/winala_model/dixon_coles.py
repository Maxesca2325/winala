"""Dixon-Coles (1997) model with exponential time decay.

Goals: home ~ Poisson(lam), away ~ Poisson(mu)
  log lam = base + home_adv + attack[h] - defence[a]
  log mu  = base + attack[a] - defence[h]
plus the Dixon-Coles correction tau() on the 0-0, 1-0, 0-1, 1-1 scores.

Fitted in two stages (standard and fast): weighted Poisson by L-BFGS with an
analytic gradient and a small ridge (helps promoted teams with little data),
then rho by 1-D maximisation.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd
from scipy.optimize import minimize, minimize_scalar
from scipy.stats import poisson

MAX_GOALS = 10


@dataclass
class Fit:
    teams: list[str]
    base: float
    home_adv: float
    attack: np.ndarray
    defence: np.ndarray
    rho: float
    n_matches: int

    def index(self, team: str) -> int | None:
        try:
            return self.teams.index(team)
        except ValueError:
            return None

    def rates(self, home: str, away: str) -> tuple[float, float]:
        h, a = self.index(home), self.index(away)
        # Unknown team (just promoted, no history in this league): use the
        # typical newcomer level instead of the league average.
        att_h = self.attack[h] if h is not None else NEWCOMER_ATTACK
        def_h = self.defence[h] if h is not None else NEWCOMER_DEFENCE
        att_a = self.attack[a] if a is not None else NEWCOMER_ATTACK
        def_a = self.defence[a] if a is not None else NEWCOMER_DEFENCE
        lam = np.exp(self.base + self.home_adv + att_h - def_a)
        mu = np.exp(self.base + att_a - def_h)
        return float(lam), float(mu)

    def score_matrix(self, home: str, away: str) -> np.ndarray:
        lam, mu = self.rates(home, away)
        return score_matrix(lam, mu, self.rho)


NEWCOMER_ATTACK = -0.2
NEWCOMER_DEFENCE = -0.2


def tau_matrix(lam: float, mu: float, rho: float, n: int = MAX_GOALS + 1) -> np.ndarray:
    t = np.ones((n, n))
    t[0, 0] = 1 - lam * mu * rho
    t[0, 1] = 1 + lam * rho
    t[1, 0] = 1 + mu * rho
    t[1, 1] = 1 - rho
    return t


def score_matrix(lam: float, mu: float, rho: float) -> np.ndarray:
    g = np.arange(MAX_GOALS + 1)
    m = np.outer(poisson.pmf(g, lam), poisson.pmf(g, mu)) * tau_matrix(lam, mu, rho)
    m = np.clip(m, 0, None)
    return m / m.sum()


def time_weights(kickoffs: pd.Series, at: pd.Timestamp, xi: float) -> np.ndarray:
    days = (at - kickoffs).dt.total_seconds().to_numpy() / 86400.0
    return np.exp(-xi * np.clip(days, 0, None))


def fit(
    matches: pd.DataFrame,
    at: pd.Timestamp,
    xi: float = 0.0019,
    ridge: float = 0.5,
    window_days: int = 1100,
) -> Fit:
    """Fit on matches with kickoff < at. `matches` needs HomeTeam, AwayTeam, FTHG, FTAG, kickoff."""
    df = matches[(matches["kickoff"] < at) & (matches["kickoff"] >= at - pd.Timedelta(days=window_days))]
    teams = sorted(set(df["HomeTeam"]) | set(df["AwayTeam"]))
    idx = {t: i for i, t in enumerate(teams)}
    hi = df["HomeTeam"].map(idx).to_numpy()
    ai = df["AwayTeam"].map(idx).to_numpy()
    hg = df["FTHG"].to_numpy(float)
    ag = df["FTAG"].to_numpy(float)
    w = time_weights(df["kickoff"], at, xi)
    n = len(teams)

    def unpack(p):
        return p[0], p[1], p[2 : 2 + n], p[2 + n :]

    def nll(p):
        base, hadv, att, dfc = unpack(p)
        llam = base + hadv + att[hi] - dfc[ai]
        lmu = base + att[ai] - dfc[hi]
        lam, mu = np.exp(llam), np.exp(lmu)
        f = np.sum(w * (lam - hg * llam + mu - ag * lmu)) + ridge * (att @ att + dfc @ dfc)
        rl = w * (lam - hg)  # d/d llam
        rm = w * (mu - ag)  # d/d lmu
        g = np.zeros_like(p)
        g[0] = rl.sum() + rm.sum()
        g[1] = rl.sum()
        g_att = np.bincount(hi, rl, n) + np.bincount(ai, rm, n) + 2 * ridge * att
        g_def = -np.bincount(ai, rl, n) - np.bincount(hi, rm, n) + 2 * ridge * dfc
        g[2 : 2 + n] = g_att
        g[2 + n :] = g_def
        return f, g

    p0 = np.zeros(2 + 2 * n)
    p0[0] = np.log(max(ag.mean(), 0.3))
    p0[1] = 0.25
    res = minimize(nll, p0, jac=True, method="L-BFGS-B")
    base, hadv, att, dfc = unpack(res.x)

    lam = np.exp(base + hadv + att[hi] - dfc[ai])
    mu = np.exp(base + att[ai] - dfc[hi])
    low = (hg <= 1) & (ag <= 1)

    def neg_rho(rho):
        t = np.ones_like(lam)
        t = np.where((hg == 0) & (ag == 0), 1 - lam * mu * rho, t)
        t = np.where((hg == 0) & (ag == 1), 1 + lam * rho, t)
        t = np.where((hg == 1) & (ag == 0), 1 + mu * rho, t)
        t = np.where((hg == 1) & (ag == 1), 1 - rho, t)
        if np.any(t[low] <= 0):
            return 1e12
        return -np.sum(w[low] * np.log(t[low]))

    rho = minimize_scalar(neg_rho, bounds=(-0.25, 0.25), method="bounded").x
    return Fit(teams, float(base), float(hadv), att, dfc, float(rho), len(df))
