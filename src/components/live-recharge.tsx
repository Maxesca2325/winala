"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Clock3, LoaderCircle } from "lucide-react";
import { errorText, sb, useAuth } from "@/lib/backend";

interface Pack {
  id: string;
  name: string;
  credits: number;
  price_htg: number;
}
interface Tx {
  id: string;
  provider: "MONCASH" | "NATCASH";
  amount: number;
  credits_added: number;
  status: "PENDING" | "COMPLETED" | "FAILED";
  reference: string;
  created_at: string;
}
type Provider = Tx["provider"];

const PROVIDERS: { id: Provider; name: string; hint: string }[] = [
  { id: "MONCASH", name: "MonCash", hint: "Digicel" },
  { id: "NATCASH", name: "NatCash", hint: "Natcom" },
];
const name = (p: Provider) => (p === "MONCASH" ? "MonCash" : "NatCash");

export function LiveRecharge() {
  const { session, ready, credits, refreshCredits } = useAuth();
  const [packs, setPacks] = useState<Pack[]>([]);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [packId, setPackId] = useState("weekend");
  const [provider, setProvider] = useState<Provider | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<Tx | null>(null);

  useEffect(() => {
    sb()
      .from("credit_packs")
      .select("id,name,credits,price_htg")
      .order("price_htg")
      .then(({ data }) => setPacks((data as Pack[]) ?? []));
  }, []);

  useEffect(() => {
    if (!session) return;
    sb()
      .from("transactions")
      .select("id,provider,amount,credits_added,status,reference,created_at")
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => setTxs((data as Tx[]) ?? []));
    refreshCredits();
  }, [session, current, refreshCredits]);

  if (!ready) return <div className="h-40 animate-pulse rounded-card bg-surface" />;
  if (!session) {
    return (
      <div className="space-y-4 rounded-card border border-line bg-surface p-5">
        <p>Connecte-toi pour voir ton solde et recharger. 3 crédits sont offerts à l&apos;inscription.</p>
        <Link href="/connexion" className="flex h-12 items-center justify-center rounded-xl bg-accent font-semibold text-on-accent">
          Connexion
        </Link>
      </div>
    );
  }

  const pack = packs.find((p) => p.id === packId);

  async function pay() {
    if (!provider || pending) return;
    setPending(true);
    setError(null);
    const { data, error: e } = await sb().rpc("create_payment", { p_pack_id: packId, p_provider: provider });
    setPending(false);
    if (e || !data) return setError(errorText(e?.message));
    setCurrent(data as Tx);
  }

  if (current) {
    return (
      <div className="space-y-4">
        <section className="rounded-card border border-line bg-surface p-5">
          <div className="flex items-center gap-2 text-warn">
            <Clock3 size={18} aria-hidden="true" />
            <span className="font-semibold">Paiement en attente</span>
          </div>
          <p className="mt-3 font-display text-4xl leading-none">
            {Number(current.amount)} <span className="text-lg font-semibold text-text-2">HTG</span>
          </p>
          <p className="mt-1 text-sm text-text-2">
            {current.credits_added} crédits via {name(current.provider)} · référence{" "}
            <strong className="font-display text-base tracking-wide text-text">{current.reference}</strong>
          </p>
          <p className="mt-4 rounded-lg bg-surface-2 p-3 text-sm text-text-2">
            Le paiement {name(current.provider)} en ligne est en cours d&apos;activation. Aucun argent n&apos;a été débité. Ta demande est
            enregistrée : dès que le paiement sera ouvert, tu pourras la finaliser ici.
          </p>
        </section>
        <button type="button" onClick={() => setCurrent(null)} className="w-full py-2 text-sm text-text-2 underline">
          Retour aux crédits
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="flex items-end justify-between rounded-card border border-line bg-surface p-4">
        <div>
          <h1 className="text-sm text-text-2">Ton solde</h1>
          <p className="font-display text-5xl leading-none">
            {credits ?? "…"}
            <span className="ml-1.5 text-lg font-semibold text-text-2">crédit{(credits ?? 0) > 1 ? "s" : ""}</span>
          </p>
        </div>
        <p className="text-right text-xs text-text-3">1 crédit = 1 analyse</p>
      </section>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-text-2">1. Choisis un pack</legend>
        <div className="space-y-2">
          {packs.map((p) => (
            <label
              key={p.id}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3.5 transition-colors ${
                packId === p.id ? "border-accent bg-accent/[0.07]" : "border-line bg-surface hover:bg-surface-2"
              }`}
            >
              <input type="radio" name="pack" checked={packId === p.id} onChange={() => setPackId(p.id)} className="size-4 accent-[var(--accent)]" />
              <span className="flex-1">
                <span className="block font-semibold">{p.name}</span>
                <span className="block text-sm text-text-2">
                  {p.credits} crédits · {Math.round(Number(p.price_htg) / p.credits)} HTG le crédit
                </span>
              </span>
              <span className="font-display text-2xl">
                {Number(p.price_htg)}
                <span className="ml-1 text-xs font-semibold text-text-2">HTG</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-text-2">2. Paye avec</legend>
        <div className="grid grid-cols-2 gap-2">
          {PROVIDERS.map((p) => (
            <label
              key={p.id}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3.5 transition-colors ${
                provider === p.id ? "border-accent bg-accent/[0.07]" : "border-line bg-surface hover:bg-surface-2"
              }`}
            >
              <input type="radio" name="provider" checked={provider === p.id} onChange={() => setProvider(p.id)} className="size-4 accent-[var(--accent)]" />
              <span>
                <span className="block font-semibold">{p.name}</span>
                <span className="block text-xs text-text-2">{p.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <button
        type="button"
        onClick={pay}
        disabled={!provider || pending || !pack}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-accent font-semibold text-on-accent transition-colors hover:bg-accent-press disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending && <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />}
        {provider && pack ? `Payer ${Number(pack.price_htg)} HTG` : "Choisis MonCash ou NatCash"}
      </button>
      {error && <p className="text-sm text-bad">{error}</p>}

      {txs.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-text-2">Historique des recharges</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface text-sm">
            {txs.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span>
                  <span className="font-semibold">+{t.credits_added} crédits</span>
                  <span className="block text-xs text-text-3">
                    {Number(t.amount)} HTG · {name(t.provider)} · {t.reference}
                  </span>
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    t.status === "COMPLETED" ? "bg-good/10 text-good" : t.status === "FAILED" ? "bg-bad/10 text-bad" : "bg-warn/10 text-warn"
                  }`}
                >
                  {t.status === "COMPLETED" ? "Confirmé" : t.status === "FAILED" ? "Échoué" : "En attente"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <button type="button" onClick={() => sb().auth.signOut()} className="w-full py-2 text-xs text-text-3 underline">
        Se déconnecter
      </button>
    </div>
  );
}
