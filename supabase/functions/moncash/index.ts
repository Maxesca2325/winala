// MonCash (Digicel) payment gateway. Client ID/secret live only here, never in
// the browser. Two actions, both require the caller's Supabase JWT and check
// they own the transaction referenced:
//
//   POST { action: "create", reference: "WN-XXXXXX" }
//     → OAuth, CreatePayment, returns { redirect_url } to send the user to MonCash.
//   POST { action: "verify", reference: "WN-XXXXXX" }
//     → RetrieveOrderPayment; on success calls confirm_payment (idempotent credit).
//       Returns { status: "COMPLETED" | "PENDING" | "FAILED", credits_added? }.
//
// Haiti has no reliable webhook, so the browser polls "verify" when the user
// returns from MonCash. confirm_payment refuses to credit the same MonCash
// transaction twice, so polling is safe.
//
// Secrets (Supabase → Edge Functions): MONCASH_CLIENT_ID, MONCASH_CLIENT_SECRET,
// MONCASH_MODE ("sandbox" or "production"), and SITE_URL (where to send users back).
import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { json, requireEnv } from "../_shared/security.ts";

function bases() {
  const prod = (Deno.env.get("MONCASH_MODE") ?? "sandbox").toLowerCase() === "production";
  const host = prod ? "moncashbutton.digicelgroup.com" : "sandbox.moncashbutton.digicelgroup.com";
  return { api: `https://${host}/Api`, gateway: `https://${host}/Moncash-middleware` };
}

async function token(): Promise<string> {
  const creds = btoa(`${requireEnv("MONCASH_CLIENT_ID")}:${requireEnv("MONCASH_CLIENT_SECRET")}`);
  const r = await fetch(`${bases().api}/oauth/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${creds}`, "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: "scope=read,write&grant_type=client_credentials",
  });
  if (!r.ok) throw new Error(`moncash_oauth_${r.status}`);
  const j = await r.json();
  if (!j.access_token) throw new Error("moncash_oauth_no_token");
  return j.access_token as string;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const authHeader = req.headers.get("Authorization") ?? "";
  let body: { action?: string; reference?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "invalid_json" });
  }
  const reference = String(body.reference ?? "");
  if (!/^WN-[A-Z0-9]{4,10}$/.test(reference)) return json(400, { error: "bad_reference" });

  const url = requireEnv("SUPABASE_URL");
  // Who is calling? (verify the user JWT)
  const asUser = createClient(url, requireEnv("SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: who } = await asUser.auth.getUser();
  if (!who?.user) return json(401, { error: "not_authenticated" });

  const admin = createClient(url, requireEnv("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
  const { data: tx } = await admin
    .from("transactions")
    .select("id, user_id, amount, status, provider, reference")
    .eq("reference", reference)
    .maybeSingle();
  if (!tx || tx.user_id !== who.user.id || tx.provider !== "MONCASH") return json(404, { error: "transaction_not_found" });

  try {
    if (body.action === "create") {
      if (tx.status === "COMPLETED") return json(200, { already: true });
      const t = await token();
      const r = await fetch(`${bases().api}/v1/CreatePayment`, {
        method: "POST",
        headers: { Authorization: `Bearer ${t}`, "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ amount: Number(tx.amount), orderId: reference }),
      });
      const j = await r.json().catch(() => ({}));
      const payToken = j?.payment_token?.token;
      if (!r.ok || !payToken) {
        console.error("CreatePayment failed", r.status, JSON.stringify(j).slice(0, 300));
        return json(502, { error: "moncash_create_failed" });
      }
      return json(200, { redirect_url: `${bases().gateway}/Payment/Redirect?token=${encodeURIComponent(payToken)}` });
    }

    if (body.action === "verify") {
      if (tx.status === "COMPLETED") return json(200, { status: "COMPLETED" });
      const t = await token();
      const r = await fetch(`${bases().api}/v1/RetrieveOrderPayment`, {
        method: "POST",
        headers: { Authorization: `Bearer ${t}`, "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ orderId: reference }),
      });
      const j = await r.json().catch(() => ({}));
      const pay = j?.payment;
      if (!r.ok || !pay || !pay.transaction_id) return json(200, { status: "PENDING" });
      const paid = String(pay.message ?? "").toLowerCase() === "successful";
      if (!paid) return json(200, { status: "PENDING" });

      // Credit idempotently (DB rejects a second credit for the same MonCash tx id).
      const { data: conf, error } = await admin.rpc("confirm_payment", {
        p_reference: reference,
        p_provider: "MONCASH",
        p_external_ref: String(pay.transaction_id),
        p_amount: Number(pay.cost ?? tx.amount),
      });
      if (error) {
        console.error("confirm_payment error", error.message);
        return json(500, { error: "confirm_failed" });
      }
      const status = (conf as { status?: string })?.status;
      if (status === "COMPLETED" || status === "ALREADY_PROCESSED") {
        return json(200, { status: "COMPLETED", credits_added: (conf as { credits_added?: number }).credits_added });
      }
      if (status === "AMOUNT_MISMATCH") return json(200, { status: "FAILED", reason: "amount" });
      return json(200, { status: "PENDING" });
    }

    return json(400, { error: "unknown_action" });
  } catch (e) {
    console.error("moncash error", e instanceof Error ? e.message : String(e));
    return json(502, { error: "moncash_unavailable" });
  }
});
