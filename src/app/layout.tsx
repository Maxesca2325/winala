import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import { ServiceWorker } from "@/components/service-worker";
import { BASE_PATH } from "@/lib/base-path";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Winala — Probabilités foot calculées, pas devinées",
    template: "%s · Winala",
  },
  description:
    "Analyses statistiques des matchs de Premier League, Liga, Serie A et Ligue 1 pour Haïti. Probabilités 1X2, BTTS, plus/moins 2,5 buts. Historique public, prix en HTG.",
  applicationName: "Winala",
  // Static file with relative URLs: works at the domain root and under a sub-path.
  manifest: `${BASE_PATH}/manifest.webmanifest`,
  appleWebApp: { capable: true, title: "Winala", statusBarStyle: "black-translucent" },
  openGraph: {
    type: "website",
    locale: "fr_HT",
    siteName: "Winala",
    title: "Winala — Probabilités foot calculées, pas devinées",
    description:
      "Un modèle statistique calcule les chances de chaque match. Historique public. Prix en HTG, paiement MonCash et NatCash.",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0c0e12" },
    { media: "(prefers-color-scheme: light)", color: "#f2f3f5" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${archivo.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
