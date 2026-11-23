import { Lock, ShieldAlert, TrendingUp, UsersRound } from "lucide-react";
import { buildArguments } from "@/lib/arguments";
import { confidenceOf, odds, pct, type Confidence, type ModelOutput } from "@/lib/model";
import type { Team } from "@/lib/demo-data";

export function ExampleTag({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-md border border-dashed border-text-3/60 px-1.5 py-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.06em] text-text-2 ${className}`}
      title="Données d'exemple pour montrer l'interface. Pas un pronostic."
    >
      Exemple
    </span>
  );
}

function isLight(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 150;
}

export function Crest({ team, size = 32 }: { team: Team; size?: number }) {
  const light = isLight(team.color);
  return (
    <span
      aria-hidden="true"
      className={`inline-grid shrink-0 place-items-center rounded-full font-bold ${light ? "text-black/80" : "text-white"}`}
      style={{
        width: size,
        height: size,
        background: team.color,
        fontSize: size * 0.3,
        fontStretch: "80%",
        boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.18)",
        textShadow: light ? "none" : "0 1px 1px rgb(0 0 0 / 0.45)",
      }}
    >
      {team.short}
    </span>
  );
}

const confStyle: Record<Confidence, string> = {
  élevée: "text-good border-good/40 bg-good/10",
  moyenne: "text-warn border-warn/40 bg-warn/10",
  faible: "text-text-2 border-line bg-surface-2",
};

export function ConfidenceChip({ value, compact = false }: { value: Confidence; compact?: boolean }) {
  const dots = value === "élevée" ? 3 : value === "moyenne" ? 2 : 1;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold ${confStyle[value]}`}
    >
      <span className="flex gap-0.5" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`h-1.5 w-1.5 rounded-full ${i < dots ? "bg-current" : "bg-current opacity-25"}`}
          />
        ))}
      </span>
      {compact ? value : `Confiance ${value}`}
    </span>
  );
}

export function ProbabilityBar({
  p,
  home,
  away,
}: {
  p: ModelOutput["probabilities"];
  home: string;
  away: string;
}) {
  const parts = [
    { key: "home", label: home, v: p.home, color: "var(--home)" },
    { key: "draw", label: "Nul", v: p.draw, color: "var(--draw)" },
    { key: "away", label: away, v: p.away, color: "var(--away)" },
  ];
  const top = Math.max(p.home, p.draw, p.away);
  return (
    <div>
      <div
        className="bar-grow flex h-3 w-full gap-[3px] overflow-hidden rounded-full"
        role="img"
        aria-label={`Probabilités : ${home} ${pct(p.home)}, nul ${pct(p.draw)}, ${away} ${pct(p.away)}`}
      >
        {parts.map((x) => (
          <span key={x.key} style={{ width: `${x.v * 100}%`, background: x.color }} className="h-full first:rounded-l-full last:rounded-r-full" />
        ))}
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2">
        {parts.map((x) => (
          <div key={x.key} className={x.key === "draw" ? "text-center" : x.key === "away" ? "text-right" : ""}>
            <dt className="truncate text-xs text-text-2">{x.label}</dt>
            <dd
              className={`font-display text-[1.75rem] leading-none ${x.v === top ? "text-text" : "text-text-2"}`}
              style={x.v === top ? { color: x.color } : undefined}
            >
              {Math.round(x.v * 100)}
              <span className="ml-0.5 text-base font-semibold">%</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function MarketRow({ label, pick, value }: { label: string; pick: string; value: number }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="text-sm text-text-2">{label}</div>
        <div className="font-semibold">{pick}</div>
      </div>
      <div className="w-24">
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
          <div className="bar-grow h-full rounded-full bg-text" style={{ width: `${value * 100}%` }} />
        </div>
      </div>
      <div className="w-12 text-right font-display text-xl">{Math.round(value * 100)}%</div>
    </div>
  );
}

const riskColor = { Faible: "text-good", Moyen: "text-warn", Élevé: "text-bad" } as const;

export function AnalysisView({
  prediction,
  home,
  away,
  leagueCalibrated,
  deep,
  lineupUpdated,
  demo = true,
  upgradeSlot,
}: {
  prediction: ModelOutput;
  home: Team;
  away: Team;
  leagueCalibrated: boolean;
  deep: boolean;
  lineupUpdated?: boolean;
  demo?: boolean;
  upgradeSlot?: React.ReactNode;
}) {
  const conf = confidenceOf(prediction.probabilities);
  const vbAllowed = leagueCalibrated && deep;
  const args =
    prediction.key_arguments.length === 3
      ? prediction.key_arguments
      : buildArguments(prediction, home.name, away.name, { valueBetAllowed: vbAllowed });
  const ou = prediction.markets.over_under_2_5;
  const vb = prediction.value_bet;

  return (
    <div className="reveal space-y-3">
      <section className="rounded-card border border-line bg-surface p-4">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-text-2">Probabilités 1X2</h3>
          <div className="flex items-center gap-2">
            {demo && <ExampleTag />}
            <ConfidenceChip value={conf} compact />
          </div>
        </div>
        <ProbabilityBar p={prediction.probabilities} home={home.name} away={away.name} />
        {lineupUpdated && (
          <p className="mt-4 flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-xs text-text-2">
            <UsersRound size={14} aria-hidden="true" />
            Mis à jour avec les compositions officielles (H-1). Gratuit pour toi.
          </p>
        )}
      </section>

      <section className="rounded-card border border-line bg-surface px-4 py-2 divide-y divide-line">
        <MarketRow
          label="Les deux équipes marquent"
          pick={prediction.markets.btts.prediction}
          value={prediction.markets.btts.confidence}
        />
        <MarketRow
          label="Buts dans le match"
          pick={ou.prediction === "Over" ? "Plus de 2,5" : "Moins de 2,5"}
          value={ou.confidence}
        />
        <div className="flex items-center justify-between py-2.5">
          <span className="text-sm text-text-2">Niveau de risque</span>
          <span className={`flex items-center gap-1.5 font-semibold ${riskColor[prediction.risk_level]}`}>
            <ShieldAlert size={16} aria-hidden="true" />
            {prediction.risk_level}
          </span>
        </div>
      </section>

      {prediction.markets.top_scores && prediction.markets.top_scores.length > 0 && (
        <section className="rounded-card border border-line bg-surface p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-text-2">Score exact</h3>
            {demo && <ExampleTag />}
          </div>
          <ul className="space-y-2">
            {prediction.markets.top_scores.slice(0, 5).map((t, i) => (
              <li key={t.score} className="flex items-center gap-3">
                <span className={`w-12 font-display text-xl ${i === 0 ? "text-text" : "text-text-2"}`}>{t.score}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
                  <span
                    className={`bar-grow block h-full rounded-full ${i === 0 ? "bg-accent" : "bg-text-3"}`}
                    style={{ width: `${Math.min(100, (t.probability / prediction.markets.top_scores![0].probability) * 100)}%` }}
                  />
                </span>
                <span className="w-12 text-right font-display text-lg">{Math.round(t.probability * 100)}%</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-text-2">
            Même le score le plus probable n&apos;arrive qu&apos;environ 1 fois sur{" "}
            {Math.max(2, Math.round(1 / prediction.markets.top_scores[0].probability))}. Mise prudemment.
          </p>
        </section>
      )}

      {leagueCalibrated && vb && vb.edge_percent > 0 && deep && (
        <section className="rounded-card border border-accent/50 bg-accent/[0.07] p-4">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-semibold">
              <TrendingUp size={18} className="text-accent-ink" aria-hidden="true" />
              Value bet
            </h3>
            {demo && <ExampleTag />}
          </div>
          <p className="mt-1 text-sm text-text-2">{vb.market}</p>
          <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-surface p-2">
              <dt className="text-[0.7rem] text-text-2">Cote proposée</dt>
              <dd className="font-display text-xl">{odds(vb.bookmaker_odds)}</dd>
            </div>
            <div className="rounded-lg bg-surface p-2">
              <dt className="text-[0.7rem] text-text-2">Cote juste</dt>
              <dd className="font-display text-xl">{odds(vb.model_fair_odds)}</dd>
            </div>
            <div className="rounded-lg bg-surface p-2">
              <dt className="text-[0.7rem] text-text-2">Écart</dt>
              <dd className="font-display text-xl text-accent-ink">+{Math.round(vb.edge_percent)}%</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-text-2">
            Un écart positif veut dire que la cote paraît plus généreuse que la probabilité calculée. Ce n&apos;est pas une garantie.
          </p>
        </section>
      )}

      {leagueCalibrated && vb && vb.edge_percent > 0 && !deep && upgradeSlot}

      {!leagueCalibrated && (
        <p className="rounded-card border border-line bg-surface p-4 text-sm text-text-2">
          Pas de value bet sur cette compétition : les données sont trop minces pour que le modèle soit calibré.
        </p>
      )}

      <section className="rounded-card border border-line bg-surface p-4">
        <h3 className="mb-3 text-sm font-semibold text-text-2">Pourquoi</h3>
        <ol className="space-y-3">
          {args.map((a, i) => (
            <li key={i} className="flex gap-3 text-[0.95rem] leading-snug">
              <span className="font-display mt-0.5 w-4 shrink-0 text-text-3">{i + 1}</span>
              <span>{a}</span>
            </li>
          ))}
        </ol>
      </section>

      <p className="px-1 text-xs leading-relaxed text-text-3">
        Analyse statistique, pas un score garanti. Les probabilités viennent d&apos;un modèle mathématique ; elles peuvent se tromper.
      </p>
    </div>
  );
}

export function LockedPreview({ confidence }: { confidence: Confidence }) {
  return (
    <div className="rounded-card border border-line bg-surface p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-text-2">
          <Lock size={14} aria-hidden="true" />
          Analyse verrouillée
        </h3>
        <ConfidenceChip value={confidence} />
      </div>
      <div aria-hidden="true" className="select-none space-y-3">
        <div className="flex h-3 gap-[3px] overflow-hidden rounded-full">
          <span className="h-full w-[38%] rounded-l-full bg-surface-3" />
          <span className="h-full w-[30%] bg-surface-3" />
          <span className="h-full w-[32%] rounded-r-full bg-surface-3" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-2.5 w-14 rounded bg-surface-3" />
              <div className="h-6 w-10 rounded bg-surface-3" />
            </div>
          ))}
        </div>
        <div className="h-2.5 w-3/4 rounded bg-surface-3" />
        <div className="h-2.5 w-2/3 rounded bg-surface-3" />
      </div>
      <p className="mt-4 text-sm text-text-2">
        Seul l&apos;indice de confiance est visible. Les chiffres, les marchés et les arguments s&apos;affichent après déblocage.
      </p>
    </div>
  );
}
