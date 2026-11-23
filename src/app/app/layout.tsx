import type { Metadata } from "next";
import { AppHeader, BottomNav, DemoBanner } from "@/components/app-chrome";

export const metadata: Metadata = {
  title: "Matchs",
  // Demo data must never be indexed as if it were real predictions.
  robots: { index: false, follow: false },
};

export default function AppLayout({ children }: LayoutProps<"/app">) {
  return (
    <div className="flex min-h-dvh flex-col pb-[calc(3.5rem+env(safe-area-inset-bottom))]">
      <AppHeader />
      <DemoBanner />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pt-3 pb-8">{children}</main>
      <BottomNav />
    </div>
  );
}
