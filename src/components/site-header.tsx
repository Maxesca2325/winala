import Link from "next/link";
import { Logo } from "./logo";
import { LIVE } from "@/lib/live";
import { BrandLink, HeaderCta } from "./header-cta";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-bg/90 backdrop-blur-md supports-[backdrop-filter]:bg-bg/75">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
        <BrandLink size={26} />
        <nav className="flex items-center gap-1 text-sm">
          <Link href="/tracker" className="rounded-lg px-3 py-2 text-text-2 hover:text-text">
            Historique
          </Link>
          <Link href="/app" className="hidden rounded-lg px-3 py-2 text-text-2 hover:text-text sm:inline-block">
            {LIVE ? "Matchs" : "Démo"}
          </Link>
          <HeaderCta />
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line">
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-8 text-sm text-text-2">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Logo size={22} />
          <nav className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/tracker" className="hover:text-text">Historique public</Link>
            <Link href="/app" className="hover:text-text">{LIVE ? "Matchs" : "Démo de l'appli"}</Link>
            <Link href="/jeu-responsable" className="hover:text-text">Jeu responsable</Link>
          </nav>
        </div>
        <p className="max-w-2xl text-text-3">
          18 ans et plus. Winala publie des analyses statistiques : aucune garantie de résultat, aucune promesse de gain. Ne mise jamais
          l&apos;argent dont tu as besoin.
        </p>
      </div>
    </footer>
  );
}
