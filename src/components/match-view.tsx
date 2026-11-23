"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, Gift, LoaderCircle, RotateCcw, TrendingUp } from "lucide-react";
import { AnalysisView, Crest, LockedPreview } from "./analysis";
import { MatchHeader } from "./match-header";
import { MatchAnalysis } from "./match-analysis";
import { demoMatchById, leagueById } from "@/lib/demo-data";
import { errorText, haitiDay, haitiTime, LIVE, sb, teamFromName, useAuth, type Analysis, type MatchCard } from "@/lib/backend";

function Back() {
  return (
    <Link href="/app" className="-ml-1 inline-flex items-center gap-1 rounded-md py-1 text-sm font-semibold text-text-2 hover:text-text">
      <ChevronLeft size={18} aria-hidden="true" /> Matchs
    </Link>
  );
}

export function MatchView() {
  const id = useSearchParams().get("id") ?? "";
  if (!LIVE) {
    const match = demoMatchById(id);
    if (!match) return <NotFound />;
    return (
      <div className="space-y-3">
        <Back />
        <MatchHeader match={match} />
        <MatchAnalysis match={match} leagueCalibrated={leagueById(match.leagueId).calibrated} />
      </div>
    );
  }
  return <LiveMatch id={id} />;
}

function NotFound() {
  return (
    <div className="space-y-3">
      <Back />
      <p className="rounded-card border border-line bg-surface p-6 text-center text-text-2">Match introuvable.</p>
    </div>
  );
}

function LiveMatch({ id }: { id: string }) {
  const { session, ready, credits, setCredits } = useAuth();
  const [card, setCard] = useState<MatchCard | null | undefined>(undefined);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);

  useEffect(() => {
    if (!ready) return;
    let alive = true;
    (async () => {
      const { data } = await sb().rpc("match_card", { p_match_id: id });
      const c = ((data as MatchCard[] | null) ?? [])[0] ?? null;
      let a: Analysis | null = null;
      if (c && session && (c.unlocked || c.is_free)) {
        const { data: got } = await sb().rpc("get_analysis", { p_match_id: id });
        if (got && !(got as { locked?: boolean }).locked && (got as Analysis).content) a = got as Analysis;
      }
      if (!alive) return;
      setCard(c);
      setAnalysis(a);
    })();
    return () => {
      alive = false;
    };
  }, [ready, id, session]);

  if (card === undefined) return <div className="h-64 animate-pulse rounded-card bg-surface" aria-label="Chargement" />;
  if (card === null) return <NotFound />;

  const home = teamFromName(card.home_team);
  const away = teamFromName(card.away_team);
  const off = card.status === "POSTPONED" || card.status === "CANCELLED";
  const started = card.status !== "SCHEDULED" || new Date(card.kickoff_time) <= new Date();

  return (
    <div className="space-y-3">
      <Back />
      <div className="rounded-card border border-line bg-surface p-4">
        <div className="mb-4 flex items-center justify-between text-xs text-text-2">
          <span className="font-semibold">{card.league_name}</span>
          <span>
            {off ? (
              <span className="font-semibold text-bad">{card.status === "POSTPONED" ? "Reporté" : "Annulé"}</span>
            ) : (
              <>
                <span className="capitalize">{haitiDay(card.kickoff_time)}</span> · <span className="text-text">{haitiTime(card.kickoff_time)}</span>
              </>
            )}
          </span>
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          {[home, null, away].map((t, i) =>
            t ? (
              <div key={i} className="flex flex-col items-center gap-2 text-center">
                <Crest team={t} size={48} />
                <span className="text-[0.95rem] font-semibold leading-tight">{t.name}</span>
              </div>
            ) : (
              <span key={i} className="font-display text-lg text-text-3">
                vs
              </span>
            ),
          )}
        </div>
      </div>

      {off ? (
        <div className="rounded-card border border-line bg-surface p-5">
          <h2 className="flex items-center gap-2 font-semibold">
            <RotateCcw size={18} className="text-text-2" aria-hidden="true" /> Match {card.status === "POSTPONED" ? "reporté" : "annulé"}
          </h2>
          <p className="mt-2 text-text-2">Si tu avais débloqué ce match, tes crédits sont revenus automatiquement sur ton compte.</p>
        </div>
      ) : analysis ? (
        <>
          {card.is_free && (
            <p className="flex items-center gap-2 rounded-lg bg-accent/10 px-3 py-2 text-sm font-semibold text-accent-ink">
              <Gift size={16} aria-hidden="true" /> Prono du jour : analyse complète offerte
            </p>
          )}
          <AnalysisView
            prediction={analysis.content}
            home={home}
            away={away}
            leagueCalibrated={card.has_value_bet}
            deep={analysis.analysis_type === "DEEP"}
            lineupUpdated={analysis.is_lineup_updated}
            demo={false}
          />
        </>
      ) : (
        <div className="space-y-3">
          {card.confidence && <LockedPreview confidence={card.confidence} />}
          {started ? (
            <p className="rounded-card border border-line bg-surface p-4 text-sm text-text-2">
              Le match a commencé : le déblocage est fermé.
            </p>
          ) : !session ? (
            <Link
              href="/connexion"
              className="flex h-14 items-center justify-center rounded-xl bg-accent font-semibold text-on-accent hover:bg-accent-press"
            >
              {card.is_free ? "Connecte-toi pour voir le prono offert" : "Connecte-toi pour débloquer (3 crédits offerts)"}
            </Link>
          ) : (
            <UnlockButton
              id={id}
              free={card.is_free}
              credits={credits ?? 0}
              onDone={(a) => {
                setAnalysis(a);
                if (typeof a.balance === "number") setCredits(a.balance);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

function UnlockButton({
  id,
  free,
  credits,
  onDone,
}: {
  id: string;
  free: boolean;
  credits: number;
  onDone: (a: Analysis) => void;
}) {
  const [step, setStep] = useState<"idle" | "confirm" | "pending">("idle");
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const cost = free ? 0 : 1;

  async function run() {
    if (busy.current) return; // double tap on slow 3G: one request only (the DB also guarantees one debit)
    if (step === "idle" && cost > 0) {
      setStep("confirm");
      setError(null);
      return;
    }
    busy.current = true;
    setStep("pending");
    const { data, error: e } = await sb().rpc("unlock_match", { p_match_id: id, p_type: "STANDARD" });
    busy.current = false;
    if (e || !data) {
      setStep("idle");
      setError(errorText(e?.message));
      return;
    }
    onDone(data as Analysis);
  }

  if (cost > credits && step === "idle") {
    return (
      <div className="rounded-card border border-line bg-surface p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-semibold">Débloquer l&apos;analyse</div>
            <div className="text-sm text-text-2">1 crédit · il t&apos;en reste {credits}</div>
          </div>
          <Link href="/app/credits" className="shrink-0 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-on-accent">
            Recharger
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={run}
          disabled={step === "pending"}
          className="flex h-14 flex-1 items-center justify-between gap-3 rounded-xl bg-accent px-4 font-semibold text-on-accent transition-colors hover:bg-accent-press disabled:opacity-80"
        >
          <span className="flex items-center gap-2">
            {step === "pending" ? <LoaderCircle size={18} className="animate-spin" aria-hidden="true" /> : free ? <Gift size={18} aria-hidden="true" /> : <TrendingUp size={18} aria-hidden="true" />}
            {step === "pending" ? "Déblocage…" : step === "confirm" ? "Confirmer" : free ? "Voir le prono offert" : "Débloquer l'analyse"}
          </span>
          <span className="font-display text-lg">{free ? "0 cr" : "1 cr"}</span>
        </button>
        {step === "confirm" && (
          <button
            type="button"
            onClick={() => setStep("idle")}
            className="h-14 rounded-xl border border-line px-4 text-sm font-semibold text-text-2 hover:text-text"
          >
            Annuler
          </button>
        )}
      </div>
      {step === "confirm" && (
        <p className="mt-2 px-1 text-sm text-text-2">1 crédit sera débité une seule fois. Solde après : {credits - 1}.</p>
      )}
      {error && <p className="mt-2 px-1 text-sm text-bad">{error}</p>}
    </div>
  );
}
