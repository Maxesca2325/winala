"use client";

import Link from "next/link";
import { Coins } from "lucide-react";
import { LIVE, useAuth } from "@/lib/backend";

/** Right-side header action that reflects the login state, so the public
 * pages (landing, tracker) don't look "logged out" when you actually are in. */
export function HeaderCta() {
  const { ready, session, credits } = useAuth();

  if (!LIVE) {
    return (
      <a href="#liste" className="rounded-lg bg-surface-2 px-3 py-2 font-semibold hover:bg-surface-3">
        Rejoindre
      </a>
    );
  }
  if (ready && session) {
    return (
      <Link
        href="/app/credits"
        className="flex h-9 items-center gap-1.5 rounded-full border border-line bg-surface pl-2.5 pr-3 text-sm font-semibold"
        aria-label={`Solde : ${credits ?? 0} crédit${(credits ?? 0) > 1 ? "s" : ""}`}
      >
        <Coins size={16} className="text-accent-ink" aria-hidden="true" />
        <span className="font-display text-base">{credits ?? "…"}</span>
        <span className="text-text-2">crédit{(credits ?? 0) > 1 ? "s" : ""}</span>
      </Link>
    );
  }
  return (
    <Link href="/connexion" className="rounded-lg bg-surface-2 px-3 py-2 font-semibold hover:bg-surface-3">
      Connexion
    </Link>
  );
}
