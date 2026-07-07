// Strava webhook setup (nível de APLICAÇÃO — o Strava permite UMA subscription
// por app). Idempotente: lista a subscription atual; cria se faltar; recria se
// o callback divergir da config. Rodar 1x após deploy + cron semanal (paridade
// com oura-webhook-setup). Auth fail-closed via x-setup-secret (linha 'strava'
// de wearable_provider_config). Credenciais do app via Deno.env.
import {
  adminClient,
  corsHeaders,
  envCreds,
  getStravaConfig,
  json,
  timingSafeEqual,
} from "../_shared/strava.ts";

const SUBS_URL = "https://www.strava.com/api/v3/push_subscriptions";

interface SubItem { id?: number; callback_url?: string }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const admin = adminClient();
    const cfg = await getStravaConfig(admin);

    const providedSecret = req.headers.get("x-setup-secret") ?? "";
    if (!cfg.setupSecret || !timingSafeEqual(providedSecret, cfg.setupSecret)) {
      console.warn("[strava-webhook-setup] Rejected: bad or missing x-setup-secret");
      return json({ error: "unauthorized" }, 401);
    }

    const creds = envCreds();
    if (!creds || !cfg.verificationToken || !cfg.callbackUrl) {
      return json({ error: "missing_config" }, 500);
    }
    const authQS = `client_id=${encodeURIComponent(creds.clientId)}&client_secret=${encodeURIComponent(creds.clientSecret)}`;

    // 1. Estado atual
    const listRes = await fetch(`${SUBS_URL}?${authQS}`);
    if (!listRes.ok) {
      return json({ error: "list_failed", status: listRes.status, body: await listRes.text() }, 502);
    }
    const subs = (await listRes.json()) as SubItem[];
    const current = Array.isArray(subs) ? subs[0] : undefined;

    // 2. Callback certo já registrado → nada a fazer.
    if (current?.callback_url === cfg.callbackUrl) {
      return json({ ok: true, action: "none", subscription_id: current.id });
    }

    // 3. Callback divergente → remove antes de recriar (limite de 1 por app).
    if (current?.id != null) {
      const del = await fetch(`${SUBS_URL}/${current.id}?${authQS}`, { method: "DELETE" });
      if (!del.ok && del.status !== 204) {
        return json({ error: "delete_failed", status: del.status, body: await del.text() }, 502);
      }
    }

    // 4. Cria (o Strava chama o GET de handshake no callback DURANTE este POST).
    const createRes = await fetch(SUBS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        callback_url: cfg.callbackUrl,
        verify_token: cfg.verificationToken,
      }),
    });
    const createBody = await createRes.json().catch(() => null);
    if (!createRes.ok) {
      return json({ error: "create_failed", status: createRes.status, body: createBody }, 502);
    }
    return json({
      ok: true,
      action: current?.id != null ? "recreated" : "created",
      subscription_id: (createBody as { id?: number } | null)?.id ?? null,
    });
  } catch (err) {
    console.error("[strava-webhook-setup] falhou:", err instanceof Error ? err.message : err);
    return json({ error: "internal", message: err instanceof Error ? err.message : "unknown" }, 500);
  }
});
