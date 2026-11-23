import { Crest } from "./analysis";
import { leagueById, type DemoMatch } from "@/lib/demo-data";

export function dayLabel(day: 0 | 1) {
  return day === 0 ? "Aujourd'hui" : "Demain";
}

export function MatchHeader({ match }: { match: DemoMatch }) {
  const league = leagueById(match.leagueId);
  const postponed = match.status === "POSTPONED" || match.status === "CANCELLED";
  return (
    <div className="rounded-card border border-line bg-surface p-4">
      <div className="mb-4 flex items-center justify-between text-xs text-text-2">
        <span className="font-semibold">{league.name}</span>
        <span>
          {postponed ? (
            <span className="font-semibold text-bad">{match.status === "POSTPONED" ? "Reporté" : "Annulé"}</span>
          ) : (
            <>
              {dayLabel(match.day)} · <span className="text-text">{match.time}</span>
            </>
          )}
        </span>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="flex flex-col items-center gap-2 text-center">
          <Crest team={match.home} size={48} />
          <span className="text-[0.95rem] font-semibold leading-tight">{match.home.name}</span>
        </div>
        <span className="font-display text-lg text-text-3">vs</span>
        <div className="flex flex-col items-center gap-2 text-center">
          <Crest team={match.away} size={48} />
          <span className="text-[0.95rem] font-semibold leading-tight">{match.away.name}</span>
        </div>
      </div>
    </div>
  );
}
