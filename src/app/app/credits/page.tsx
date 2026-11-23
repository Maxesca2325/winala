import type { Metadata } from "next";
import { LiveRecharge } from "@/components/live-recharge";
import { Recharge } from "@/components/recharge";
import { LIVE } from "@/lib/live";

export const metadata: Metadata = { title: "Crédits" };

export default function CreditsPage() {
  return LIVE ? <LiveRecharge /> : <Recharge />;
}
