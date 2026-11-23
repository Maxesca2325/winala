"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { Check, Eye, EyeOff, LoaderCircle, Mail } from "lucide-react";
import { BASE_PATH } from "@/lib/base-path";
import { LIVE, sb, useAuth } from "@/lib/backend";

type Mode = "login" | "signup" | "otp" | "forgot" | "update-password";

const emailOk = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim());

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 18.9 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35 26.7 36 24 36c-5.3 0-9.7-3.1-11.3-7.6l-6.5 5C9.6 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.6l6.2 5.2C41.3 35.6 44 30.3 44 24c0-1.3-.1-2.3-.4-3.5z" />
    </svg>
  );
}

export function SignUp() {
  const { session } = useAuth();
  const [mode, setMode] = useState<Mode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [done, setDone] = useState<null | "signed-in" | "check-email" | "reset-sent" | "password-updated">(null);
  const id = useId();

  const redirect = typeof window !== "undefined" ? `${window.location.origin}${BASE_PATH}/app/` : undefined;

  // Supabase sends the user back here after they click the password-reset link.
  useEffect(() => {
    if (!LIVE) return;
    const { data } = sb().auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setMode("update-password");
        setDone(null);
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  function clear() {
    setError(null);
    setNotice(null);
  }

  async function google() {
    clear();
    if (!LIVE) return setError("La connexion Google n'est pas active dans cette version de test.");
    setPending("google");
    const { error: e } = await sb().auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirect } });
    if (e) {
      setPending(null);
      setError(
        /provider|not enabled|unsupported/i.test(e.message)
          ? "La connexion Google n'est pas encore activée. Utilise ton email."
          : "Connexion Google impossible pour l'instant.",
      );
    }
    // On success the browser leaves for Google; nothing else runs here.
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    clear();

    if (mode === "update-password") {
      if (password.length < 8) return setError("Le mot de passe doit faire au moins 8 caractères.");
      setPending("submit");
      const { error: err } = await sb().auth.updateUser({ password });
      setPending(null);
      if (err) return setError("Impossible de changer le mot de passe. Le lien a peut-être expiré.");
      setDone("password-updated");
      return;
    }

    if (!emailOk(email)) return setError("Entre un email valide.");
    const mail = email.trim().toLowerCase();

    if (mode === "forgot") {
      if (!LIVE) return setError("Indisponible dans cette version de test.");
      setPending("submit");
      const { error: err } = await sb().auth.resetPasswordForEmail(mail, { redirectTo: redirect });
      setPending(null);
      if (err) return setError(/rate|seconds/i.test(err.message) ? "Trop de demandes. Attends une minute." : "Envoi impossible pour l'instant.");
      setDone("reset-sent");
      return;
    }

    if (mode === "otp") {
      if (!LIVE) {
        setDone("check-email");
        return;
      }
      setPending("submit");
      if (!code) {
        const { error: err } = await sb().auth.signInWithOtp({ email: mail, options: { emailRedirectTo: redirect } });
        setPending(null);
        if (err) return setError(/rate|seconds/i.test(err.message) ? "Trop de demandes. Attends une minute." : "Envoi impossible pour l'instant.");
        setNotice("Email envoyé. Clique le lien reçu, ou entre les 6 chiffres.");
        return;
      }
      const { error: err } = await sb().auth.verifyOtp({ email: mail, token: code, type: "email" });
      setPending(null);
      if (err) return setError("Code incorrect ou expiré.");
      setDone("signed-in");
      return;
    }

    // login / signup with password
    if (password.length < 8) return setError("Le mot de passe doit faire au moins 8 caractères.");
    if (!LIVE) {
      setDone(mode === "signup" ? "check-email" : "signed-in");
      return;
    }
    setPending("submit");
    if (mode === "signup") {
      const { data, error: err } = await sb().auth.signUp({ email: mail, password, options: { emailRedirectTo: redirect } });
      setPending(null);
      if (err) {
        return setError(
          /already registered|exists/i.test(err.message)
            ? "Un compte existe déjà avec cet email. Connecte-toi."
            : /weak|password/i.test(err.message)
              ? "Mot de passe trop simple. Mélange lettres et chiffres."
              : "Inscription impossible pour l'instant.",
        );
      }
      setDone(data.session ? "signed-in" : "check-email");
      return;
    }
    const { error: err } = await sb().auth.signInWithPassword({ email: mail, password });
    setPending(null);
    if (err) {
      return setError(
        /email not confirmed/i.test(err.message)
          ? "Confirme ton email d'abord (vérifie ta boîte de réception)."
          : /invalid/i.test(err.message)
            ? "Email ou mot de passe incorrect."
            : "Connexion impossible pour l'instant.",
      );
    }
    setDone("signed-in");
  }

  // ───────── already signed in ─────────
  if (session && done !== "password-updated" && mode !== "update-password") {
    return (
      <div className="space-y-4">
        <p className="rounded-card border border-line bg-surface p-4">
          Tu es connecté{session.user.email ? ` avec ${session.user.email}` : ""}.
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

  // ───────── success screens ─────────
  if (done) {
    const map = {
      "signed-in": ["Te voilà connecté.", "À la première connexion, 3 crédits t'attendent."],
      "check-email": ["Vérifie ton email.", `On a envoyé un lien de confirmation à ${email}. Clique dessus pour activer ton compte et recevoir tes 3 crédits.`],
      "reset-sent": ["Email envoyé.", `Un lien pour choisir un nouveau mot de passe est parti vers ${email}.`],
      "password-updated": ["Mot de passe changé.", "Tu peux maintenant te connecter."],
    } as const;
    const [title, text] = map[done];
    return (
      <div className="reveal space-y-5">
        <div className="flex items-start gap-3 rounded-card border border-good/40 bg-good/10 p-4">
          <Check className="mt-0.5 shrink-0 text-good" size={20} aria-hidden="true" />
          <p>
            <strong>{title}</strong> {text}
          </p>
        </div>
        {done === "signed-in" ? (
          <Link href="/app" className="flex h-14 items-center justify-center rounded-xl bg-accent font-semibold text-on-accent">
            Voir les matchs
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => {
              setDone(null);
              setMode("login");
              setPassword("");
            }}
            className="w-full py-2 text-sm text-text-2 underline"
          >
            Retour à la connexion
          </button>
        )}
      </div>
    );
  }

  const submitLabel: Record<Mode, string> = {
    signup: "Créer mon compte",
    login: "Se connecter",
    otp: code ? "Valider le code" : "Recevoir un lien",
    forgot: "Envoyer le lien",
    "update-password": "Enregistrer le mot de passe",
  };

  return (
    <div className="space-y-4">
      {mode !== "update-password" && mode !== "forgot" && (
        <>
          <button
            type="button"
            onClick={google}
            disabled={pending !== null}
            className="flex h-14 w-full items-center justify-center gap-3 rounded-xl border border-line bg-surface font-semibold transition-colors hover:bg-surface-2 disabled:opacity-70"
          >
            {pending === "google" ? <LoaderCircle size={18} className="animate-spin" aria-hidden="true" /> : <GoogleIcon />}
            Continuer avec Google
          </button>
          <div className="flex items-center gap-3 text-xs text-text-3">
            <span className="h-px flex-1 bg-line" /> ou avec ton email <span className="h-px flex-1 bg-line" />
          </div>
        </>
      )}

      {mode === "forgot" && <p className="text-sm text-text-2">Entre ton email : on t&apos;envoie un lien pour choisir un nouveau mot de passe.</p>}
      {mode === "update-password" && <p className="text-sm text-text-2">Choisis un nouveau mot de passe pour ton compte.</p>}

      <form onSubmit={submit} noValidate className="space-y-3">
        {mode !== "update-password" && (
          <div>
            <label htmlFor={`${id}-e`} className="mb-1 block text-sm font-medium text-text-2">
              Email
            </label>
            <input
              id={`${id}-e`}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="toi@exemple.com"
              className="h-14 w-full rounded-xl border border-line bg-surface-2 px-4 text-lg outline-none placeholder:text-text-3 focus:border-accent"
            />
          </div>
        )}

        {(mode === "login" || mode === "signup" || mode === "update-password") && (
          <div>
            <label htmlFor={`${id}-p`} className="mb-1 block text-sm font-medium text-text-2">
              {mode === "update-password" ? "Nouveau mot de passe" : "Mot de passe"}
            </label>
            <div className="flex h-14 items-center rounded-xl border border-line bg-surface-2 focus-within:border-accent">
              <input
                id={`${id}-p`}
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                placeholder="8 caractères minimum"
                className="h-full min-w-0 flex-1 bg-transparent px-4 text-lg outline-none placeholder:text-text-3"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? "Cacher le mot de passe" : "Montrer le mot de passe"}
                className="px-4 text-text-2 hover:text-text"
              >
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
        )}

        {mode === "otp" && notice && (
          <>
            <p className="flex gap-2 rounded-lg bg-surface-2 p-3 text-sm text-text-2">
              <Mail size={16} className="mt-0.5 shrink-0" aria-hidden="true" /> {notice}
            </p>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="••••••"
              className="h-14 w-full rounded-xl border border-line bg-surface-2 px-4 text-center font-display text-3xl tracking-[0.4em] outline-none focus:border-accent"
            />
          </>
        )}

        {error && <p className="text-sm text-bad">{error}</p>}

        <button
          type="submit"
          disabled={pending !== null}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-accent font-semibold text-on-accent hover:bg-accent-press disabled:opacity-70"
        >
          {pending === "submit" && <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />}
          {submitLabel[mode]}
        </button>
      </form>

      <div className="space-y-2 pt-1 text-sm">
        {mode === "signup" && (
          <p className="text-text-2">
            Déjà un compte ?{" "}
            <button type="button" onClick={() => { clear(); setMode("login"); }} className="font-semibold text-accent-ink underline">
              Se connecter
            </button>
          </p>
        )}
        {mode === "login" && (
          <>
            <p className="text-text-2">
              Pas encore de compte ?{" "}
              <button type="button" onClick={() => { clear(); setMode("signup"); }} className="font-semibold text-accent-ink underline">
                Créer un compte
              </button>
            </p>
            <button type="button" onClick={() => { clear(); setMode("forgot"); }} className="text-text-2 underline">
              Mot de passe oublié ?
            </button>
          </>
        )}
        {(mode === "login" || mode === "signup") && (
          <button type="button" onClick={() => { clear(); setCode(""); setMode("otp"); }} className="block text-text-3 underline">
            Recevoir plutôt un lien par email (sans mot de passe)
          </button>
        )}
        {(mode === "otp" || mode === "forgot") && (
          <button type="button" onClick={() => { clear(); setCode(""); setMode("login"); }} className="text-text-2 underline">
            ← Revenir à la connexion
          </button>
        )}
      </div>
    </div>
  );
}
