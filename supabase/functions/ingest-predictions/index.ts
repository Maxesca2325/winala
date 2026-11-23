// Receives the Python model's output and stores it. The model computes every
// number; this function only validates, writes the 3 template arguments
// (v1: no LLM), and calls the ingest_prediction RPC. Never recomputes.
//
// POST /functions/v1/ingest-predictions
// Header: x-ingest-secret: <INGEST_SECRET>
// Body, one of:
//   { "kind": "prediction", "match": {id, league_id, league_name, home_team, away_team, kickoff_time},
//     "analysis_type": "STANDARD" | "DEEP", "calibrated": boolean, "output": <model JSON> }
//   { "kind": "lineup_update", "match_id": "...", "analysis_type": "...", "home_team": "...", "away_team": "...",
//     "calibrated": boolean, "output": <model JSON> }
//   { "kind": "status", "match_id": "...", "status": "POSTPONED" | "CANCELLED" | ... }   → refunds run in the DB
//   { "kind": "settle", "match_id": "...", "market": "1X2", "result": "WIN" | "LOSS" | "VOID" }
//   { "kind": "free_match", "day": "2026-11-22", "match_id": "..." }
import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { buildArguments } from "../_shared/arguments.ts";
import { parseModelOutput } from "../_shared/model.ts";
import { json, requireEnv, timingSafeEqual } from "../_shared/security.ts";

const STATUSES = ["SCHEDULED", "LIVE", "FINISHED", "POSTPONED", "CANCELLED"];
const TYPES = ["STANDARD", "DEEP"];

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });
  const secret = req.headers.get("x-ingest-secret") ?? "";
  if (!timingSafeEqual(secret, requireEnv("INGEST_SECRET").trim())) return json(401, { error: "unauthorized" });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "invalid_json" });
  }

  const db = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });

  try {
    switch (body.kind) {
      case "prediction":
      case "lineup_update": {
        const type = String(body.analysis_type ?? "STANDARD");
        if (!TYPES.includes(type)) return json(400, { error: "bad_analysis_type" });
        const output = parseModelOutput(body.output);
        const match = (body.match ?? {}) as Record<string, string>;
        const home = match.home_team ?? String(body.home_team ?? "");
        const away = match.away_team ?? String(body.away_team ?? "");
        // v1: arguments are always generated from templates, whatever the model sent.
        output.key_arguments = buildArguments(output, home, away, {
          valueBetAllowed: Boolean(body.calibrated) && type === "DEEP",
        });

        if (body.kind === "prediction") {
          if (!match.id || !match.kickoff_time || Number.isNaN(Date.parse(match.kickoff_time))) {
            return json(400, { error: "bad_match" });
          }
          if (output.match_id !== match.id) return json(400, { error: "match_id_mismatch" });
          const { data, error } = await db.rpc("ingest_prediction", {
            p_match: match,
            p_type: type,
            p_output: output,
          });
          if (error) throw error;
          return json(200, data);
        }
        const { data, error } = await db.rpc("apply_lineup_update", {
          p_match_id: String(body.match_id),
          p_type: type,
          p_output: output,
        });
        if (error) throw error;
        return json(200, { updated: data });
      }
      case "status": {
        const status = String(body.status);
        if (!STATUSES.includes(status)) return json(400, { error: "bad_status" });
        // The DB trigger refunds unlocks automatically on POSTPONED/CANCELLED.
        const { error } = await db.from("matches").update({ status }).eq("id", String(body.match_id));
        if (error) throw error;
        return json(200, { ok: true });
      }
      case "settle": {
        const { data, error } = await db.rpc("settle_prediction", {
          p_match_id: String(body.match_id),
          p_market: String(body.market),
          p_result: String(body.result),
        });
        if (error) throw error;
        return json(200, { settled: data });
      }
      case "free_match": {
        const { error } = await db
          .from("daily_free_match")
          .upsert({ day: String(body.day), match_id: String(body.match_id) });
        if (error) throw error;
        return json(200, { ok: true });
      }
      default:
        return json(400, { error: "unknown_kind" });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e);
    console.error("ingest error", message);
    return json(message.startsWith("Sortie du modèle invalide") ? 422 : 500, { error: message });
  }
});
