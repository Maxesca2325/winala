import { odds, pct, type ModelOutput } from "./model.ts";

/**
 * v1 has NO LLM: the three arguments are fixed French templates filled with
 * the model's own numbers. Nothing here creates or changes a probability.
 * Same logic lives in supabase/functions/_shared/arguments.ts for ingestion.
 */
export function buildArguments(
  m: Pick<ModelOutput, "probabilities" | "markets" | "value_bet" | "expected_goals">,
  home: string,
  away: string,
  opts: { valueBetAllowed: boolean },
): [string, string, string] {
  const { home: ph, draw: pd, away: pa } = m.probabilities;
  const fav = ph >= pa ? { name: home, p: ph, other: away, q: pa } : { name: away, p: pa, other: home, q: ph };

  const gap = fav.p - fav.q;
  const first =
    pd >= Math.max(ph, pa)
      ? `Match très serré : le nul est l'issue la plus probable (${pct(pd)}), devant ${home} (${pct(ph)}) et ${away} (${pct(pa)}).`
      : gap >= 0.2
        ? `${fav.name} gagne dans ${pct(fav.p)} des scénarios du modèle, contre ${pct(fav.q)} pour ${fav.other}. Écart net.`
        : gap >= 0.08
          ? `${fav.name} part devant (${pct(fav.p)}) mais ${fav.other} reste dans le coup (${pct(fav.q)}), avec ${pct(pd)} de nul.`
          : `Match équilibré : ${home} ${pct(ph)}, nul ${pct(pd)}, ${away} ${pct(pa)}.`;

  const btts = m.markets.btts;
  const second =
    btts.prediction === "Oui"
      ? `Les deux équipes marquent dans ${pct(btts.confidence)} des cas simulés : les deux attaques ont de quoi trouver le chemin des filets.`
      : `Au moins une équipe reste muette dans ${pct(btts.confidence)} des cas simulés : une défense devrait prendre le dessus.`;

  const ou = m.markets.over_under_2_5;
  const xg = m.expected_goals ? ` (${m.expected_goals.home.toFixed(1).replace(".", ",")} – ${m.expected_goals.away.toFixed(1).replace(".", ",")} buts attendus)` : "";
  const goals =
    ou.prediction === "Over"
      ? `Plus de 2,5 buts dans ${pct(ou.confidence)} des scénarios${xg} : le modèle attend un match ouvert.`
      : `Moins de 2,5 buts dans ${pct(ou.confidence)} des scénarios${xg} : le modèle attend un match fermé.`;
  const cs = m.markets.correct_score;
  let third = cs
    ? `Score le plus probable : ${cs.prediction} (${pct(cs.confidence)}). Un score exact reste rare : environ 1 fois sur ${Math.max(2, Math.round(1 / cs.confidence))}.`
    : goals;

  if (opts.valueBetAllowed && m.value_bet && m.value_bet.edge_percent > 0) {
    const v = m.value_bet;
    third = `Sur « ${v.market} », la cote proposée (${odds(v.bookmaker_odds)}) dépasse la cote juste du modèle (${odds(v.model_fair_odds)}) : écart de +${Math.round(v.edge_percent)} %.`;
  }

  return cs ? [first, goals, third] : [first, second, third];
}
