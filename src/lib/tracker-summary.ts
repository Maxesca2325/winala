import type { TrackerRow } from "./tracker-types";

export function summarize(rows: TrackerRow[]) {
  const settled = rows.filter(
    (r): r is TrackerRow & { probability: number } =>
      (r.result === "WIN" || r.result === "LOSS") && r.probability !== null,
  );
  const wins = settled.filter((r) => r.result === "WIN").length;
  // Brier score on the published pick: mean (p - outcome)^2. Lower is better.
  const brier = settled.length
    ? settled.reduce((s, r) => s + (r.probability - (r.result === "WIN" ? 1 : 0)) ** 2, 0) / settled.length
    : null;
  // Expected wins if the model were perfectly calibrated.
  const expected = settled.reduce((s, r) => s + r.probability, 0);
  return { settled: settled.length, wins, rate: settled.length ? wins / settled.length : null, brier, expected };
}
