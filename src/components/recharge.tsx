"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, ChevronLeft, Clock3, LoaderCircle, Smartphone } from "lucide-react";
import { CREDIT_PACKS } from "@/lib/demo-data";
import { confirmTx, createPendingTx, resetDemo, useWallet, type DemoTx } from "@/lib/demo-wallet";

type Provider = DemoTx["provider"];
const PROVIDERS: { id: Provider; name: string; hint: string }[] = [
  { id: "MONCASH", name: "MonCash", hint: "Digicel" },
  { id: "NATCASH", name: "NatCash", hint: "Natcom" },
];

export function Recharge() {
  const { credits, txs } = useWallet();
  const [packId, setPackId] = useState<string>("weekend");
  const [provider, setProvider] = useState<Provider | null>(null);
  const [pending, setPending] = useState(false);
  const [txId, setTxId] = useState<string | null>(null);
  const tx = txs.find((t) => t.id === txId);
  const pack = CREDIT_PACKS.find((p) => p.id === packId)!;

  async function start() {
    if (!provider || pending) return;
    setPending(true);
    const t = await createPendingTx(packId, provider);
    setTxId(t.id);
    setPending(false);
  }

  if (tx) return <TxStatus tx={tx} onDone={() => { setTxId(null); setProvider(null); }} />;

  return (
    <div className="space-y-5">
      <section className="flex items-end justify-between rounded-card border border-line bg-surface p-4">
        <div>
          <h1 className="text-sm text-text-2">Ton solde</h1>
          <p className="font-display text-5xl leading-none">
            {credits}
            <span className="ml-1.5 text-lg font-semibold text-text-2">crédit{credits > 1 ? "s" : ""}</span>
          </p>
        </div>
        <p className="text-right text-xs text-text-3">
          1 crédit = 1 analyse
          <br />2 crédits = rapport Value Bet
        </p>
      </section>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-text-2">1. Choisis un pack</legend>
        <div className="space-y-2">
          {CREDIT_PACKS.map((p) => (
            <label
              key={p.id}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3.5 transition-colors ${
                packId === p.id ? "border-accent bg-accent/[0.07]" : "border-line bg-surface hover:bg-surface-2"
              }`}
            >
              <input
                type="radio"
                name="pack"
                value={p.id}
                checked={packId === p.id}
                onChange={() => setPackId(p.id)}
                className="size-4 accent-[var(--accent)]"
              />
              <span className="flex-1">
                <span className="block font-semibold">{p.name}</span>
                <span className="block text-sm text-text-2">
                  {p.credits} crédits · {Math.round(p.priceHtg / p.credits)} HTG le crédit
                </span>
              </span>
              <span className="font-display text-2xl">
                {p.priceHtg}
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
              <input
                type="radio"
                name="provider"
                value={p.id}
                checked={provider === p.id}
                onChange={() => setProvider(p.id)}
                className="size-4 accent-[var(--accent)]"
              />
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
        onClick={start}
        disabled={!provider || pending}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-accent font-semibold text-on-accent transition-colors hover:bg-accent-press disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending && <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />}
        {provider ? `Payer ${pack.priceHtg} HTG` : "Choisis MonCash ou NatCash"}
      </button>
      <p className="text-center text-xs text-text-3">Démo : aucun paiement n&apos;est envoyé.</p>

      {txs.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-text-2">Historique des recharges</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface text-sm">
            {txs.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span>
                  <span className="font-semibold">+{t.credits} crédits</span>
                  <span className="block text-xs text-text-3">
                    {t.amount} HTG · {t.provider === "MONCASH" ? "MonCash" : "NatCash"} · {t.id}
                  </span>
                </span>
                <StatusChip status={t.status} />
              </li>
            ))}
          </ul>
        </section>
      )}
      <button type="button" onClick={resetDemo} className="w-full py-2 text-xs text-text-3 underline hover:text-text-2">
        Réinitialiser la démo (3 crédits)
      </button>
    </div>
  );
}

function StatusChip({ status }: { status: DemoTx["status"] }) {
  const map = {
    PENDING: ["En attente", "text-warn bg-warn/10"],
    COMPLETED: ["Confirmé", "text-good bg-good/10"],
    FAILED: ["Échoué", "text-bad bg-bad/10"],
  } as const;
  const [label, cls] = map[status];
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>;
}

function TxStatus({ tx, onDone }: { tx: DemoTx; onDone: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const providerName = tx.provider === "MONCASH" ? "MonCash" : "NatCash";

  if (tx.status === "COMPLETED") {
    return (
      <div className="reveal space-y-5 pt-4 text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-good/15 text-good">
          <Check size={32} aria-hidden="true" />
        </span>
        <div>
          <h1 className="font-display text-4xl">+{tx.credits} crédits</h1>
          <p className="mt-2 text-text-2">
            Paiement {providerName} confirmé ({tx.amount} HTG). Référence {tx.id}.
          </p>
        </div>
        <Link href="/app" className="flex h-14 items-center justify-center rounded-xl bg-accent font-semibold text-on-accent">
          Voir les matchs
        </Link>
        <button type="button" onClick={onDone} className="text-sm text-text-2 underline">
          Retour aux crédits
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button type="button" onClick={onDone} className="-ml-1 inline-flex items-center gap-1 py-1 text-sm font-semibold text-text-2 hover:text-text">
        <ChevronLeft size={18} aria-hidden="true" /> Crédits
      </button>
      <section className="rounded-card border border-line bg-surface p-5">
        <div className="flex items-center gap-2 text-warn">
          <Clock3 size={18} aria-hidden="true" />
          <span className="font-semibold">Paiement en attente</span>
        </div>
        <p className="mt-3 font-display text-4xl leading-none">
          {tx.amount} <span className="text-lg font-semibold text-text-2">HTG</span>
        </p>
        <p className="mt-1 text-sm text-text-2">
          {tx.credits} crédits via {providerName}
        </p>
        <ol className="mt-5 space-y-3 text-[0.95rem]">
          <li className="flex gap-3">
            <Smartphone size={18} className="mt-0.5 shrink-0 text-text-3" aria-hidden="true" />
            <span>Valide le paiement dans ton appli {providerName} (code de confirmation).</span>
          </li>
          <li className="flex gap-3">
            <span className="mt-0.5 w-[18px] shrink-0 text-center font-display text-text-3">#</span>
            <span>
              Référence à garder : <strong className="font-display text-lg tracking-wide">{tx.id}</strong>
            </span>
          </li>
          <li className="flex gap-3">
            <Check size={18} className="mt-0.5 shrink-0 text-text-3" aria-hidden="true" />
            <span>Les crédits arrivent dès la confirmation. Tu peux fermer l&apos;appli, rien ne sera perdu.</span>
          </li>
        </ol>
      </section>
      <button
        type="button"
        disabled={confirming}
        onClick={async () => {
          setConfirming(true);
          await confirmTx(tx.id);
          setConfirming(false);
        }}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-text-3/60 font-semibold text-text-2 hover:text-text disabled:opacity-60"
      >
        {confirming && <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />}
        Démo : simuler la confirmation {providerName}
      </button>
    </div>
  );
}
