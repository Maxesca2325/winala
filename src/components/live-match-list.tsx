"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight, Gift, Lock, LockOpen, RefreshCw, Search, X } from "lucide-react";
import { ConfidenceChip, Crest } from "./analysis";
import { LEAGUES } from "@/lib/demo-data";
import { haitiDayRange, haitiTime, sb, teamFromName, useAuth, type MatchCard } from "@/lib/backend";

export function LiveMatchList() {
  const [day, setDay] = useState<0 | 1 | 2>(0);
  const [league, setLeague] = useState("all");
  const [attempt, setAttempt] = useState(0);
  const { session } = useAuth();
  const key = `${day}:${session?.user.id ?? ""}:${attempt}`;
  const [result, setResult] = useState<{ key: string; cards: MatchCard[]; error: boolean } | null>(null);

  useEffect(() => {
    let alive = true;
    const [from, to] = haitiDayRange(day);
    sb()
      .rpc("match_cards", { p_from: from, p_to: to })
      .then(({ data, error: e }) => {
        if (alive) setResult({ key, cards: (data as MatchCard[] | null) ?? [], error: Boolean(e) });
      });
    return () => {
      alive = false;
    };
  }, [day, key]);

  const cards = result?.key === key ? result.cards : null;
  const error = result?.key === key && result.error;

  const [q, setQ] = useState("");
  const [search, setSearch] = useState<MatchCard[] | null>(null);
  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) return; // stale results are ignored while not searching
    let alive = true;
    const t = setTimeout(() => {
      sb()
        .rpc("search_matches", { p_query: query })
        .then(({ data }) => {
          if (alive) setSearch((data as MatchCard[] | null) ?? []);
        });
    }, 300);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q, session?.user.id]);

  const shown = (cards ?? []).filter((m) => league === "all" || m.league_id === league);
  const free = shown.find((m) => m.is_free && m.status === "SCHEDULED");
  const groups = LEAGUES.map((l) => ({ league: l, items: shown.filter((m) => m.league_id === l.id) })).filter((g) => g.items.length);

  const searching = q.trim().length >= 2;
  return (
    <div className="space-y-4">
      <div className="relative">
        <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-3" aria-hidden="true" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          type="search"
          enterKeyHint="search"
          placeholder="Chercher une équipe ou un match…"
          aria-label="Chercher un match"
          className="h-11 w-full rounded-xl border border-line bg-surface pl-10 pr-10 text-base outline-none placeholder:text-text-3 focus:border-accent"
        />
        {q && (
          <button type="button" onClick={() => setQ("")} aria-label="Effacer la recherche" className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 text-text-2 hover:text-text">
            <X size={16} />
          </button>
        )}
      </div>

      {searching ? (
        <SearchResults results={search} />
      ) : (
      <>
      <div className="space-y-3">
        <div role="tablist" aria-label="Jour" className="grid grid-cols-3 rounded-xl bg-surface p-1">
          {([0, 1, 2] as const).map((d) => (
            <button
              key={d}
              role="tab"
              aria-selected={day === d}
              onClick={() => setDay(d)}
              className={`h-9 rounded-lg text-sm font-semibold transition-colors ${
                day === d ? "bg-surface-3 text-text" : "text-text-2 hover:text-text"
              }`}
            >
              {d === 0 ? "Aujourd'hui" : d === 1 ? "Demain" : "Après-demain"}
            </button>
          ))}
        </div>
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4" aria-label="Filtrer par ligue">
          {[{ id: "all", name: "Toutes" }, ...LEAGUES.filter((l) => l.id !== "ucl")].map((l) => (
            <button
              key={l.id}
              onClick={() => setLeague(l.id)}
              aria-pressed={league === l.id}
              className={`h-8 shrink-0 rounded-full border px-3.5 text-sm font-semibold transition-colors ${
                league === l.id ? "border-text bg-text text-bg" : "border-line text-text-2 hover:text-text"
              }`}
            >
              {l.name}
            </button>
          ))}
        </div>
      </div>

      {cards === null ? (
        <div className="space-y-3" aria-label="Chargement">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-card bg-surface" />
          ))}
        </div>
      ) : error ? (
        <button
          onClick={() => setAttempt((a) => a + 1)}
          className="flex w-full items-center justify-center gap-2 rounded-card border border-line bg-surface px-4 py-8 text-text-2"
        >
          <RefreshCw size={16} aria-hidden="true" /> Connexion difficile. Touche pour réessayer.
        </button>
      ) : (
        <>
          {free && <FreeCard m={free} />}
          {groups.length === 0 ? (
            <p className="rounded-card border border-dashed border-line px-4 py-10 text-center text-text-2">
              Pas de match analysé pour ce jour. Les analyses sont publiées quelques jours avant les matchs.
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
                      <Row m={m} />
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </>
      )}
      </>
      )}
      <p className="text-center text-xs text-text-3">Heures affichées à l&apos;heure d&apos;Haïti.</p>
    </div>
  );
}

function SearchResults({ results }: { results: MatchCard[] | null }) {
  if (results === null) return <div className="h-24 animate-pulse rounded-card bg-surface" aria-label="Recherche" />;
  if (results.length === 0)
    return (
      <p className="rounded-card border border-dashed border-line px-4 py-10 text-center text-text-2">
        Aucun match à venir pour cette recherche. On publie les analyses quelques jours avant les matchs.
      </p>
    );
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
      {results.map((m) => (
        <li key={m.id}>
          <Row m={m} showLeague />
        </li>
      ))}
    </ul>
  );
}

function FreeCard({ m }: { m: MatchCard }) {
  const home = teamFromName(m.home_team);
  const away = teamFromName(m.away_team);
  return (
    <Link
      href={`/app/match?id=${encodeURIComponent(m.id)}`}
      className="group block rounded-card border border-accent/40 bg-accent/[0.08] p-4 transition-colors hover:bg-accent/[0.12]"
    >
      <div className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-accent-ink">
        <Gift size={16} aria-hidden="true" /> Prono du jour · offert
      </div>
      <div className="flex items-center gap-3">
        <Crest team={home} size={36} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">
            {m.home_team} – {m.away_team}
          </div>
          <div className="text-sm text-text-2">Analyse complète gratuite</div>
        </div>
        <Crest team={away} size={36} />
      </div>
      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="text-text-2">{haitiTime(m.kickoff_time)}</span>
        <span className="flex items-center gap-1 font-semibold text-accent-ink">
          Voir l&apos;analyse <ChevronRight size={16} aria-hidden="true" />
        </span>
      </div>
    </Link>
  );
}

function Row({ m, showLeague = false }: { m: MatchCard; showLeague?: boolean }) {
  const off = m.status === "POSTPONED" || m.status === "CANCELLED";
  const started = m.status !== "SCHEDULED" || new Date(m.kickoff_time) <= new Date();
  const open = Boolean(m.unlocked) || m.is_free;
  return (
    <Link
      href={`/app/match?id=${encodeURIComponent(m.id)}`}
      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2 active:bg-surface-2"
    >
      <span className={`w-14 shrink-0 text-sm font-semibold ${off ? "text-bad" : "text-text-2"}`}>
        {off ? "Rep." : haitiTime(m.kickoff_time)}
        {showLeague && <span className="mt-0.5 block truncate text-[0.65rem] font-normal text-text-3">{m.league_name}</span>}
      </span>
      <div className="min-w-0 flex-1 space-y-1.5">
        {[m.home_team, m.away_team].map((t) => (
          <div key={t} className="flex items-center gap-2">
            <Crest team={teamFromName(t)} size={20} />
            <span className={`truncate text-[0.95rem] font-semibold ${off ? "text-text-2" : ""}`}>{t}</span>
          </div>
        ))}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {off ? (
          <span className="text-xs font-semibold text-bad">{m.status === "POSTPONED" ? "Reporté" : "Annulé"}</span>
        ) : m.is_free ? (
          <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent-ink">Offert</span>
        ) : started && !open ? (
          <span className="text-xs text-text-3">Commencé</span>
        ) : m.confidence ? (
          <ConfidenceChip value={m.confidence} compact />
        ) : null}
        {!off &&
          (open ? (
            <LockOpen size={16} className="text-good" aria-label="Débloqué" />
          ) : (
            <Lock size={16} className="text-text-3" aria-label="Verrouillé" />
          ))}
      </div>
    </Link>
  );
}
