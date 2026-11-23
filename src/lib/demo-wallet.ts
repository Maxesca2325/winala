"use client";

import { useSyncExternalStore } from "react";
import { COST, CREDIT_PACKS, SIGNUP_CREDITS, demoMatchById } from "./demo-data";

/**
 * DEMO wallet kept in this browser only. It mirrors the rules of the real
 * Supabase RPCs (supabase/migrations) so the flows can be tested end to end:
 * - already unlocked → shown again, 0 credit
 * - free match of the day → 0 credit
 * - STANDARD → DEEP upgrade costs only the difference
 * - postponed/cancelled → no unlock (real backend refunds automatically)
 * - one in-flight unlock per match (double tap on slow 3G never debits twice)
 */

export type AnalysisType = "STANDARD" | "DEEP";

export interface DemoTx {
  id: string;
  packId: string;
  provider: "MONCASH" | "NATCASH";
  amount: number;
  credits: number;
  status: "PENDING" | "COMPLETED" | "FAILED";
  createdAt: number;
}

interface WalletState {
  credits: number;
  unlocks: Record<string, AnalysisType>;
  txs: DemoTx[];
}

const KEY = "winala-demo-v1";
const initial: WalletState = { credits: SIGNUP_CREDITS, unlocks: {}, txs: [] };

let state: WalletState = initial;
let loaded = false;
const listeners = new Set<() => void>();
const inFlight = new Set<string>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) state = { ...initial, ...JSON.parse(raw) };
  } catch {
    /* private mode or blocked storage: keep in-memory demo */
  }
}

function set(next: WalletState) {
  state = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  load();
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useWallet() {
  return useSyncExternalStore(
    subscribe,
    () => {
      load();
      return state;
    },
    () => initial,
  );
}

export type UnlockResult =
  | { ok: true; charged: number; type: AnalysisType }
  | { ok: false; reason: "INSUFFICIENT_CREDITS" | "MATCH_NOT_AVAILABLE" | "IN_FLIGHT" };

/** Simulates network latency so the pending state is visible. */
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function unlockMatch(matchId: string, type: AnalysisType): Promise<UnlockResult> {
  const lockKey = `${matchId}`;
  if (inFlight.has(lockKey)) return { ok: false, reason: "IN_FLIGHT" };
  inFlight.add(lockKey);
  try {
    await wait(650);
    const match = demoMatchById(matchId);
    if (!match || match.status !== "SCHEDULED") return { ok: false, reason: "MATCH_NOT_AVAILABLE" };
    const owned = state.unlocks[matchId];
    if (match.freeOfTheDay) {
      set({ ...state, unlocks: { ...state.unlocks, [matchId]: "DEEP" } });
      return { ok: true, charged: 0, type: "DEEP" };
    }
    if (owned === "DEEP" || owned === type) return { ok: true, charged: 0, type: owned };
    const cost = COST[type] - (owned ? COST[owned] : 0);
    if (state.credits < cost) return { ok: false, reason: "INSUFFICIENT_CREDITS" };
    set({ ...state, credits: state.credits - cost, unlocks: { ...state.unlocks, [matchId]: type } });
    return { ok: true, charged: cost, type };
  } finally {
    inFlight.delete(lockKey);
  }
}

export async function createPendingTx(packId: string, provider: DemoTx["provider"]): Promise<DemoTx> {
  await wait(500);
  const pack = CREDIT_PACKS.find((p) => p.id === packId)!;
  const tx: DemoTx = {
    id: `WN-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
    packId,
    provider,
    amount: pack.priceHtg,
    credits: pack.credits,
    status: "PENDING",
    createdAt: Date.now(),
  };
  set({ ...state, txs: [tx, ...state.txs] });
  return tx;
}

/** Idempotent, like the real webhook: confirming twice credits once. */
export async function confirmTx(id: string) {
  await wait(700);
  const tx = state.txs.find((t) => t.id === id);
  if (!tx || tx.status !== "PENDING") return;
  set({
    ...state,
    credits: state.credits + tx.credits,
    txs: state.txs.map((t) => (t.id === id ? { ...t, status: "COMPLETED" } : t)),
  });
}

export function resetDemo() {
  set(initial);
}
