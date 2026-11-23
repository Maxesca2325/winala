"use client";

import { normalizeContact } from "./contact";
import { LIVE, sb } from "./backend";

export type WaitlistState = { status: "idle" | "ok" | "error"; message: string };

export async function joinWaitlist(_prev: WaitlistState, form: FormData): Promise<WaitlistState> {
  if (String(form.get("website") ?? "").length > 0) return { status: "ok", message: "C'est noté." };
  const contact = normalizeContact(String(form.get("contact") ?? ""));
  if (!contact) {
    return { status: "error", message: "Numéro ou email invalide. Exemple : 3712 3456 ou toi@exemple.com" };
  }
  if (!LIVE) {
    return { status: "error", message: "Version de test : la liste d'attente n'est pas active ici. Rien n'a été enregistré." };
  }
  const { error } = await sb().rpc("join_waitlist", {
    p_contact: contact.value,
    p_kind: contact.kind,
    p_source: String(form.get("source") ?? "landing").slice(0, 40),
  });
  if (error) return { status: "error", message: "Connexion difficile. Réessaie dans un instant." };
  return {
    status: "ok",
    message:
      contact.kind === "phone"
        ? `C'est noté. On t'écrit au ${contact.value} à l'ouverture, avec tes 3 crédits offerts.`
        : "C'est noté. On t'écrit à l'ouverture, avec tes 3 crédits offerts.",
  };
}
