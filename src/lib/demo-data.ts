import type { ModelOutput } from "./model";

/**
 * DEMO DATA — every number below is an EXAMPLE written by hand to show the
 * interface. It is NOT model output and must never be presented as a pick.
 * Real data arrives from the validated model via Supabase (step 4).
 */

export type MatchStatus = "SCHEDULED" | "LIVE" | "FINISHED" | "POSTPONED" | "CANCELLED";

export interface League {
  id: string;
  name: string;
  short: string;
  country: string;
  /** Value bets are only shown for leagues where the model is calibrated. */
  calibrated: boolean;
}

export interface Team {
  name: string;
  short: string;
  color: string;
}

export interface DemoMatch {
  id: string;
  leagueId: string;
  home: Team;
  away: Team;
  /** 0 = aujourd'hui, 1 = demain. Kept relative on purpose: no fake fixture dates. */
  day: 0 | 1;
  time: string;
  status: MatchStatus;
  freeOfTheDay?: boolean;
  lineupUpdated?: boolean;
  prediction: ModelOutput;
}

export const LEAGUES: League[] = [
  { id: "pl", name: "Premier League", short: "PL", country: "Angleterre", calibrated: true },
  { id: "liga", name: "La Liga", short: "Liga", country: "Espagne", calibrated: true },
  { id: "seriea", name: "Serie A", short: "Serie A", country: "Italie", calibrated: true },
  { id: "l1", name: "Ligue 1", short: "L1", country: "France", calibrated: true },
  { id: "ucl", name: "Ligue des Champions", short: "LdC", country: "Europe", calibrated: false },
];

export const leagueById = (id: string) => LEAGUES.find((l) => l.id === id)!;

const t = (name: string, short: string, color: string): Team => ({ name, short, color });

function pred(
  id: string,
  h: number,
  d: number,
  a: number,
  btts: ["Oui" | "Non", number],
  ou: ["Over" | "Under", number],
  risk: ModelOutput["risk_level"],
  top: string,
  vb: ModelOutput["value_bet"] = null,
): ModelOutput {
  return {
    match_id: id,
    probabilities: { home: h, draw: d, away: a },
    top_pick: top,
    markets: {
      btts: { prediction: btts[0], confidence: btts[1] },
      over_under_2_5: { prediction: ou[0], confidence: ou[1] },
    },
    value_bet: vb,
    key_arguments: [],
    risk_level: risk,
  };
}

export const DEMO_MATCHES: DemoMatch[] = [
  {
    id: "demo-1",
    leagueId: "pl",
    home: t("Arsenal", "ARS", "#db0007"),
    away: t("Brentford", "BRE", "#e30613"),
    day: 0,
    time: "10:00",
    status: "SCHEDULED",
    freeOfTheDay: true,
    prediction: pred("demo-1", 0.58, 0.23, 0.19, ["Non", 0.56], ["Over", 0.54], "Faible", "Victoire Arsenal", {
      market: "Victoire Arsenal",
      bookmaker_odds: 1.8,
      model_fair_odds: 1.72,
      edge_percent: 4.7,
    }),
  },
  {
    id: "demo-2",
    leagueId: "pl",
    home: t("Liverpool", "LIV", "#c8102e"),
    away: t("Aston Villa", "AVL", "#670e36"),
    day: 0,
    time: "12:30",
    status: "SCHEDULED",
    lineupUpdated: true,
    prediction: pred("demo-2", 0.52, 0.25, 0.23, ["Oui", 0.61], ["Over", 0.63], "Moyen", "Victoire Liverpool"),
  },
  {
    id: "demo-3",
    leagueId: "liga",
    home: t("Real Madrid", "RMA", "#febe10"),
    away: t("Villarreal", "VIL", "#ffe667"),
    day: 0,
    time: "15:00",
    status: "SCHEDULED",
    prediction: pred("demo-3", 0.64, 0.2, 0.16, ["Oui", 0.55], ["Over", 0.66], "Faible", "Victoire Real Madrid", {
      market: "Plus de 2,5 buts",
      bookmaker_odds: 1.72,
      model_fair_odds: 1.52,
      edge_percent: 13,
    }),
  },
  {
    id: "demo-4",
    leagueId: "seriea",
    home: t("Napoli", "NAP", "#12a0d7"),
    away: t("Lazio", "LAZ", "#87d8f7"),
    day: 0,
    time: "14:45",
    status: "SCHEDULED",
    prediction: pred("demo-4", 0.44, 0.29, 0.27, ["Oui", 0.52], ["Under", 0.55], "Élevé", "Victoire Napoli"),
  },
  {
    id: "demo-5",
    leagueId: "l1",
    home: t("Lyon", "OL", "#1b3e8f"),
    away: t("Lens", "RCL", "#f5d000"),
    day: 0,
    time: "15:05",
    status: "SCHEDULED",
    prediction: pred("demo-5", 0.39, 0.28, 0.33, ["Oui", 0.57], ["Over", 0.51], "Élevé", "Victoire Lyon"),
  },
  {
    id: "demo-6",
    leagueId: "l1",
    home: t("Marseille", "OM", "#2faee0"),
    away: t("Nantes", "FCN", "#fcd405"),
    day: 0,
    time: "11:00",
    status: "POSTPONED",
    prediction: pred("demo-6", 0.5, 0.27, 0.23, ["Non", 0.53], ["Under", 0.52], "Moyen", "Victoire Marseille"),
  },
  {
    id: "demo-7",
    leagueId: "ucl",
    home: t("Barcelone", "BAR", "#a50044"),
    away: t("Inter", "INT", "#0068a8"),
    day: 1,
    time: "15:00",
    status: "SCHEDULED",
    prediction: pred("demo-7", 0.47, 0.26, 0.27, ["Oui", 0.64], ["Over", 0.62], "Moyen", "Victoire Barcelone", {
      market: "Victoire Barcelone",
      bookmaker_odds: 2.25,
      model_fair_odds: 2.13,
      edge_percent: 5.6,
    }),
  },
  {
    id: "demo-8",
    leagueId: "pl",
    home: t("Chelsea", "CHE", "#034694"),
    away: t("Newcastle", "NEW", "#241f20"),
    day: 1,
    time: "10:00",
    status: "SCHEDULED",
    prediction: pred("demo-8", 0.45, 0.27, 0.28, ["Oui", 0.59], ["Over", 0.57], "Moyen", "Victoire Chelsea"),
  },
  {
    id: "demo-9",
    leagueId: "liga",
    home: t("Atlético", "ATM", "#cb3524"),
    away: t("Séville", "SEV", "#d2001f"),
    day: 1,
    time: "13:00",
    status: "SCHEDULED",
    prediction: pred("demo-9", 0.48, 0.3, 0.22, ["Non", 0.58], ["Under", 0.6], "Moyen", "Victoire Atlético"),
  },
];

export const demoMatchById = (id: string) => DEMO_MATCHES.find((m) => m.id === id);

export const CREDIT_PACKS = [
  { id: "decouverte", name: "Découverte", credits: 5, priceHtg: 100 },
  { id: "weekend", name: "Week-end", credits: 15, priceHtg: 250 },
  { id: "pro", name: "Pro", credits: 40, priceHtg: 500 },
] as const;

export const COST = { STANDARD: 1, DEEP: 2 } as const;
export const SIGNUP_CREDITS = 3;
