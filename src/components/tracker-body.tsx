"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Clock3, Lock, Minus, X } from "lucide-react";
import { LIVE, sb } from "@/lib/backend";
import { summarize } from "@/lib/tracker-summary";
import type { TrackerRow } from "@/lib/tracker-types";

const MARKETS = ["Tous", "1X2", "Plus/Moins 2,5", "BTTS", "Score exact"] as const;
const MARKET_ORDER = ["1X2", "Plus/Moins 2,5", "BTTS", "Score exact"];
const label = (m: string) => (m === "BTTS" ? "Les deux marquent" : m);
const pickLabel = (p: string | null) => (p === "Over" ? "Plus de 2,5" : p === "Under" ? "Moins de 2,5" : p);

const fmt = new Intl.DateTimeFormat("fr-HT", {
  timeZone: "America/Port-au-Prince",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

interface Group {
  match_id: string;
  home: string;
  away: string;
  league: string;
  kickoff: string;
  published: string;
  commitment: string;
  played: boolean;
  rows: TrackerRow[];
}

const SEALED_SHOWN = 20;

export function TrackerBody() {
  const [rows, setRows] = useState<TrackerRow[] | null>(LIVE ? null : []);
  const [market, setMarket] = useState<(typeof MARKETS)[number]>("Tous");
  const [now] = useState(() => Date.now());

  useEffect(() => {
    if (!LIVE) return;
    sb()
      .rpc("get_public_tracker", { p_limit: 1000 })
      .then(({ data }) => setRows((data as TrackerRow[] | null) ?? []));
  }, []);

  const groups = useMemo<Group[]>(() => {
    if (!rows) return [];
    const by = new Map<string, Group>();
    for (const r of rows) {
      if (market !== "Tous" && r.market !== market) continue;
      let g = by.get(r.match_id);
      if (!g) {
        g = {
          match_id: r.match_id,
          home: r.home_team,
          away: r.away_team,
          league: r.league_name,
          kickoff: r.kickoff_time,
          published: r.published_at,
          commitment: r.commitment,
          played: new Date(r.kickoff_time).getTime() <= now,
          rows: [],
        };
        by.set(r.match_id, g);
      }
      g.rows.push(r);
    }
    for (const g of by.values()) g.rows.sort((a, b) => MARKET_ORDER.indexOf(a.market) - MARKET_ORDER.indexOf(b.market));
    return [...by.values()];
  }, [rows, market, now]);

  if (rows === null) return <div className="mt-8 h-24 animate-pulse rounded-card bg-surface" aria-label="Chargement" />;

  const s = summarize(market === "Tous" ? rows : rows.filter((r) => r.market === market));
  const played = groups.filter((g) => g.played).sort((a, b) => +new Date(b.kickoff) - +new Date(a.kickoff));
  const sealed = groups.filter((g) => !g.played).sort((a, b) => +new Date(a.kickoff) - +new Date(b.kickoff));

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

      {groups.length === 0 ? (
        <div className="mt-6 flex flex-col items-center gap-2 rounded-card border border-dashed border-line px-6 py-12 text-center">
          <Clock3 className="text-text-3" size={24} aria-hidden="true" />
          <p className="font-semibold">Aucun pronostic publié pour l&apos;instant.</p>
        </div>
      ) : (
        <>
          {played.length > 0 && (
            <section className="mt-8">
              <h2 className="mb-3 text-sm font-semibold text-text-2">Résultats</h2>
              <div className="space-y-3">
                {played.map((g) => (
                  <PlayedCard key={g.match_id} g={g} />
                ))}
              </div>
            </section>
          )}

          {sealed.length > 0 && (
            <section className="mt-8">
              <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-text-2">
                <Lock size={14} aria-hidden="true" /> Pronostics scellés · à venir
              </h2>
              <p className="mb-3 text-xs text-text-3">
                Publiés et horodatés avant le coup d&apos;envoi. Les chiffres apparaissent, et le résultat, après le match.
              </p>
              <div className="space-y-2">
                {sealed.slice(0, SEALED_SHOWN).map((g) => (
                  <SealedCard key={g.match_id} g={g} />
                ))}
              </div>
              {sealed.length > SEALED_SHOWN && (
                <p className="mt-3 text-center text-sm text-text-3">+ {sealed.length - SEALED_SHOWN} autres matchs scellés à venir</p>
              )}
            </section>
          )}
        </>
      )}
    </>
  );
}

function resultIcon(result: TrackerRow["result"]) {
  if (result === "WIN") return <Check className="text-good" size={16} aria-label="Gagné" />;
  if (result === "LOSS") return <X className="text-bad" size={16} aria-label="Perdu" />;
  if (result === "VOID") return <Minus className="text-text-3" size={16} aria-label="Annulé" />;
  return <Clock3 className="text-text-3" size={16} aria-label="Résultat à venir" />;
}

function PlayedCard({ g }: { g: Group }) {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface">
      <div className="border-b border-line px-4 py-2.5">
        <div className="truncate font-semibold">
          {g.home} – {g.away}
        </div>
        <div className="text-xs text-text-3">
          {g.league} · coup d&apos;envoi {fmt.format(new Date(g.kickoff))}
        </div>
      </div>
      <ul className="divide-y divide-line">
        {g.rows.map((r) => (
          <li key={r.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
            <span>{resultIcon(r.result)}</span>
            <span className="flex-1 text-text-2">{label(r.market)}</span>
            <span className="font-semibold">
              {pickLabel(r.predicted_pick)}
              {r.probability !== null && <span className="ml-1 font-normal text-text-3">{Math.round(Number(r.probability) * 100)} %</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SealedCard({ g }: { g: Group }) {
  return (
    <div className="rounded-card border border-line bg-surface px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-semibold">
            {g.home} – {g.away}
          </div>
          <div className="text-xs text-text-3">
            {g.league} · coup d&apos;envoi {fmt.format(new Date(g.kickoff))}
          </div>
        </div>
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold text-text-2">
          <Lock size={11} aria-hidden="true" /> scellé
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {g.rows.map((r) => (
          <span key={r.id} className="rounded-md bg-surface-2 px-2 py-0.5 text-[0.7rem] font-semibold text-text-2">
            {label(r.market)}
          </span>
        ))}
        <code className="ml-auto font-mono text-[0.68rem] text-text-3" title={g.commitment}>
          empreinte {g.commitment.slice(0, 8)}…
        </code>
      </div>
    </div>
  );
}
