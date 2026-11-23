"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight, Gift, Lock, LockOpen } from "lucide-react";
import { ConfidenceChip, Crest, ExampleTag } from "./analysis";
import { DEMO_MATCHES, LEAGUES, type DemoMatch } from "@/lib/demo-data";
import { useWallet } from "@/lib/demo-wallet";
import { confidenceOf } from "@/lib/model";

export function MatchList() {
  const [day, setDay] = useState<0 | 1>(0);
  const [league, setLeague] = useState<string>("all");
  const { unlocks } = useWallet();

  const matches = DEMO_MATCHES.filter((m) => m.day === day && (league === "all" || m.leagueId === league));
  const free = day === 0 ? DEMO_MATCHES.find((m) => m.freeOfTheDay) : undefined;
  const groups = LEAGUES.map((l) => ({ league: l, items: matches.filter((m) => m.leagueId === l.id) })).filter(
    (g) => g.items.length > 0,
  );

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div role="tablist" aria-label="Jour" className="grid grid-cols-2 rounded-xl bg-surface p-1">
          {([0, 1] as const).map((d) => (
            <button
              key={d}
              role="tab"
              aria-selected={day === d}
              onClick={() => setDay(d)}
              className={`h-9 rounded-lg text-sm font-semibold transition-colors ${
                day === d ? "bg-surface-3 text-text" : "text-text-2 hover:text-text"
              }`}
            >
              {d === 0 ? "Aujourd'hui" : "Demain"}
            </button>
          ))}
        </div>
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4" aria-label="Filtrer par ligue">
          {[{ id: "all", short: "Toutes" }, ...LEAGUES].map((l) => (
            <button
              key={l.id}
              onClick={() => setLeague(l.id)}
              aria-pressed={league === l.id}
              className={`h-8 shrink-0 rounded-full border px-3.5 text-sm font-semibold transition-colors ${
                league === l.id ? "border-text bg-text text-bg" : "border-line text-text-2 hover:text-text"
              }`}
            >
              {"name" in l ? l.name : l.short}
            </button>
          ))}
        </div>
      </div>

      {free && (league === "all" || league === free.leagueId) && <FreeOfTheDay match={free} />}

      {groups.length === 0 ? (
        <p className="rounded-card border border-dashed border-line px-4 py-10 text-center text-text-2">
          Aucun match pour ce filtre.
        </p>
      ) : (
        groups.map((g) => (
          <section key={g.league.id} className="overflow-hidden rounded-card border border-line bg-surface">
            <h2 className="flex items-center justify-between border-b border-line px-4 py-2.5 text-sm">
              <span className="font-semibold">{g.league.name}</span>
              <span className="text-text-3">{g.league.country}</span>
            </h2>
            <ul className="divide-y divide-line">
              {g.items.map((m) => (
                <li key={m.id}>
                  <MatchRow match={m} unlocked={Boolean(unlocks[m.id])} />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
      <p className="text-center text-xs text-text-3">Heures affichées à l&apos;heure d&apos;Haïti.</p>
    </div>
  );
}

function FreeOfTheDay({ match }: { match: DemoMatch }) {
  return (
    <Link
      href={`/app/match?id=${match.id}`}
      className="group block rounded-card border border-accent/40 bg-accent/[0.08] p-4 transition-colors hover:bg-accent/[0.12]"
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-accent-ink">
          <Gift size={16} aria-hidden="true" /> Prono du jour · offert
        </span>
        <ExampleTag />
      </div>
      <div className="flex items-center gap-3">
        <Crest team={match.home} size={36} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">
            {match.home.name} – {match.away.name}
          </div>
          <div className="text-sm text-text-2">Analyse complète gratuite, value bet compris</div>
        </div>
        <Crest team={match.away} size={36} />
      </div>
      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="text-text-2">{match.time}</span>
        <span className="flex items-center gap-1 font-semibold text-accent-ink">
          Voir l&apos;analyse <ChevronRight size={16} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </span>
      </div>
    </Link>
  );
}

function MatchRow({ match, unlocked }: { match: DemoMatch; unlocked: boolean }) {
  const postponed = match.status === "POSTPONED" || match.status === "CANCELLED";
  const conf = confidenceOf(match.prediction.probabilities);
  return (
    <Link
      href={`/app/match?id=${match.id}`}
      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2 active:bg-surface-2"
    >
      <span className={`w-11 shrink-0 text-sm font-semibold ${postponed ? "text-bad" : "text-text-2"}`}>
        {postponed ? "Rep." : match.time}
      </span>
      <div className="min-w-0 flex-1 space-y-1.5">
        {[match.home, match.away].map((t) => (
          <div key={t.short} className="flex items-center gap-2">
            <Crest team={t} size={20} />
            <span className={`truncate text-[0.95rem] font-semibold ${postponed ? "text-text-2" : ""}`}>{t.name}</span>
          </div>
        ))}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {postponed ? (
          <span className="text-xs font-semibold text-bad">Reporté</span>
        ) : match.freeOfTheDay ? (
          <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent-ink">Offert</span>
        ) : (
          <ConfidenceChip value={conf} compact />
        )}
        {!postponed &&
          (unlocked || match.freeOfTheDay ? (
            <LockOpen size={16} className="text-good" aria-label="Débloqué" />
          ) : (
            <Lock size={16} className="text-text-3" aria-label="Verrouillé" />
          ))}
      </div>
    </Link>
  );
}
