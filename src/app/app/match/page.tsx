import { Suspense } from "react";
import { MatchView } from "@/components/match-view";

// Static route (/app/match?id=...) so the site can be served from any static host.
export default function MatchPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-card bg-surface" aria-label="Chargement" />}>
      <MatchView />
    </Suspense>
  );
}
