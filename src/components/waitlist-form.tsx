"use client";

import { useActionState, useId } from "react";
import { ArrowRight, Check, LoaderCircle } from "lucide-react";
import { joinWaitlist, type WaitlistState } from "@/lib/waitlist";

const initial: WaitlistState = { status: "idle", message: "" };

export function WaitlistForm({ source = "landing", autoFocus = false }: { source?: string; autoFocus?: boolean }) {
  const [state, action, pending] = useActionState(joinWaitlist, initial);
  const id = useId();

  if (state.status === "ok") {
    return (
      <div role="status" className="flex items-start gap-3 rounded-card border border-good/40 bg-good/10 p-4">
        <Check className="mt-0.5 shrink-0 text-good" size={20} aria-hidden="true" />
        <p className="font-medium">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={action} className="w-full" noValidate>
      <label htmlFor={id} className="mb-2 block text-sm font-medium text-text-2">
        Ton numéro (+509) ou ton email
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id={id}
          name="contact"
          type="text"
          autoComplete="tel"
          autoFocus={autoFocus}
          required
          placeholder="3712 3456 ou toi@exemple.com"
          aria-invalid={state.status === "error"}
          aria-describedby={`${id}-msg`}
          className="h-12 w-full min-w-0 rounded-xl sm:flex-1 border border-line bg-surface-2 px-4 text-base text-text placeholder:text-text-3 focus:border-accent focus:outline-none"
        />
        <input type="hidden" name="source" value={source} />
        <div aria-hidden="true" className="absolute left-[-9999px]">
          <input name="website" tabIndex={-1} autoComplete="off" />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-accent px-5 font-semibold text-on-accent transition-colors hover:bg-accent-press active:translate-y-px disabled:opacity-70"
        >
          {pending ? (
            <>
              <LoaderCircle className="animate-spin" size={18} aria-hidden="true" />
              Envoi…
            </>
          ) : (
            <>
              Rejoindre la liste
              <ArrowRight size={18} aria-hidden="true" />
            </>
          )}
        </button>
      </div>
      <p id={`${id}-msg`} aria-live="polite" className={`mt-2 min-h-5 text-sm ${state.status === "error" ? "text-bad" : "text-text-3"}`}>
        {state.status === "error" ? state.message : "3 crédits offerts à l'ouverture. Pas de spam."}
      </p>
    </form>
  );
}
