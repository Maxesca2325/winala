"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Clock3 } from "lucide-react";
import { LIVE, sb } from "@/lib/backend";
import { summarize } from "@/lib/tracker-summary";
import type { TrackerRow } from "@/lib/tracker-types";

export function TrackerTeaser() {
  const [rows, setRows] = useState<TrackerRow[]>([]);
  useEffect(() => {
    if (!LIVE) return;
    sb()
      .rpc("get_public_tracker", { p_limit: 500 })
      .then(({ data }) => setRows((data as TrackerRow[] | null) ?? []));
  }, []);
  const s = summarize(rows.filter((r) => r.market === "1X2"));
  return (
    <div className="rounded-card border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-4 py-3 text-sm">
        <span className="font-semibold">Historique · pronostic 1X2</span>
        <span className="text-text-2">Mis à jour après chaque match</span>
      </div>
      <dl className="grid grid-cols-3 divide-x divide-line border-b border-line text-center">
        {[
          ["Réglés", String(s.settled)],
          ["Gagnés", String(s.wins)],
          ["Réussite", s.rate === null ? "—" : `${Math.round(s.rate * 100)} %`],
        ].map(([k, v]) => (
          <div key={k} className="px-2 py-4">
            <dt className="text-xs text-text-2">{k}</dt>
            <dd className="font-display text-3xl">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-col items-center gap-2 px-6 py-8 text-center">
        <Clock3 className="text-text-3" size={22} aria-hidden="true" />
        <p className="font-semibold">
          {s.settled === 0 ? "Aucun pronostic réglé pour l'instant." : `${rows.length} pronostics publiés avant les matchs.`}
        </p>
        <p className="max-w-xs text-sm text-text-2">
          {s.settled === 0
            ? "Les premiers résultats arrivent après les prochains matchs. Pas de faux chiffres en attendant."
            : "Gagnés et perdus, tout reste visible."}
        </p>
        <Link href="/tracker" className="mt-2 text-sm font-semibold text-accent-ink hover:underline">
          Voir tout l&apos;historique
        </Link>
      </div>
    </div>
  );
}
