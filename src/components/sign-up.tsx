"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { Check, LoaderCircle, Mail } from "lucide-react";
import { normalizeContact } from "@/lib/contact";
import { LIVE, sb, useAuth } from "@/lib/backend";
import { BASE_PATH } from "@/lib/base-path";

/**
 * Sign-up / sign-in with a one-time code (phone +509 by SMS, or email).
 * The 3 free credits are granted by the database trigger, never by the client.
 * Without Supabase configured, it runs as a labelled demo.
 */
export function SignUp() {
  const [step, setStep] = useState<"contact" | "code" | "done">("contact");
  const [contact, setContact] = useState<{ kind: "phone" | "email"; value: string } | null>(null);
  const [raw, setRaw] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const { session } = useAuth();
  const id = useId();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setError(null);
    if (step === "contact") {
      const c = normalizeContact(raw);
      if (!c) return setError("Numéro ou email invalide. Exemple : 3712 3456 ou toi@exemple.com");
      setPending(true);
      if (LIVE) {
        const redirect = `${window.location.origin}${BASE_PATH}/app/`;
        const { error: err } =
          c.kind === "phone"
            ? await sb().auth.signInWithOtp({ phone: c.value })
            : await sb().auth.signInWithOtp({ email: c.value, options: { emailRedirectTo: redirect } });
        setPending(false);
        if (err) {
          return setError(
            c.kind === "phone" && /provider|sms|phone/i.test(err.message)
              ? "La connexion par SMS n'est pas encore active. Utilise ton email pour l'instant."
              : /rate|seconds/i.test(err.message)
                ? "Trop de demandes. Attends une minute puis réessaie."
                : "Envoi impossible pour l'instant. Réessaie dans un instant.",
          );
        }
      } else {
        await new Promise((r) => setTimeout(r, 500));
        setPending(false);
      }
      setContact(c);
      setStep("code");
      return;
    }
    if (!/^\d{6}$/.test(code)) return setError("Le code a 6 chiffres.");
    setPending(true);
    if (LIVE && contact) {
      const { error: err } =
        contact.kind === "phone"
          ? await sb().auth.verifyOtp({ phone: contact.value, token: code, type: "sms" })
          : await sb().auth.verifyOtp({ email: contact.value, token: code, type: "email" });
      setPending(false);
      if (err) return setError("Code incorrect ou expiré. Vérifie et réessaie, ou demande un nouveau code.");
    } else {
      await new Promise((r) => setTimeout(r, 500));
      setPending(false);
    }
    setStep("done");
  }

  if (session && step !== "done") {
    return (
      <div className="space-y-4">
        <p className="rounded-card border border-line bg-surface p-4">
          Tu es connecté{session.user.email ? ` avec ${session.user.email}` : session.user.phone ? ` au +${session.user.phone}` : ""}.
        </p>
        <Link href="/app" className="flex h-14 items-center justify-center rounded-xl bg-accent font-semibold text-on-accent">
          Voir les matchs
        </Link>
        <button type="button" onClick={() => sb().auth.signOut()} className="w-full py-2 text-sm text-text-2 underline">
          Se déconnecter
        </button>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className="reveal space-y-5">
        <div className="flex items-start gap-3 rounded-card border border-good/40 bg-good/10 p-4">
          <Check className="mt-0.5 shrink-0 text-good" size={20} aria-hidden="true" />
          <p>
            <strong>Tu es connecté{LIVE ? "" : " (démo)"}.</strong> À la première connexion, 3 crédits t&apos;attendent.
          </p>
        </div>
        <Link href="/app" className="flex h-14 items-center justify-center rounded-xl bg-accent font-semibold text-on-accent">
          Voir les matchs
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      {step === "contact" ? (
        <>
          <label htmlFor={id} className="block text-sm font-medium text-text-2">
            Téléphone (+509) ou email
          </label>
          <input
            id={id}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            autoComplete="email"
            placeholder="3712 3456 ou toi@exemple.com"
            className="h-14 w-full rounded-xl border border-line bg-surface-2 px-4 text-lg outline-none placeholder:text-text-3 focus:border-accent"
          />
        </>
      ) : (
        <>
          {contact?.kind === "email" && LIVE && (
            <p className="flex gap-2 rounded-lg bg-surface-2 p-3 text-sm text-text-2">
              <Mail size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              Email envoyé à {contact.value}. Clique sur le lien reçu, ou entre le code à 6 chiffres s&apos;il y en a un.
            </p>
          )}
          <label htmlFor={id} className="block text-sm font-medium text-text-2">
            Code reçu {contact?.kind === "phone" ? `au ${contact.value}` : "par email"}
          </label>
          <input
            id={id}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="••••••"
            className="h-14 w-full rounded-xl border border-line bg-surface-2 px-4 text-center font-display text-3xl tracking-[0.4em] outline-none focus:border-accent"
          />
          {!LIVE && <p className="text-xs text-text-3">Démo : n&apos;importe quel code à 6 chiffres.</p>}
          <button type="button" onClick={() => setStep("contact")} className="text-sm text-text-2 underline">
            Changer de numéro ou d&apos;email
          </button>
        </>
      )}
      {error && <p className="text-sm text-bad">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-accent font-semibold text-on-accent hover:bg-accent-press disabled:opacity-70"
      >
        {pending && <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />}
        {step === "contact" ? "Recevoir mon code" : "Valider"}
      </button>
    </form>
  );
}
