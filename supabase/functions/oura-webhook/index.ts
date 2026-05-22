// Oura webhook — recebe eventos de novos dados e grava nas tabelas de saúde.
//   GET  → handshake de verificação (echo do challenge)
//   POST → evento { event_type, data_type, object_id, user_id }
// Mapeia user_id → aluno via wearable_oauth_tokens.external_user_id.
// Spec: mobile/specs/active/oura-integration.md
import {
  adminClient,
  ensureValidToken,
  getDocument,
  getOuraConfig,
  json,
  type OuraDailyActivity,
  type OuraDailyReadiness,
  type OuraSleep,
  type OuraTokenRow,
  verifyOuraSignature,
  writeOuraDay,
} from "../_shared/oura.ts";

const SUPPORTED = new Set(["sleep", "daily_readiness", "daily_activity"]);

Deno.serve(async (req) => {
  const admin = adminClient();

  // ── Handshake de verificação (Oura faz GET com verification_token+challenge) ──
  if (req.method === "GET") {
    const url = new URL(req.url);
    const token = url.searchParams.get("verification_token");
    const challenge = url.searchParams.get("challenge");
    const cfg = await getOuraConfig(admin).catch(() => null);
    if (cfg?.verificationToken && token !== cfg.verificationToken) {
      return json({ error: "invalid_verification_token" }, 401);
    }
    return json({ challenge });
  }

  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const rawBody = await req.text();

    // Valida assinatura (HMAC com client_secret da config).
    const cfg = await getOuraConfig(admin);
    const signature = req.headers.get("x-oura-signature");
    const valid = await verifyOuraSignature(rawBody, signature, cfg.clientSecret);
    if (!valid) return json({ error: "invalid_signature" }, 401);

    const event = JSON.parse(rawBody) as {
      event_type?: string;
      data_type?: string;
      object_id?: string;
      user_id?: string;
    };
    const { data_type, object_id, user_id } = event;
    if (!data_type || !object_id || !user_id) return json({ error: "bad_event" }, 400);
    if (!SUPPORTED.has(data_type)) return json({ ok: true, ignored: data_type });

    const { data: tokenRow } = await admin
      .from("wearable_oauth_tokens")
      .select("id, student_id, access_token, refresh_token, expires_at, external_user_id")
      .eq("source", "oura").eq("external_user_id", user_id).maybeSingle();
    if (!tokenRow) return json({ ok: true, unmapped_user: true }); // 200 evita retry infinito

    const row = tokenRow as OuraTokenRow;
    const accessToken = await ensureValidToken(admin, row);

    // Busca o documento específico do evento e grava o dia correspondente.
    const doc = await getDocument(accessToken, data_type, object_id);
    const day: string | undefined = doc?.day;
    if (!day) return json({ ok: true, no_day: true });

    if (data_type === "sleep") {
      await writeOuraDay(admin, row.student_id, day, { sleep: doc as OuraSleep });
    } else if (data_type === "daily_readiness") {
      await writeOuraDay(admin, row.student_id, day, { readiness: doc as OuraDailyReadiness });
    } else if (data_type === "daily_activity") {
      await writeOuraDay(admin, row.student_id, day, { activity: doc as OuraDailyActivity });
    }

    await admin.from("wearable_connections")
      .update({ last_sync_at: new Date().toISOString(), last_error: null })
      .eq("student_id", row.student_id).eq("source", "oura");

    return json({ ok: true });
  } catch (err) {
    // 200 pra eventos malformados evita retempest de retries; loga o motivo.
    return json({ ok: false, message: err instanceof Error ? err.message : "unknown" });
  }
});
