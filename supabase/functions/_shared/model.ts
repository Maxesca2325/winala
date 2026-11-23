/**
 * Contract with the statistical model (Dixon-Coles / Poisson, built in Python,
 * outside this codebase). The front only READS this output: it never computes
 * or adjusts a probability. See brief §6 and PRODUCT.md.
 */

export type Risk = "Faible" | "Moyen" | "Élevé";

export interface ModelOutput {
  match_id: string;
  probabilities: { home: number; draw: number; away: number };
  top_pick: string;
  markets: {
    btts: { prediction: "Oui" | "Non"; confidence: number };
    over_under_2_5: { prediction: "Over" | "Under"; confidence: number };
    /** Most likely exact score and its probability. */
    correct_score?: { prediction: string; confidence: number };
    top_scores?: { score: string; probability: number }[];
  };
  expected_goals?: { home: number; away: number };
  value_bet: {
    market: string;
    bookmaker_odds: number;
    model_fair_odds: number;
    edge_percent: number;
  } | null;
  key_arguments: [string, string, string] | string[];
  risk_level: Risk;
}

export type Confidence = "faible" | "moyenne" | "élevée";

/** Public, number-free signal shown on locked matches. */
export function confidenceOf(p: ModelOutput["probabilities"]): Confidence {
  const top = Math.max(p.home, p.draw, p.away);
  if (top >= 0.6) return "élevée";
  if (top >= 0.45) return "moyenne";
  return "faible";
}

export function pct(x: number) {
  return `${Math.round(x * 100)} %`;
}

export function odds(x: number) {
  return x.toFixed(2).replace(".", ",");
}

/** Strict validation of the model JSON before it is stored or shown. */
export function parseModelOutput(input: unknown): ModelOutput {
  const fail = (why: string): never => {
    throw new Error(`Sortie du modèle invalide : ${why}`);
  };
  if (typeof input !== "object" || input === null) fail("objet attendu");
  const o = input as Record<string, unknown>;
  const num = (v: unknown, name: string, min = 0, max = 1) => {
    if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max)
      fail(`${name} hors bornes`);
    return v as number;
  };
  if (typeof o.match_id !== "string" || !o.match_id) fail("match_id");
  const p = o.probabilities as Record<string, unknown> | undefined;
  if (!p) fail("probabilities");
  const home = num(p!.home, "home");
  const draw = num(p!.draw, "draw");
  const away = num(p!.away, "away");
  if (Math.abs(home + draw + away - 1) > 0.02) fail("1X2 ne somme pas à 1");
  const m = o.markets as Record<string, Record<string, unknown>> | undefined;
  if (!m?.btts || !m?.over_under_2_5) fail("markets");
  if (m!.btts.prediction !== "Oui" && m!.btts.prediction !== "Non") fail("btts.prediction");
  if (m!.over_under_2_5.prediction !== "Over" && m!.over_under_2_5.prediction !== "Under")
    fail("over_under_2_5.prediction");
  num(m!.btts.confidence, "btts.confidence");
  num(m!.over_under_2_5.confidence, "over_under_2_5.confidence");
  const vb = o.value_bet as Record<string, unknown> | null | undefined;
  if (vb) {
    if (typeof vb.market !== "string") fail("value_bet.market");
    num(vb.bookmaker_odds, "bookmaker_odds", 1, 1000);
    num(vb.model_fair_odds, "model_fair_odds", 1, 1000);
    num(vb.edge_percent, "edge_percent", -100, 1000);
  }
  if (!["Faible", "Moyen", "Élevé"].includes(o.risk_level as string)) fail("risk_level");
  if (typeof o.top_pick !== "string") fail("top_pick");
  return {
    ...(o as unknown as ModelOutput),
    value_bet: vb ? (vb as unknown as ModelOutput["value_bet"]) : null,
  };
}
