// Payment confirmation for MonCash / NatCash.
//
// Haiti has no clean gateway webhook, so this endpoint is the single door for
// BOTH paths, with the same idempotent rule:
//   1. an aggregator calls it with an HMAC-signed body, or
//   2. an operator back-office (after checking the MonCash/NatCash statement by
//      hand) calls it with the same signature.
// Crediting happens in confirm_payment(), which refuses to credit twice for the
// same reference or the same provider transaction id (external_ref).
//
// POST /functions/v1/payment-webhook
// Header: x-winala-signature: hex(HMAC-SHA256(PAYMENT_WEBHOOK_SECRET, raw body))
// Body:   { "reference": "WN-1A2B3C", "provider": "MONCASH" | "NATCASH",
//           "external_ref": "<provider transaction id>", "amount": 250, "currency": "HTG" }
import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { hmacSha256Hex, json, requireEnv, timingSafeEqual } from "../_shared/security.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const raw = await req.text();
  const expected = await hmacSha256Hex(requireEnv("PAYMENT_WEBHOOK_SECRET"), raw);
  const given = (req.headers.get("x-winala-signature") ?? "").toLowerCase();
  if (!timingSafeEqual(given, expected)) return json(401, { error: "bad_signature" });

  let p: Record<string, unknown>;
  try {
    p = JSON.parse(raw);
  } catch {
    return json(400, { error: "invalid_json" });
  }
  const provider = String(p.provider);
  const amount = Number(p.amount);
  if (!["MONCASH", "NATCASH"].includes(provider)) return json(400, { error: "bad_provider" });
  if (p.currency && p.currency !== "HTG") return json(400, { error: "bad_currency" });
  if (!Number.isFinite(amount) || amount <= 0) return json(400, { error: "bad_amount" });
  if (typeof p.reference !== "string" || typeof p.external_ref !== "string" || !p.external_ref) {
    return json(400, { error: "missing_reference" });
  }

  const db = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });
  const { data, error } = await db.rpc("confirm_payment", {
    p_reference: p.reference,
    p_provider: provider,
    p_external_ref: p.external_ref,
    p_amount: amount,
  });
  if (error) {
    // 500 → the sender retries; the retry is safe (idempotent).
    console.error("confirm_payment failed", error.message);
    return json(500, { error: "confirm_failed" });
  }
  // ALREADY_PROCESSED is a success for the sender: stop retrying.
  return json(200, data);
});
