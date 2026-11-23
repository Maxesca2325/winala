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
    over_under_2_5: { prediction: "Over" | "Under"; confidence: number; over?: number };
    over_under_1_5?: { prediction: "Over" | "Under"; confidence: number; over?: number };
    over_under_3_5?: { prediction: "Over" | "Under"; confidence: number; over?: number };
    /** Double chance: P(1X), P(12), P(X2). */
    double_chance?: { "1X": number; "12": number; "X2": number };
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

export type RecoTier = "fort" | "solide" | "leger";
export interface Reco {
  label: string;
  prob: number;
  tier: RecoTier;
}

const tierOf = (p: number): RecoTier => (p >= 0.75 ? "fort" : p >= 0.65 ? "solide" : "leger");

/**
 * Turns the model's numbers into actionable advice: the markets worth a bet,
 * ranked by confidence. Only signals clearly above a coin flip make the list;
 * a genuinely even match returns [] on purpose (we say so rather than pretend).
 */
export function recommendations(m: ModelOutput, home: string, away: string): Reco[] {
  const mk = m.markets;
  const p = m.probabilities;
  const out: Reco[] = [];

  // Result: prefer the safer double chance when we have it.
  if (mk.double_chance) {
    const dc = mk.double_chance;
    const opts: [string, number][] = [
      [`${home} ou nul`, dc["1X"]],
      [`${home} ou ${away}`, dc["12"]],
      [`nul ou ${away}`, dc["X2"]],
    ];
    const [lab, pr] = opts.reduce((a, b) => (b[1] > a[1] ? b : a));
    out.push({ label: `Double chance : ${lab}`, prob: pr, tier: tierOf(pr) });
  } else {
    const top = Math.max(p.home, p.draw, p.away);
    const lab = p.home === top ? `Victoire ${home}` : p.away === top ? `Victoire ${away}` : "Match nul";
    out.push({ label: lab, prob: top, tier: tierOf(top) });
  }

  // Goals: the single most confident over/under line.
  const lines: [string, { over?: number; prediction: "Over" | "Under"; confidence: number } | undefined][] = [
    ["1,5", mk.over_under_1_5],
    ["2,5", mk.over_under_2_5],
    ["3,5", mk.over_under_3_5],
  ];
  const goals: [string, number][] = [];
  for (const [line, v] of lines) {
    if (!v) continue;
    const over = v.over ?? (v.prediction === "Over" ? v.confidence : 1 - v.confidence);
    goals.push([`Plus de ${line} buts`, over], [`Moins de ${line} buts`, 1 - over]);
  }
  if (goals.length) {
    const [lab, pr] = goals.reduce((a, b) => (b[1] > a[1] ? b : a));
    out.push({ label: lab, prob: pr, tier: tierOf(pr) });
  }

  // Both teams to score.
  out.push({
    label: mk.btts.prediction === "Oui" ? "Les deux équipes marquent" : "Une équipe ne marque pas",
    prob: mk.btts.confidence,
    tier: tierOf(mk.btts.confidence),
  });

  // Keep only what clearly beats a coin flip; strongest first, max 3.
  return out.filter((r) => r.prob >= 0.6).sort((a, b) => b.prob - a.prob).slice(0, 3);
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
