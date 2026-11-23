import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { SignUp } from "@/components/sign-up";

export const metadata: Metadata = { title: "Inscription", robots: { index: false } };

export default function ConnexionPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col px-4 py-8">
      <Link href="/" className="self-start rounded-md" aria-label="Accueil">
        <Logo />
      </Link>
      <div className="mt-10">
        <h1 className="font-display text-5xl leading-none">Connexion</h1>
        <p className="mt-3 text-text-2">Google, ou ton email et un mot de passe. 3 crédits offerts à l&apos;inscription.</p>
      </div>
      <div className="mt-8">
        <SignUp />
      </div>
      <p className="mt-auto pt-10 text-xs text-text-3">
        18 ans et plus. Un seul compte par personne : les 3 crédits offerts ne sont donnés qu&apos;une fois par email.
      </p>
    </main>
  );
}
