import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Jeu responsable",
  description: "Comment utiliser Winala sans se mettre en danger : probabilités, risques et limites.",
};

export default function Page() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 space-y-5 px-4 py-10 text-[1.05rem] leading-relaxed text-text-2">
        <h1 className="font-display text-5xl leading-none text-text">Jeu responsable</h1>
        <p>
          Winala publie des <strong className="text-text">analyses statistiques</strong>. Une probabilité de 60 % veut dire que
          l&apos;issue arrive environ 6 fois sur 10 : elle rate donc environ 4 fois sur 10. Aucun pronostic n&apos;est sûr.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Réservé aux 18 ans et plus.</li>
          <li>Ne mise jamais l&apos;argent du loyer, de l&apos;école ou de la nourriture.</li>
          <li>Fixe-toi une somme maximale par semaine, et arrête quand elle est atteinte.</li>
          <li>Ne cherche pas à « te refaire » après une perte.</li>
          <li>Si le jeu prend trop de place, parles-en à un proche et fais une pause.</li>
        </ul>
        <p>
          Winala ne vend pas de paris et ne prend aucune mise. Les crédits paient l&apos;accès à une analyse, pas un résultat.
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
