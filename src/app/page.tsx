import Link from "next/link";
import { ArrowRight, Check, Lock, RotateCcw, X } from "lucide-react";
import { AnalysisView, ConfidenceChip, Crest, ExampleTag, LockedPreview } from "@/components/analysis";
import { MatchHeader } from "@/components/match-header";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { StartCta } from "@/components/start-cta";
import { TrackerTeaser } from "@/components/tracker-teaser";
import { CREDIT_PACKS, DEMO_MATCHES, leagueById } from "@/lib/demo-data";
import { confidenceOf } from "@/lib/model";

const hero = DEMO_MATCHES[0];
const lockedExample = DEMO_MATCHES[3];

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        {/* ── Hero: the offer, the action, and the product doing its job ── */}
        <section className="mx-auto grid max-w-6xl gap-10 px-4 pt-8 pb-14 md:grid-cols-[1.1fr_0.9fr] md:items-center md:pt-16 md:pb-20">
          <div>
            <h1 className="font-display text-balance text-[2.6rem] leading-[0.98] sm:text-6xl md:text-[4.4rem]">
              Les chances du match, <span className="text-accent-ink">calculées.</span> Pas devinées.
            </h1>
            <p className="mt-5 max-w-[34rem] text-lg leading-relaxed text-text-2">
              Winala passe les matchs des grands championnats d'Europe dans un modèle statistique. Tu vois la probabilité de chaque
              issue, le nombre de buts (plus/moins 1,5 – 2,5 – 3,5), la double chance, le score exact et le niveau de risque.
            </p>
            <div id="liste" className="mt-7 max-w-[34rem] scroll-mt-24">
              <StartCta source="hero" />
            </div>
            <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-text-2">
              <li className="flex items-center gap-1.5">
                <Check size={15} className="text-good" aria-hidden="true" />1 match offert chaque jour
              </li>
              <li className="flex items-center gap-1.5">
                <Check size={15} className="text-good" aria-hidden="true" />
                Prix en HTG
              </li>
              <li className="flex items-center gap-1.5">
                <Check size={15} className="text-good" aria-hidden="true" />
                MonCash et NatCash
              </li>
            </ul>
          </div>

          <div className="relative mx-auto w-full max-w-[25rem]">
            <div className="space-y-3 rounded-[22px] border border-line bg-bg p-3 shadow-[0_24px_60px_-20px_rgb(0_0_0/0.55)]">
              <div className="flex items-center justify-between px-1 pt-1 text-xs text-text-2">
                <span className="font-semibold text-accent-ink">Prono du jour · offert</span>
                <ExampleTag />
              </div>
              <MatchHeader match={hero} />
              <AnalysisView
                prediction={hero.prediction}
                home={hero.home}
                away={hero.away}
                leagueCalibrated
                deep={false}
                demo
              />
            </div>
          </div>
        </section>

        {/* ── Locked vs unlocked ── */}
        <section className="border-t border-line bg-surface/40">
          <div className="mx-auto max-w-6xl px-4 py-14 md:py-20">
            <div className="max-w-2xl">
              <h2 className="font-display text-4xl leading-none sm:text-5xl">Un crédit, une analyse complète.</h2>
              <p className="mt-4 text-lg text-text-2">
                Sur chaque match, tu vois gratuitement l&apos;indice de confiance du modèle. Si le match t&apos;intéresse, un crédit débloque
                les chiffres, les buts et le score exact. Et un match par jour est offert.
              </p>
            </div>

            <div className="mt-10 grid items-start gap-4 md:grid-cols-[1fr_auto_1fr]">
              <div>
                <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-text-2">
                  <Lock size={14} aria-hidden="true" /> Avant
                </p>
                <MatchRowPreview />
                <div className="mt-3">
                  <LockedPreview confidence={confidenceOf(lockedExample.prediction.probabilities)} />
                </div>
              </div>
              <div className="hidden self-center md:block">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-accent font-display text-on-accent">1 cr</span>
              </div>
              <div>
                <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-text-2">
                  <Check size={14} aria-hidden="true" /> Après
                </p>
                <AnalysisView
                  prediction={lockedExample.prediction}
                  home={lockedExample.home}
                  away={lockedExample.away}
                  leagueCalibrated
                  deep={false}
                  demo
                />
              </div>
            </div>
            <p className="mt-6">
              <Link href="/app" className="inline-flex items-center gap-1.5 font-semibold text-accent-ink hover:underline">
                Voir les matchs <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </p>
          </div>
        </section>

        {/* ── Public track record ── */}
        <section className="mx-auto max-w-6xl px-4 py-14 md:py-20">
          <div className="grid gap-10 md:grid-cols-2 md:items-center">
            <div>
              <h2 className="font-display text-4xl leading-none sm:text-5xl">Un historique public, qui part de zéro.</h2>
              <p className="mt-4 text-lg text-text-2">
                Chaque pronostic est horodaté avant le coup d&apos;envoi, puis réglé après le match. Le taux de réussite cumulé est visible par
                tout le monde, sans compte, avant de payer quoi que ce soit.
              </p>
              <p className="mt-4 text-text-2">
                On ne juge pas le modèle au simple pourcentage de réussite. Quand il annonce 60 %, l&apos;issue doit arriver environ 6 fois sur
                10. C&apos;est ce qu&apos;on mesure, et c&apos;est ce qu&apos;on publie.
              </p>
            </div>
            <TrackerTeaser />
          </div>
        </section>

        {/* ── Pricing in HTG ── */}
        <section className="border-t border-line bg-surface/40">
          <div className="mx-auto max-w-6xl px-4 py-14 md:py-20">
            <div className="grid gap-10 md:grid-cols-[0.9fr_1.1fr]">
              <div>
                <h2 className="font-display text-4xl leading-none sm:text-5xl">Des crédits, pas d&apos;abonnement.</h2>
                <p className="mt-4 text-lg text-text-2">
                  Tu paies seulement les matchs qui t&apos;intéressent. 3 crédits offerts à l&apos;inscription, un match offert chaque jour.
                </p>
                <dl className="mt-6 space-y-3 text-[0.95rem]">
                  <div className="flex justify-between gap-4 border-b border-line pb-3">
                    <dt className="text-text-2">Analyse d&apos;un match</dt>
                    <dd className="font-semibold">1 crédit</dd>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-line pb-3">
                    <dt className="text-text-2">Prono du jour</dt>
                    <dd className="font-semibold">Gratuit</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-text-2">Match reporté ou annulé</dt>
                    <dd className="font-semibold">Remboursé</dd>
                  </div>
                </dl>
              </div>
              <div>
                <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
                  {CREDIT_PACKS.map((p) => (
                    <li key={p.id} className="flex items-center gap-4 px-4 py-4">
                      <div className="flex-1">
                        <div className="font-semibold">{p.name}</div>
                        <div className="text-sm text-text-2">
                          {p.credits} crédits · {Math.round(p.priceHtg / p.credits)} HTG le crédit
                        </div>
                      </div>
                      <div className="font-display text-3xl">
                        {p.priceHtg}
                        <span className="ml-1 text-sm font-semibold text-text-2">HTG</span>
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-sm text-text-2">Paiement par MonCash ou NatCash, en gourdes.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Commitments ── */}
        <section className="mx-auto max-w-6xl px-4 py-14 md:py-20">
          <h2 className="font-display max-w-2xl text-4xl leading-none sm:text-5xl">Ce qu&apos;on te promet. Et ce qu&apos;on ne promettra jamais.</h2>
          <div className="mt-10 grid gap-8 md:grid-cols-2">
            <ul className="space-y-4">
              {[
                "Des probabilités calculées par un modèle statistique, jamais inventées.",
                "Un historique public de tous nos pronostics, gagnés et perdus.",
                "Remboursement automatique si le match est reporté ou annulé.",
                "Un débit unique : un double appui sur une connexion lente ne te coûte jamais deux fois.",
              ].map((x) => (
                <li key={x} className="flex gap-3">
                  <Check className="mt-0.5 shrink-0 text-good" size={20} aria-hidden="true" />
                  <span>{x}</span>
                </li>
              ))}
            </ul>
            <ul className="space-y-4">
              {[
                "Un « score garanti » ou des « gains assurés ». Ça n'existe pas.",
                "Un faux taux de réussite pour attirer du monde.",
                "Un remboursement sur un pronostic perdant : une probabilité reste une probabilité.",
              ].map((x) => (
                <li key={x} className="flex gap-3 text-text-2">
                  <X className="mt-0.5 shrink-0 text-bad" size={20} aria-hidden="true" />
                  <span>{x}</span>
                </li>
              ))}
              <li className="flex gap-3 text-text-2">
                <RotateCcw className="mt-0.5 shrink-0 text-text-3" size={20} aria-hidden="true" />
                <span>À la place, un programme de fidélité basé sur l&apos;usage. Les détails seront publiés au lancement.</span>
              </li>
            </ul>
          </div>

          <div className="mt-14 max-w-3xl divide-y divide-line border-y border-line">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">
                  {q}
                  <span className="text-xl text-text-3 transition-transform group-open:rotate-45" aria-hidden="true">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-text-2">{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ── Close ── */}
        <section className="border-t border-line bg-surface/40">
          <div className="mx-auto max-w-6xl px-4 py-14 md:py-20">
            <div className="max-w-xl">
              <h2 className="font-display text-4xl leading-none sm:text-5xl">Sois là au premier match.</h2>
              <p className="mt-4 text-lg text-text-2">Inscris-toi sur la liste. Tes 3 crédits t&apos;attendent à l&apos;ouverture.</p>
              <div className="mt-6">
                <StartCta source="footer" />
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function MatchRowPreview() {
  const m = lockedExample;
  return (
    <div className="flex items-center gap-3 rounded-card border border-line bg-surface px-4 py-3">
      <span className="w-12 text-sm font-semibold text-text-2">{m.time}</span>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Crest team={m.home} size={20} />
          {m.home.name}
        </div>
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Crest team={m.away} size={20} />
          {m.away.name}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1.5">
        <ConfidenceChip value={confidenceOf(m.prediction.probabilities)} compact />
        <span className="text-xs text-text-3">{leagueById(m.leagueId).name}</span>
      </div>
    </div>
  );
}

const FAQ: [string, string][] = [
  [
    "D'où viennent les probabilités ?",
    "D'un modèle statistique (Dixon-Coles / Poisson) qui apprend des résultats des saisons passées, combiné aux cotes du marché d'avant-match. Il est testé semaine par semaine sur les 3 dernières saisons de chaque championnat. Aucune intelligence artificielle n'invente les chiffres.",
  ],
  [
    "Le score exact, c'est fiable ?",
    "C'est le marché le plus difficile. Même le score le plus probable n'arrive qu'environ 1 fois sur 8. On l'affiche avec son pourcentage pour que tu mises prudemment.",
  ],
  [
    "Et si le match est reporté ?",
    "Tes crédits reviennent automatiquement sur ton compte, sans rien demander.",
  ],
  [
    "Ça marche avec une petite connexion ?",
    "Oui. L'appli est très légère et s'installe sur l'écran d'accueil. Les pages déjà ouvertes restent consultables quand le réseau coupe.",
  ],
  [
    "Vous donnez des value bets ?",
    "Pas pour l'instant. Nos tests sur les saisons passées ne montrent pas de gain régulier face aux cotes des bookmakers, donc on ne les affiche pas. On les activera seulement si les tests deviennent positifs.",
  ],
];
