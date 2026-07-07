// Reconciliação diária de wearables (F3 — o WATCHDOG que faltava).
//
// Para cada conexão Oura/Strava não-revogada: sincroniza server-side uma janela
// curta e grava o DESFECHO REAL em wearable_connections (last_sync_at + status +
// last_error com motivo). É a rede de segurança para webhook perdido/quebrado —
// o incidente do Oura (webhook mudo por 6 semanas sem ninguém saber, jun-jul/2026)
// teria sido pego aqui no primeiro dia.
//
// Auth fail-closed: x-setup-secret (linha 'strava' de wearable_provider_config —
// secret único das operações server-side de wearables). Invocado por pg_cron
// diário (migration 236) e manualmente em diagnóstico.
import {
  backfillOura,
  ensureValidToken as ensureOuraToken,
  getOuraConfig,
  type OuraTokenRow,
} from "../_shared/oura.ts";
import {
  adminClient,
  corsHeaders,
  ensureValidToken as ensureStravaToken,
  getRecentActivities,
  getStravaConfig,
  getTokenByStudent,
  json,
  mapActivityToRow,
  timingSafeEqual,
  touchConnection,
  upsertActivities,
} from "../_shared/strava.ts";

const OURA_BACKFILL_DAYS = 3;
const STRAVA_WINDOW_DAYS = 7;
// Sem token server-side E sem sync de nenhum lado há mais de 48h → a conexão
// está de fato morta (nem o app está sincronizando): marca 'error' visível.
// Com sync recente do app, deixa quieto — o caminho mobile está vivo.
const MOBILE_ALIVE_WINDOW_MS = 48 * 60 * 60_000;

interface ConnRow {
  student_id: string;
  source: string;
  status: string;
  last_sync_at: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const admin = adminClient();
    const stravaCfg = await getStravaConfig(admin);
    const providedSecret = req.headers.get("x-setup-secret") ?? "";
    if (!stravaCfg.setupSecret || !timingSafeEqual(providedSecret, stravaCfg.setupSecret)) {
      console.warn("[wearable-reconcile] Rejected: bad or missing x-setup-secret");
      return json({ error: "unauthorized" }, 401);
    }

    const { data: connsData } = await admin
      .from("wearable_connections")
      .select("student_id, source, status, last_sync_at")
      .in("source", ["oura", "strava"])
      .neq("status", "revoked");
    const conns = (connsData ?? []) as ConnRow[];

    const summary = { oura: { ok: 0, error: 0 }, strava: { ok: 0, error: 0, no_server_token: 0 } };

    for (const conn of conns) {
      try {
        if (conn.source === "oura") {
          const { data: t } = await admin
            .from("wearable_oauth_tokens")
            .select("id, student_id, access_token, refresh_token, expires_at, external_user_id")
            .eq("source", "oura").eq("student_id", conn.student_id).maybeSingle();
          if (!t) throw new Error("token Oura ausente no servidor");
          const accessToken = await ensureOuraToken(admin, t as OuraTokenRow);
          await backfillOura(admin, conn.student_id, accessToken, OURA_BACKFILL_DAYS);
          await admin.from("wearable_connections")
            .update({ last_sync_at: new Date().toISOString(), last_error: null, status: "active" })
            .eq("student_id", conn.student_id).eq("source", "oura");
          summary.oura.ok++;
        } else {
          const t = await getTokenByStudent(admin, conn.student_id);
          if (!t) {
            // Conexão pré-persistência de tokens: só vira 'error' se o app também
            // não sincroniza há tempo (senão o caminho mobile segue atendendo).
            const lastSync = conn.last_sync_at ? new Date(conn.last_sync_at).getTime() : 0;
            if (Date.now() - lastSync > MOBILE_ALIVE_WINDOW_MS) {
              await admin.from("wearable_connections")
                .update({ status: "error", last_error: "Sem sincronizar há dias — abra o app Kinevo para reativar o Strava." })
                .eq("student_id", conn.student_id).eq("source", "strava");
            }
            summary.strava.no_server_token++;
            continue;
          }
          const accessToken = await ensureStravaToken(admin, t);
          const after = Math.floor((Date.now() - STRAVA_WINDOW_DAYS * 24 * 60 * 60_000) / 1000);
          const activities = await getRecentActivities(accessToken, after);
          await upsertActivities(admin, activities.map((a) => mapActivityToRow(a, conn.student_id)));
          await touchConnection(admin, conn.student_id, { status: "active", last_error: null });
          summary.strava.ok++;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "unknown";
        console.error(`[wearable-reconcile] ${conn.source}/${conn.student_id} falhou:`, msg);
        await admin.from("wearable_connections")
          .update({ status: "error", last_error: msg.slice(0, 300) })
          .eq("student_id", conn.student_id).eq("source", conn.source);
        if (conn.source === "oura") summary.oura.error++;
        else summary.strava.error++;
      }
    }

    // getOuraConfig valida que a config Oura segue íntegra (falha alto no log
    // se alguém apagar a linha — outra morte silenciosa a evitar).
    await getOuraConfig(admin).catch((e) => console.error("[wearable-reconcile] config oura ausente:", e?.message));

    return json({ ok: true, connections: conns.length, summary });
  } catch (err) {
    console.error("[wearable-reconcile] falhou:", err instanceof Error ? err.message : err);
    return json({ error: "internal", message: err instanceof Error ? err.message : "unknown" }, 500);
  }
});
