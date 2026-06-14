// Oura webhook setup + manutenção (nível de APLICAÇÃO, não por usuário).
// Idempotente. Faz 3 coisas:
//   1. cria as subscriptions faltantes (sleep/daily_readiness/daily_activity × create/update)
//   2. RENOVA as que estão perto de expirar (Oura expira subscriptions —
//      modelo tem expiration_time; renovação via PUT /renew/{id})
//   3. reporta o estado
// Rodar 1x após deploy E agendar periodicamente (ex: pg_cron semanal) pra
// manter as subscriptions vivas. Auth de webhook via x-client-id/x-client-secret
// (securityScheme ClientIdAuth/ClientSecretAuth na OpenAPI 1.29).
//
// Env: OURA_CLIENT_ID, OURA_CLIENT_SECRET, OURA_WEBHOOK_VERIFICATION_TOKEN,
//   OURA_WEBHOOK_CALLBACK_URL (https://<ref>.functions.supabase.co/oura-webhook)
import { adminClient, corsHeaders, getOuraConfig, json, OURA_API_BASE, timingSafeEqual } from "../_shared/oura.ts";

const DATA_TYPES = ["sleep", "daily_readiness", "daily_activity"];
const EVENT_TYPES = ["create", "update"];
const RENEW_WINDOW_MS = 7 * 24 * 60 * 60_000; // renova se expira em <7 dias

interface SubItem {
  id?: string;
  data_type?: string;
  event_type?: string;
  expiration_time?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const cfg = await getOuraConfig(adminClient());

    // Guard fail-closed: sem x-setup-secret válido, rejeita. Sem isso, qualquer POST
    // anônimo dispara criação/renovação de subscriptions (abuso de quota Oura).
    // Espelha send-push-notification. O cron (migration) manda o header com o mesmo
    // valor lido de wearable_provider_config. verify_jwt permanece false.
    const providedSecret = req.headers.get("x-setup-secret") ?? "";
    if (!cfg.setupSecret || !timingSafeEqual(providedSecret, cfg.setupSecret)) {
      console.warn("[oura-webhook-setup] Rejected: bad or missing x-setup-secret");
      return json({ error: "unauthorized" }, 401);
    }

    const clientId = cfg.clientId;
    const clientSecret = cfg.clientSecret;
    const verificationToken = cfg.verificationToken;
    const callbackUrl = cfg.callbackUrl;
    if (!clientId || !clientSecret || !verificationToken || !callbackUrl) {
      return json({ error: "missing_config" }, 500);
    }

    const headers = {
      "Content-Type": "application/json",
      "x-client-id": clientId,
      "x-client-secret": clientSecret,
    };

    const listRes = await fetch(`${OURA_API_BASE}/v2/webhook/subscription`, { headers });
    const existing: SubItem[] = listRes.ok ? await listRes.json() : [];
    const existingArr = Array.isArray(existing) ? existing : [];
    const existingSet = new Set(existingArr.map((s) => `${s.data_type}:${s.event_type}`));

    const created: string[] = [];
    const skipped: string[] = [];
    const renewed: string[] = [];
    const errors: string[] = [];

    // 1. Cria as faltantes.
    for (const data_type of DATA_TYPES) {
      for (const event_type of EVENT_TYPES) {
        const key = `${data_type}:${event_type}`;
        if (existingSet.has(key)) { skipped.push(key); continue; }
        const res = await fetch(`${OURA_API_BASE}/v2/webhook/subscription`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            callback_url: callbackUrl,
            verification_token: verificationToken,
            event_type,
            data_type,
          }),
        });
        if (res.ok) created.push(key);
        else errors.push(`create ${key}: ${res.status} ${await res.text()}`);
      }
    }

    // 2. Renova as que expiram em <7 dias.
    const now = Date.now();
    for (const sub of existingArr) {
      if (!sub.id || !sub.expiration_time) continue;
      const exp = new Date(sub.expiration_time).getTime();
      if (Number.isFinite(exp) && exp - now < RENEW_WINDOW_MS) {
        const res = await fetch(
          `${OURA_API_BASE}/v2/webhook/subscription/renew/${sub.id}`,
          { method: "PUT", headers },
        );
        if (res.ok) renewed.push(`${sub.data_type}:${sub.event_type}`);
        else errors.push(`renew ${sub.id}: ${res.status} ${await res.text()}`);
      }
    }

    return json({ ok: errors.length === 0, created, skipped, renewed, errors });
  } catch (err) {
    return json({ error: "internal", message: err instanceof Error ? err.message : "unknown" }, 500);
  }
});
