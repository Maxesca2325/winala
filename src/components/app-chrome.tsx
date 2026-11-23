"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useOffline } from "next/offline";
import { ChartNoAxesColumn, Coins, ListOrdered, Plus, WifiOff } from "lucide-react";
import { LogoMark } from "./logo";
import { useWallet } from "@/lib/demo-wallet";
import { LIVE, useAuth, useCreditsOnFocus } from "@/lib/backend";

function useBalance(): { credits: number | null; signedIn: boolean } {
  const demo = useWallet();
  const live = useAuth();
  useCreditsOnFocus();
  if (!LIVE) return { credits: demo.credits, signedIn: true };
  return { credits: live.credits, signedIn: Boolean(live.session) };
}

export function AppHeader() {
  const { credits: c, signedIn } = useBalance();
  const credits = c ?? 0;
  const offline = useOffline();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/95 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-2xl items-center gap-3 px-4">
        <Link href="/app" aria-label="Matchs" className="rounded-md">
          <LogoMark size={28} />
        </Link>
        <div className="flex-1" />
        {!signedIn ? (
          <Link
            href="/connexion"
            className="flex h-9 items-center rounded-full bg-accent px-4 text-sm font-semibold text-on-accent hover:bg-accent-press"
          >
            Connexion
          </Link>
        ) : (
        <>
        <Link
          href="/app/credits"
          className="flex h-9 items-center gap-1.5 rounded-full border border-line bg-surface pl-2.5 pr-3 text-sm font-semibold"
          aria-label={`Solde : ${credits} crédit${credits > 1 ? "s" : ""}`}
        >
          <Coins size={16} className="text-accent-ink" aria-hidden="true" />
          <span className="font-display text-base">{credits}</span>
          <span className="text-text-2">crédit{credits > 1 ? "s" : ""}</span>
        </Link>
        <Link
          href="/app/credits"
          className="flex h-9 items-center gap-1 rounded-full bg-accent px-3 text-sm font-semibold text-on-accent hover:bg-accent-press"
        >
          <Plus size={16} aria-hidden="true" />
          Recharger
        </Link>
        </>
        )}
      </div>
      {offline && (
        <div role="status" className="flex items-center justify-center gap-2 bg-surface-2 py-1.5 text-xs text-text-2">
          <WifiOff size={13} aria-hidden="true" /> Réseau coupé. On réessaie tout seul dès qu&apos;il revient.
        </div>
      )}
    </header>
  );
}

export function DemoBanner() {
  if (LIVE) return null;
  return (
    <div className="mx-auto max-w-2xl px-4 pt-3">
      <p className="rounded-lg border border-dashed border-text-3/50 px-3 py-2 text-xs leading-snug text-text-2">
        <strong className="text-text">Mode démo.</strong> Matchs, chiffres et crédits sont des exemples pour tester l&apos;appli. Ce ne
        sont pas des pronostics. Aucun paiement réel.
      </p>
    </div>
  );
}

const tabs = [
  { href: "/app", label: "Matchs", icon: ListOrdered, match: (p: string) => p === "/app" || p.startsWith("/app/match") },
  { href: "/tracker", label: "Historique", icon: ChartNoAxesColumn, match: (p: string) => p.startsWith("/tracker") },
  { href: "/app/credits", label: "Crédits", icon: Coins, match: (p: string) => p.startsWith("/app/credits") },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md"
    >
      <ul className="mx-auto grid max-w-2xl grid-cols-3">
        {tabs.map((t) => {
          const active = t.match(path);
          const Icon = t.icon;
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-14 flex-col items-center justify-center gap-0.5 text-[0.72rem] font-semibold ${
                  active ? "text-accent-ink" : "text-text-2 hover:text-text"
                }`}
              >
                <Icon size={20} aria-hidden="true" />
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
