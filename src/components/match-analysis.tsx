"use client";

import Link from "next/link";
import { useState } from "react";
import { Gift, LoaderCircle, RotateCcw, TrendingUp } from "lucide-react";
import { AnalysisView, LockedPreview } from "./analysis";
import { COST, type DemoMatch } from "@/lib/demo-data";
import { unlockMatch, useWallet, type AnalysisType } from "@/lib/demo-wallet";
import { confidenceOf } from "@/lib/model";

export function MatchAnalysis({ match, leagueCalibrated }: { match: DemoMatch; leagueCalibrated: boolean }) {
  const { unlocks, credits } = useWallet();
  const owned = match.freeOfTheDay ? "DEEP" : unlocks[match.id];
  const vb = match.prediction.value_bet;
  const hasValueBet = leagueCalibrated && Boolean(vb && vb.edge_percent > 0);

  if (match.status === "POSTPONED" || match.status === "CANCELLED") {
    return (
      <div className="rounded-card border border-line bg-surface p-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <RotateCcw size={18} className="text-text-2" aria-hidden="true" />
          Match {match.status === "POSTPONED" ? "reporté" : "annulé"}
        </h2>
        <p className="mt-2 text-text-2">
          Le déblocage est fermé. Si tu avais débloqué ce match, tes crédits sont revenus automatiquement sur ton compte.
        </p>
      </div>
    );
  }

  if (owned) {
    return (
      <>
        {match.freeOfTheDay && (
          <p className="flex items-center gap-2 rounded-lg bg-accent/10 px-3 py-2 text-sm font-semibold text-accent-ink">
            <Gift size={16} aria-hidden="true" /> Prono du jour : analyse complète offerte
          </p>
        )}
        <AnalysisView
          prediction={match.prediction}
          home={match.home}
          away={match.away}
          leagueCalibrated={leagueCalibrated}
          deep={owned === "DEEP"}
          lineupUpdated={match.lineupUpdated}
          upgradeSlot={<UnlockAction match={match} type="DEEP" owned={owned} credits={credits} />}
        />
      </>
    );
  }

  return (
    <div className="space-y-3">
      <LockedPreview confidence={confidenceOf(match.prediction.probabilities)} />
      <div className="space-y-2">
        <UnlockAction match={match} type="STANDARD" owned={undefined} credits={credits} primary />
        {hasValueBet && <UnlockAction match={match} type="DEEP" owned={undefined} credits={credits} />}
      </div>
    </div>
  );
}

function UnlockAction({
  match,
  type,
  owned,
  credits,
  primary = false,
}: {
  match: DemoMatch;
  type: AnalysisType;
  owned: AnalysisType | undefined;
  credits: number;
  primary?: boolean;
}) {
  const [step, setStep] = useState<"idle" | "confirm" | "pending">("idle");
  const [error, setError] = useState<string | null>(null);
  const cost = COST[type] - (owned ? COST[owned] : 0);
  const short = credits < cost;
  const label =
    type === "STANDARD" ? "Débloquer l'analyse" : owned ? "Ajouter le rapport Value Bet" : "Analyse + rapport Value Bet";

  async function run() {
    if (step === "pending") return;
    if (step === "idle") {
      setError(null);
      setStep("confirm");
      return;
    }
    setStep("pending");
    const res = await unlockMatch(match.id, type);
    if (!res.ok) {
      setStep("idle");
      setError(
        res.reason === "INSUFFICIENT_CREDITS"
          ? "Solde insuffisant."
          : res.reason === "MATCH_NOT_AVAILABLE"
            ? "Ce match n'est plus disponible."
            : null,
      );
    }
  }

  if (short && step === "idle") {
    return (
      <div className="rounded-card border border-line bg-surface p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-semibold">{label}</div>
            <div className="text-sm text-text-2">
              {cost} crédit{cost > 1 ? "s" : ""} · il t&apos;en reste {credits}
            </div>
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
          aria-live="polite"
          className={`flex h-14 flex-1 items-center justify-between gap-3 rounded-xl px-4 font-semibold transition-colors disabled:opacity-80 ${
            primary || step !== "idle"
              ? "bg-accent text-on-accent hover:bg-accent-press"
              : "border border-accent/50 bg-accent/[0.07] text-text hover:bg-accent/[0.12]"
          }`}
        >
          <span className="flex items-center gap-2">
            {step === "pending" ? (
              <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />
            ) : type === "DEEP" ? (
              <TrendingUp size={18} aria-hidden="true" />
            ) : null}
            {step === "pending" ? "Déblocage…" : step === "confirm" ? "Confirmer" : label}
          </span>
          <span className="font-display text-lg">
            {owned ? "+" : ""}
            {cost} cr
          </span>
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
        <p className="mt-2 px-1 text-sm text-text-2">
          {cost} crédit{cost > 1 ? "s" : ""} sera débité{cost > 1 ? "s" : ""} une seule fois. Solde après : {credits - cost}.
        </p>
      )}
      {error && <p className="mt-2 px-1 text-sm text-bad">{error}</p>}
    </div>
  );
}
