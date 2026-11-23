import type { Metadata } from "next";
import Link from "next/link";
import { WifiOff } from "lucide-react";
import { Logo } from "@/components/logo";

export const metadata: Metadata = { title: "Hors connexion", robots: { index: false } };

export default function Offline() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <Logo />
      <WifiOff className="mt-6 text-text-3" size={32} aria-hidden="true" />
      <h1 className="font-display text-4xl">Pas de réseau</h1>
      <p className="max-w-xs text-text-2">
        Cette page n&apos;a pas encore été ouverte sur ce téléphone. Les pages déjà visitées restent disponibles. Réessaie dès que le
        réseau revient.
      </p>
      <Link href="/app" className="mt-2 rounded-xl bg-accent px-5 py-3 font-semibold text-on-accent">
        Réessayer
      </Link>
    </main>
  );
}
