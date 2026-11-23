import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { TrackerBody } from "@/components/tracker-body";

export const metadata: Metadata = {
  title: "Historique public",
  description:
    "Tous les pronostics Winala, horodatés avant le coup d'envoi et réglés après le match. Taux de réussite cumulé, visible sans compte.",
};

export default function TrackerPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 md:py-12">
        <h1 className="font-display text-5xl leading-none">Historique public</h1>
        <p className="mt-4 text-lg text-text-2">
          Chaque pronostic est publié et horodaté <strong className="text-text">avant</strong> le coup d&apos;envoi, puis réglé après le
          match. Rien n&apos;est effacé, les pertes restent visibles.
        </p>
        <TrackerBody />

        <section className="mt-12 space-y-3 text-text-2">
          <h2 className="text-lg font-semibold text-text">Comment lire ces chiffres</h2>
          <p>
            <strong className="text-text">Réussite</strong> : part des pronostics gagnés parmi ceux réglés (les matchs reportés ou annulés
            ne comptent pas).
          </p>
          <p>
            <strong className="text-text">Attendu</strong> : nombre de pronostics qu&apos;on aurait dû gagner si les probabilités annoncées
            étaient parfaitement justes. Si on gagne beaucoup moins que l&apos;attendu, le modèle est trop optimiste.
          </p>
          <p>
            <strong className="text-text">Empreinte</strong> : avant le coup d&apos;envoi, le pronostic est scellé. On publie seulement
            son empreinte (SHA-256). Après le match, le pronostic et le code de vérification apparaissent : chacun peut recalculer
            l&apos;empreinte et vérifier qu&apos;on n&apos;a rien changé.
          </p>
          <p>
            <strong className="text-text">Score exact</strong> : même le score le plus probable n&apos;arrive qu&apos;environ 1 fois sur 8.
            Son taux de réussite est donc naturellement bas.
          </p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
