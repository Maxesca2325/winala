import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LIVE } from "@/lib/live";
import { WaitlistForm } from "./waitlist-form";

/** Live: sign up now. Without a backend: the waitlist. */
export function StartCta({ source }: { source: string }) {
  if (!LIVE) return <WaitlistForm source={source} />;
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Link
        href="/connexion"
        className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-accent px-5 font-semibold text-on-accent transition-colors hover:bg-accent-press"
      >
        Commencer · 3 crédits offerts <ArrowRight size={18} aria-hidden="true" />
      </Link>
      <Link
        href="/app"
        className="inline-flex h-12 items-center justify-center rounded-xl border border-line px-5 font-semibold hover:bg-surface-2"
      >
        Voir les matchs
      </Link>
    </div>
  );
}
