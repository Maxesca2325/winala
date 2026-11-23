"use client";

import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useSyncExternalStore } from "react";
import type { Team } from "./demo-data";
import type { ModelOutput } from "./model";
import logos from "./team-logos.json";

/**
 * Live mode: the browser talks to Supabase with the PUBLISHABLE key only.
 * Every rule that matters (credits, unlocks, refunds, payments) runs inside
 * the database (supabase/migrations), never here. Without the env vars the
 * app stays in clearly labelled demo mode.
 */
import { LIVE } from "./live";
export { LIVE };
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;
export function sb(): SupabaseClient {
  if (!LIVE) throw new Error("Supabase not configured");
  client ??= createClient(URL_!, KEY!, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return client;
}

/* ───────── session + profile store ───────── */
interface AuthState {
  ready: boolean;
  session: Session | null;
  credits: number | null;
}
let auth: AuthState = { ready: !LIVE, session: null, credits: null };
const listeners = new Set<() => void>();
const emit = (next: Partial<AuthState>) => {
  auth = { ...auth, ...next };
  listeners.forEach((l) => l());
};
let started = false;

async function loadCredits() {
  if (!auth.session) return emit({ credits: null });
  const { data } = await sb().from("profiles").select("credits_balance").eq("id", auth.session.user.id).maybeSingle();
  emit({ credits: data?.credits_balance ?? 0 });
}

function start() {
  if (started || !LIVE || typeof window === "undefined") return;
  started = true;
  sb()
    .auth.getSession()
    .then(({ data }) => {
      emit({ session: data.session, ready: true });
      loadCredits();
    });
  sb().auth.onAuthStateChange((_e, session) => {
    emit({ session, ready: true });
    loadCredits();
  });
}

export function useAuth() {
  const s = useSyncExternalStore(
    (l) => {
      start();
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => auth,
    () => auth,
  );
  return { ...s, refreshCredits: loadCredits, setCredits: (c: number) => emit({ credits: c }) };
}

/** Re-read the balance when the tab comes back (payment done on another app). */
export function useCreditsOnFocus() {
  useEffect(() => {
    if (!LIVE) return;
    const f = () => document.visibilityState === "visible" && loadCredits();
    document.addEventListener("visibilitychange", f);
    return () => document.removeEventListener("visibilitychange", f);
  }, []);
}

/* ───────── data types ───────── */
export interface MatchCard {
  id: string;
  league_id: string;
  league_name: string;
  home_team: string;
  away_team: string;
  kickoff_time: string;
  status: "SCHEDULED" | "LIVE" | "FINISHED" | "POSTPONED" | "CANCELLED";
  confidence: "faible" | "moyenne" | "élevée" | null;
  has_value_bet: boolean;
  is_free: boolean;
  unlocked: "STANDARD" | "DEEP" | null;
}

export interface Analysis {
  analysis_type: "STANDARD" | "DEEP";
  is_lineup_updated: boolean;
  content: ModelOutput;
  charged?: number;
  balance?: number;
}


// Real crests from API-Football (static map, src/lib/team-logos.json). Names
// are matched loosely so football-data spellings still resolve.
const LOGO_BY_NORM: Record<string, string> = (() => {
  const strip = (x: string) =>
    x
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\b(fc|cf|afc|sc|ac|as|ss|us|rc|cd|ud|club|calcio|association|football)\b/g, " ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, " ");
  const out: Record<string, string> = {};
  for (const [name, url] of Object.entries(logos as Record<string, string>)) out[strip(name)] = url;
  return out;
})();

function logoFor(name: string): string | undefined {
  const strip = (x: string) =>
    x
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\b(fc|cf|afc|sc|ac|as|ss|us|rc|cd|ud|club|calcio|association|football)\b/g, " ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, " ");
  const k = strip(name);
  if (LOGO_BY_NORM[k]) return LOGO_BY_NORM[k];
  for (const lk of Object.keys(LOGO_BY_NORM)) {
    if (k && (k === lk || k.includes(lk) || lk.includes(k)) && Math.abs(k.length - lk.length) <= 4) return LOGO_BY_NORM[lk];
  }
  return undefined;
}

const PALETTE = ["#2f6fdf", "#c8102e", "#0f8a5f", "#7a3fd1", "#d9730d", "#0e7c86", "#b5179e", "#4d5b70", "#a4161a", "#1b6e3a"];
export function teamFromName(name: string): Team {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const words = name.replace(/[^A-Za-zÀ-ÿ ]/g, "").split(/\s+/).filter(Boolean);
  const short = (words.length > 1 ? words.map((w) => w[0]).join("") : name).slice(0, 3).toUpperCase();
  return { name, short, color: PALETTE[h % PALETTE.length], logo: logoFor(name) };
}

const HAITI_TZ = "America/Port-au-Prince";
export const haitiTime = (iso: string) =>
  new Intl.DateTimeFormat("fr-HT", { timeZone: HAITI_TZ, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
export const haitiDay = (iso: string) =>
  new Intl.DateTimeFormat("fr-HT", { timeZone: HAITI_TZ, weekday: "long", day: "numeric", month: "long" }).format(new Date(iso));

/** [start, end) in UTC of a Haiti calendar day, offset from today. */
export function haitiDayRange(offset: number): [string, string] {
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: HAITI_TZ }).format(new Date()); // YYYY-MM-DD
  const [y, m, d] = ymd.split("-").map(Number);
  const noon = new Date(Date.UTC(y, m - 1, d + offset, 12));
  // "GMT-05:00" or "GMT-04:00" (Haiti observes DST).
  const name = new Intl.DateTimeFormat("en-US", { timeZone: HAITI_TZ, timeZoneName: "longOffset" })
    .formatToParts(noon)
    .find((x) => x.type === "timeZoneName")!.value;
  const mm = name.match(/GMT([+-])(\d{2}):(\d{2})/);
  const offMin = mm ? (mm[1] === "-" ? 1 : -1) * (Number(mm[2]) * 60 + Number(mm[3])) : 300;
  const start = new Date(Date.UTC(y, m - 1, d + offset) + offMin * 60000);
  return [start.toISOString(), new Date(start.getTime() + 86400000).toISOString()];
}

export const ERRORS: Record<string, string> = {
  INSUFFICIENT_CREDITS: "Solde insuffisant.",
  MATCH_NOT_AVAILABLE: "Ce match a commencé ou n'est plus disponible.",
  ANALYSIS_NOT_READY: "L'analyse de ce match n'est pas encore prête.",
  NOT_AUTHENTICATED: "Connecte-toi pour débloquer.",
  TOO_MANY_PENDING: "Trop de paiements en attente. Termine ou attends ceux en cours.",
};
export function errorText(msg: string | undefined) {
  const key = Object.keys(ERRORS).find((k) => msg?.includes(k));
  return key ? ERRORS[key] : "Connexion difficile. Réessaie dans un instant.";
}
