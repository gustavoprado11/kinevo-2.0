// Strava webhook — recebe eventos de atividade/atleta e grava em external_activities.
//   GET  → handshake de assinatura (echo do hub.challenge, valida hub.verify_token)
//   POST → evento { object_type, object_id, aspect_type, owner_id, updates }
//
// SEGURANÇA: o Strava NÃO assina eventos (não há HMAC — diferente do Oura). O
// modelo é "evento como DICA": nunca confiamos no payload — usamos owner_id só
// para achar o aluno mapeado e buscamos a VERDADE na API do Strava com o token
// dele. Payload forjado, no pior caso, dispara uma re-busca de dados reais.
// Spec: F3 de docs/analise-saude-aluno-2026-07-07.md.
import {
  adminClient,
  corsHeaders,
  ensureValidToken,
  getActivityById,
  getStravaConfig,
  getTokenByAthlete,
  json,
  mapActivityToRow,
  touchConnection,
  upsertActivities,
} from "../_shared/strava.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = adminClient();

  // ── Handshake (criação da subscription): GET com hub.mode/hub.challenge ──
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const challenge = url.searchParams.get("hub.challenge");
    const verifyToken = url.searchParams.get("hub.verify_token");
    const cfg = await getStravaConfig(admin).catch(() => null);
    if (mode !== "subscribe" || !challenge) return json({ error: "bad_request" }, 400);
    if (cfg?.verificationToken && verifyToken !== cfg.verificationToken) {
      console.error("[strava-webhook] handshake com verify_token inválido");
      return json({ error: "invalid_verify_token" }, 403);
    }
    // Echo EXATO exigido pelo Strava: {"hub.challenge": "..."}
    return json({ "hub.challenge": challenge });
  }

  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const event = await req.json().catch(() => null) as {
      object_type?: string;
      object_id?: number | string;
      aspect_type?: "create" | "update" | "delete";
      owner_id?: number | string;
      updates?: Record<string, unknown>;
    } | null;
    if (!event?.object_type || event.owner_id == null) return json({ error: "bad_event" }, 400);

    const athleteId = String(event.owner_id);
    const tokenRow = await getTokenByAthlete(admin, athleteId);
    // Atleta sem token server-side (conexão antiga, pré-persistência): 200 pra
    // não acumular retries — o reconcile diário sinaliza a lacuna na conexão.
    if (!tokenRow) return json({ ok: true, unmapped_athlete: true });

    // Desautorização (object_type=athlete, updates.authorized="false"):
    // marca revogado e descarta os tokens — o aluno reconecta pelo app.
    if (event.object_type === "athlete") {
      if (String(event.updates?.authorized ?? "") === "false") {
        await admin.from("wearable_oauth_tokens").delete()
          .eq("source", "strava").eq("student_id", tokenRow.student_id);
        await touchConnection(admin, tokenRow.student_id, {
          status: "revoked",
          last_error: "Acesso revogado no Strava — reconecte pelo app.",
        });
      }
      return json({ ok: true });
    }

    if (event.object_type !== "activity" || event.object_id == null) {
      return json({ ok: true, ignored: event.object_type });
    }
    const activityId = String(event.object_id);

    if (event.aspect_type === "delete") {
      await admin.from("external_activities").delete()
        .eq("source", "strava").eq("external_id", activityId)
        .eq("student_id", tokenRow.student_id);
      return json({ ok: true, deleted: true });
    }

    // create/update → busca a atividade real e grava.
    const accessToken = await ensureValidToken(admin, tokenRow);
    const activity = await getActivityById(accessToken, activityId);
    await upsertActivities(admin, [mapActivityToRow(activity, tokenRow.student_id)]);
    await touchConnection(admin, tokenRow.student_id, { last_error: null });

    return json({ ok: true });
  } catch (err) {
    // 200 evita tempestade de retries do Strava; o motivo fica no log e o
    // reconcile diário cobre o evento perdido.
    console.error("[strava-webhook] evento falhou:", err instanceof Error ? err.message : err);
    return json({ ok: false, message: err instanceof Error ? err.message : "unknown" });
  }
});
