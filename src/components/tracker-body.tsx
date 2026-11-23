"use client";

import { useEffect, useState } from "react";
import { Check, Clock3, Minus, X } from "lucide-react";
import { LIVE, sb } from "@/lib/backend";
import { summarize } from "@/lib/tracker-summary";
import type { TrackerRow } from "@/lib/tracker-types";

const MARKETS = ["Tous", "1X2", "Plus/Moins 2,5", "BTTS", "Score exact"] as const;

export function TrackerBody() {
  const [rows, setRows] = useState<TrackerRow[] | null>(LIVE ? null : []);
  const [market, setMarket] = useState<(typeof MARKETS)[number]>("Tous");

  useEffect(() => {
    if (!LIVE) return;
    sb()
      .rpc("get_public_tracker", { p_limit: 500 })
      .then(({ data }) => setRows((data as TrackerRow[] | null) ?? []));
  }, []);

  if (rows === null) return <div className="mt-8 h-24 animate-pulse rounded-card bg-surface" aria-label="Chargement" />;

  const shown = market === "Tous" ? rows : rows.filter((r) => r.market === market);
  const s = summarize(shown);
  return (
    <>
      <div className="no-scrollbar -mx-4 mt-8 flex gap-2 overflow-x-auto px-4">
        {MARKETS.map((m) => (
          <button
            key={m}
            onClick={() => setMarket(m)}
            aria-pressed={market === m}
            className={`h-8 shrink-0 rounded-full border px-3.5 text-sm font-semibold ${
              market === m ? "border-text bg-text text-bg" : "border-line text-text-2 hover:text-text"
            }`}
          >
            {m === "BTTS" ? "Les deux marquent" : m}
          </button>
        ))}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line sm:grid-cols-4">
        {[
          ["Réglés", String(s.settled)],
          ["Gagnés", String(s.wins)],
          ["Réussite", s.rate === null ? "—" : `${Math.round(s.rate * 100)} %`],
          ["Attendu", s.settled ? s.expected.toFixed(1).replace(".", ",") : "—"],
        ].map(([k, v]) => (
          <div key={k} className="bg-surface px-4 py-4">
            <dt className="text-xs text-text-2">{k}</dt>
            <dd className="font-display text-3xl">{v}</dd>
          </div>
        ))}
      </dl>
      {s.brier !== null && <p className="mt-3 text-sm text-text-2">Score de Brier : {s.brier.toFixed(3).replace(".", ",")}</p>}

      {shown.length === 0 ? (
        <div className="mt-6 flex flex-col items-center gap-2 rounded-card border border-dashed border-line px-6 py-12 text-center">
          <Clock3 className="text-text-3" size={24} aria-hidden="true" />
          <p className="font-semibold">Aucun pronostic publié pour l&apos;instant.</p>
          <p className="max-w-sm text-sm text-text-2">
            On n&apos;affiche aucun chiffre tant qu&apos;il n&apos;y a pas de vrais pronostics publiés avant les matchs.
          </p>
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
          {shown.map((r) => (
            <TrackerItem key={r.id} r={r} />
          ))}
        </ul>
      )}
    </>
  );
}

const fmt = new Intl.DateTimeFormat("fr-HT", {
  timeZone: "America/Port-au-Prince",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const label = (m: string) => (m === "BTTS" ? "Les deux marquent" : m);

function TrackerItem({ r }: { r: TrackerRow }) {
  const icon =
    r.result === "WIN" ? (
      <Check className="text-good" size={18} aria-label="Gagné" />
    ) : r.result === "LOSS" ? (
      <X className="text-bad" size={18} aria-label="Perdu" />
    ) : r.result === "VOID" ? (
      <Minus className="text-text-3" size={18} aria-label="Annulé" />
    ) : (
      <Clock3 className="text-text-3" size={18} aria-label="En attente" />
    );
  const pick = r.predicted_pick === "Over" ? "Plus de 2,5" : r.predicted_pick === "Under" ? "Moins de 2,5" : r.predicted_pick;
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <span className="mt-1">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold">
          {r.home_team} – {r.away_team}
        </div>
        {r.predicted_pick !== null && r.probability !== null ? (
          <div className="text-sm text-text-2">
            {label(r.market)} : {pick} · {Math.round(Number(r.probability) * 100)} %
          </div>
        ) : (
          <div className="text-sm text-text-2">
            {label(r.market)} : scellé avant le match · empreinte{" "}
            <code className="font-mono text-xs" title={r.commitment}>
              {r.commitment.slice(0, 10)}…
            </code>
          </div>
        )}
        <div className="mt-0.5 text-xs text-text-3">
          {r.league_name} · publié le {fmt.format(new Date(r.published_at))}, coup d&apos;envoi {fmt.format(new Date(r.kickoff_time))}
        </div>
      </div>
    </li>
  );
}
