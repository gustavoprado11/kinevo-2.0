// Helpers compartilhados da integração Strava SERVER-SIDE (webhook, setup,
// reconcile, persistência de tokens). Deno / Supabase Edge Functions.
//
// Contexto (F3 da analise-saude-aluno-2026-07-07): historicamente os tokens do
// Strava viviam SÓ no SecureStore do device — o servidor não conseguia buscar
// atividades sem o app aberto. Agora o exchange/refresh (edge) TAMBÉM persiste
// os tokens em wearable_oauth_tokens (source='strava'), habilitando webhook e
// cron de reconciliação.
//
// Credenciais do app Strava: Deno.env STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET
// (secrets de function, compartilhados no projeto). A linha 'strava' da tabela
// wearable_provider_config guarda só verification_token / callback_url /
// setup_secret (client_secret lá é o placeholder 'env:STRAVA_CLIENT_SECRET').
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const STRAVA_API_BASE = "https://www.strava.com/api/v3";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-setup-secret",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function adminClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

export function envCreds(): { clientId: string; clientSecret: string } | null {
  const clientId = Deno.env.get("STRAVA_CLIENT_ID");
  const clientSecret = Deno.env.get("STRAVA_CLIENT_SECRET");
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

// ── Config (verification_token/callback_url/setup_secret da linha 'strava') ──
export interface StravaWebhookConfig {
  verificationToken: string | null;
  callbackUrl: string | null;
  setupSecret: string | null;
}

export async function getStravaConfig(admin: SupabaseClient): Promise<StravaWebhookConfig> {
  const { data, error } = await admin
    .from("wearable_provider_config")
    .select("verification_token, callback_url, setup_secret")
    .eq("source", "strava")
    .maybeSingle();
  if (error || !data) throw new Error("strava config not found in wearable_provider_config");
  const row = data as { verification_token: string | null; callback_url: string | null; setup_secret: string | null };
  return {
    verificationToken: row.verification_token,
    callbackUrl: row.callback_url,
    setupSecret: row.setup_secret,
  };
}

// ── Tokens (wearable_oauth_tokens, source='strava') ─────────────────────────
export interface StravaTokenRow {
  id: string;
  student_id: string;
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
  external_user_id: string | null;
}

const TOKEN_COLS = "id, student_id, access_token, refresh_token, expires_at, external_user_id";

export async function getTokenByStudent(admin: SupabaseClient, studentId: string): Promise<StravaTokenRow | null> {
  const { data } = await admin
    .from("wearable_oauth_tokens").select(TOKEN_COLS)
    .eq("source", "strava").eq("student_id", studentId).maybeSingle();
  return (data as StravaTokenRow | null) ?? null;
}

export async function getTokenByAthlete(admin: SupabaseClient, athleteId: string): Promise<StravaTokenRow | null> {
  const { data } = await admin
    .from("wearable_oauth_tokens").select(TOKEN_COLS)
    .eq("source", "strava").eq("external_user_id", athleteId).maybeSingle();
  return (data as StravaTokenRow | null) ?? null;
}

/** Upsert dos tokens (chamado pelo exchange/refresh e pelo próprio refresh server-side). */
export async function persistTokens(
  admin: SupabaseClient,
  studentId: string,
  t: { access_token: string; refresh_token?: string | null; expires_at?: number | string | null; external_user_id?: string | null },
): Promise<void> {
  const expiresIso = t.expires_at == null
    ? null
    : typeof t.expires_at === "number"
      ? new Date(t.expires_at * 1000).toISOString() // Strava manda epoch segundos
      : t.expires_at;
  await admin.from("wearable_oauth_tokens").upsert(
    {
      student_id: studentId,
      source: "strava",
      access_token: t.access_token,
      ...(t.refresh_token !== undefined ? { refresh_token: t.refresh_token } : {}),
      ...(expiresIso !== null ? { expires_at: expiresIso } : {}),
      ...(t.external_user_id !== undefined && t.external_user_id !== null
        ? { external_user_id: String(t.external_user_id) }
        : {}),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "student_id,source" },
  );
}

/** Access token válido; refresh (com persistência) se faltar <10min. */
export async function ensureValidToken(admin: SupabaseClient, row: StravaTokenRow): Promise<string> {
  const expiresAt = row.expires_at ? new Date(row.expires_at).getTime() : 0;
  if (expiresAt - Date.now() > 10 * 60_000) return row.access_token;
  if (!row.refresh_token) return row.access_token;
  const creds = envCreds();
  if (!creds) return row.access_token;
  // Mesmo endpoint usado pela strava-token-refresh (api/v3/oauth/token).
  const res = await fetch(`${STRAVA_API_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      grant_type: "refresh_token",
      refresh_token: row.refresh_token,
    }),
  });
  if (!res.ok) throw new Error(`strava token refresh failed: ${res.status} ${await res.text()}`);
  const data = await res.json() as { access_token: string; refresh_token: string; expires_at: number };
  await persistTokens(admin, row.student_id, data);
  return data.access_token;
}

// ── API ──────────────────────────────────────────────────────────────────────
async function stravaGet(accessToken: string, path: string): Promise<any> {
  const res = await fetch(`${STRAVA_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`strava GET ${path} failed: ${res.status} ${await res.text()}`);
  return await res.json();
}

export async function getActivityById(accessToken: string, id: string): Promise<StravaActivity> {
  return await stravaGet(accessToken, `/activities/${id}`) as StravaActivity;
}

export async function getRecentActivities(accessToken: string, afterEpochSec: number): Promise<StravaActivity[]> {
  const data = await stravaGet(accessToken, `/athlete/activities?after=${afterEpochSec}&per_page=50`);
  return Array.isArray(data) ? data as StravaActivity[] : [];
}

// ── Mapeamento → external_activities (ESPELHO de mobile/lib/strava/mapping.ts —
//    manter os dois em sincronia; mesma row para o mesmo payload) ─────────────
export interface StravaActivity {
  id: number | string;
  name?: string;
  type?: string;
  sport_type?: string;
  distance?: number | null;
  moving_time?: number | null;
  elapsed_time?: number | null;
  calories?: number | null;
  has_heartrate?: boolean;
  average_heartrate?: number | null;
  max_heartrate?: number | null;
  total_elevation_gain?: number | null;
  start_date?: string;
}

const STRAVA_TYPE_MAP: Record<string, string> = {
  Run: "running", TrailRun: "running", VirtualRun: "running",
  Ride: "cycling", MountainBikeRide: "cycling", GravelRide: "cycling",
  EBikeRide: "cycling", EMountainBikeRide: "cycling", VirtualRide: "cycling",
  Swim: "swimming", Hike: "hiking", Walk: "walking",
  WeightTraining: "workout", Workout: "workout", Rowing: "rowing", Crossfit: "crossfit",
};

export function mapActivityToRow(activity: StravaActivity, studentId: string): Record<string, unknown> {
  const type = activity.sport_type ?? activity.type;
  return {
    student_id: studentId,
    source: "strava",
    external_id: String(activity.id),
    activity_type: (type && STRAVA_TYPE_MAP[type]) || "other",
    name: activity.name?.trim() || "Atividade",
    distance_meters: activity.distance ?? null,
    duration_seconds: Math.max(0, Math.round(activity.moving_time ?? activity.elapsed_time ?? 0)),
    calories: activity.calories ?? null,
    avg_heart_rate: activity.has_heartrate && activity.average_heartrate != null
      ? Math.round(activity.average_heartrate) : null,
    max_heart_rate: activity.has_heartrate && activity.max_heartrate != null
      ? Math.round(activity.max_heartrate) : null,
    elevation_gain_meters: activity.total_elevation_gain ?? null,
    started_at: activity.start_date,
    raw: activity as unknown as Record<string, unknown>,
    synced_at: new Date().toISOString(),
  };
}

export async function upsertActivities(admin: SupabaseClient, rows: Record<string, unknown>[]): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await admin.from("external_activities").upsert(rows, { onConflict: "source,external_id" });
  if (error) throw new Error(`upsert external_activities: ${error.message}`);
}

export async function touchConnection(
  admin: SupabaseClient,
  studentId: string,
  patch: { status?: "active" | "revoked" | "error"; last_error?: string | null },
): Promise<void> {
  await admin.from("wearable_connections").upsert(
    {
      student_id: studentId,
      source: "strava",
      status: patch.status ?? "active",
      last_sync_at: new Date().toISOString(),
      ...(patch.last_error !== undefined ? { last_error: patch.last_error } : {}),
    },
    { onConflict: "student_id,source" },
  );
}

// Comparação constant-time (mesma do _shared/oura.ts).
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
