// Helpers compartilhados da integração Oura (exchange, sync, webhook).
// Deno / Supabase Edge Functions. Spec: mobile/specs/active/oura-integration.md
//
// Config (client_id/secret/verification_token/callback_url) vem da tabela
// wearable_provider_config (service-role only) — não de Deno.env, porque não há
// ferramenta MCP pra setar secrets de function. getOuraConfig(admin) lê de lá.
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const OURA_API_BASE = "https://api.ouraring.com";
export const OURA_TOKEN_URL = `${OURA_API_BASE}/oauth/token`;

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

// ── Config do provider (DB) ───────────────────────────────────────────────────
export interface OuraConfig {
  clientId: string;
  clientSecret: string;
  verificationToken: string | null;
  callbackUrl: string | null;
}

export async function getOuraConfig(admin: SupabaseClient): Promise<OuraConfig> {
  const { data, error } = await admin
    .from("wearable_provider_config")
    .select("client_id, client_secret, verification_token, callback_url")
    .eq("source", "oura")
    .maybeSingle();
  if (error || !data) throw new Error("oura config not found in wearable_provider_config");
  const row = data as {
    client_id: string;
    client_secret: string;
    verification_token: string | null;
    callback_url: string | null;
  };
  return {
    clientId: row.client_id,
    clientSecret: row.client_secret,
    verificationToken: row.verification_token,
    callbackUrl: row.callback_url,
  };
}

// ── Tokens ──────────────────────────────────────────────────────────────────
export interface OuraTokenRow {
  id: string;
  student_id: string;
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
  external_user_id: string | null;
}

export interface OuraTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}

export async function exchangeCode(
  code: string,
  redirectUri: string,
  cfg: OuraConfig,
): Promise<OuraTokenResponse> {
  const res = await fetch(OURA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
    }),
  });
  if (!res.ok) throw new Error(`oura token exchange failed: ${res.status} ${await res.text()}`);
  return await res.json() as OuraTokenResponse;
}

export async function refreshToken(refresh: string, cfg: OuraConfig): Promise<OuraTokenResponse> {
  const res = await fetch(OURA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refresh,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
    }),
  });
  if (!res.ok) throw new Error(`oura token refresh failed: ${res.status} ${await res.text()}`);
  return await res.json() as OuraTokenResponse;
}

// Garante um access token válido; faz refresh (single-use) se faltar <10min.
export async function ensureValidToken(admin: SupabaseClient, row: OuraTokenRow): Promise<string> {
  const expiresAt = row.expires_at ? new Date(row.expires_at).getTime() : 0;
  if (expiresAt - Date.now() > 10 * 60_000) return row.access_token;
  if (!row.refresh_token) return row.access_token;
  const cfg = await getOuraConfig(admin);
  const refreshed = await refreshToken(row.refresh_token, cfg);
  const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
  await admin.from("wearable_oauth_tokens").update({
    access_token: refreshed.access_token,
    refresh_token: refreshed.refresh_token,
    expires_at: newExpiry,
    scope: refreshed.scope ?? null,
    updated_at: new Date().toISOString(),
  }).eq("id", row.id);
  return refreshed.access_token;
}

// ── Oura API ─────────────────────────────────────────────────────────────────
async function ouraGet(accessToken: string, path: string, params?: Record<string, string>): Promise<any> {
  const url = new URL(`${OURA_API_BASE}${path}`);
  if (params) for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`oura GET ${path} failed: ${res.status} ${await res.text()}`);
  return await res.json();
}

export async function getPersonalInfo(accessToken: string): Promise<{ id: string }> {
  const data = await ouraGet(accessToken, "/v2/usercollection/personal_info");
  return { id: String(data?.id ?? "") };
}

export async function getSleep(accessToken: string, start: string, end: string): Promise<OuraSleep[]> {
  const data = await ouraGet(accessToken, "/v2/usercollection/sleep", { start_date: start, end_date: end });
  return (data?.data ?? []) as OuraSleep[];
}

export async function getDailyReadiness(accessToken: string, start: string, end: string): Promise<OuraDailyReadiness[]> {
  const data = await ouraGet(accessToken, "/v2/usercollection/daily_readiness", { start_date: start, end_date: end });
  return (data?.data ?? []) as OuraDailyReadiness[];
}

export async function getDailyActivity(accessToken: string, start: string, end: string): Promise<OuraDailyActivity[]> {
  const data = await ouraGet(accessToken, "/v2/usercollection/daily_activity", { start_date: start, end_date: end });
  return (data?.data ?? []) as OuraDailyActivity[];
}

export async function getDocument(accessToken: string, dataType: string, id: string): Promise<any> {
  return await ouraGet(accessToken, `/v2/usercollection/${dataType}/${id}`);
}

// ── Tipos Oura (campos usados) ───────────────────────────────────────────────
export interface OuraSleep {
  id: string;
  day: string;
  type?: string;
  total_sleep_duration?: number | null;
  time_in_bed?: number | null;
  deep_sleep_duration?: number | null;
  rem_sleep_duration?: number | null;
  light_sleep_duration?: number | null;
  awake_time?: number | null;
  average_hrv?: number | null;
  lowest_heart_rate?: number | null;
  efficiency?: number | null;
}

export interface OuraDailyReadiness { id: string; day: string; score?: number | null; }
export interface OuraDailyActivity {
  id: string;
  day: string;
  steps?: number | null;
  active_calories?: number | null;
  equivalent_walking_distance?: number | null;
}

// ── Mapeamento → linhas das tabelas Kinevo ───────────────────────────────────
const secToMin = (s: number | null | undefined): number | null => s == null ? null : Math.round(s / 60);

export function pickMainSleep(records: OuraSleep[], day: string): OuraSleep | null {
  const ofDay = records.filter((r) => r.day === day && (r.total_sleep_duration ?? 0) > 0);
  if (ofDay.length === 0) return null;
  return ofDay.reduce((a, b) => (b.total_sleep_duration ?? 0) > (a.total_sleep_duration ?? 0) ? b : a);
}

export interface OuraDayWrite { sleep?: OuraSleep; readiness?: OuraDailyReadiness; activity?: OuraDailyActivity; }

export async function writeOuraDay(admin: SupabaseClient, studentId: string, day: string, w: OuraDayWrite): Promise<void> {
  const now = new Date().toISOString();
  if (w.sleep) {
    const s = w.sleep;
    await admin.from("daily_sleep_samples").upsert({
      student_id: studentId, sample_date: day,
      duration_minutes: secToMin(s.total_sleep_duration),
      efficiency_pct: s.efficiency ?? null,
      deep_minutes: secToMin(s.deep_sleep_duration),
      rem_minutes: secToMin(s.rem_sleep_duration),
      light_minutes: secToMin(s.light_sleep_duration),
      awake_minutes: secToMin(s.awake_time),
      source: "oura", raw: s as unknown as Record<string, unknown>, synced_at: now,
    }, { onConflict: "student_id,sample_date" });
    if (s.average_hrv != null && Number.isFinite(s.average_hrv)) {
      await admin.from("hrv_samples").upsert({
        student_id: studentId, sample_date: day,
        value_ms: Math.round(s.average_hrv * 100) / 100, source: "oura", synced_at: now,
      }, { onConflict: "student_id,sample_date" });
    }
    if (s.lowest_heart_rate != null && s.lowest_heart_rate > 0) {
      await admin.from("hr_resting_samples").upsert({
        student_id: studentId, sample_date: day,
        bpm: Math.round(s.lowest_heart_rate), source: "oura", synced_at: now,
      }, { onConflict: "student_id,sample_date" });
    }
  }
  if (w.activity) {
    const a = w.activity;
    await admin.from("daily_activity_samples").upsert({
      student_id: studentId, sample_date: day,
      steps: a.steps ?? null, calories_active: a.active_calories ?? null,
      distance_meters: a.equivalent_walking_distance ?? null, source: "oura", synced_at: now,
    }, { onConflict: "student_id,sample_date" });
  }
  if (w.readiness && w.readiness.score != null) {
    await admin.from("readiness_scores").upsert({
      student_id: studentId, score_date: day,
      score: Math.round(w.readiness.score), source: "oura", computed_at: now,
    }, { onConflict: "student_id,score_date" });
  }
}

export async function backfillOura(admin: SupabaseClient, studentId: string, accessToken: string, days: number): Promise<{ sleep: number; readiness: number; activity: number }> {
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60_000);
  const startISO = start.toISOString().slice(0, 10);
  const endISO = end.toISOString().slice(0, 10);
  const [sleep, readiness, activity] = await Promise.all([
    getSleep(accessToken, startISO, endISO).catch(() => [] as OuraSleep[]),
    getDailyReadiness(accessToken, startISO, endISO).catch(() => [] as OuraDailyReadiness[]),
    getDailyActivity(accessToken, startISO, endISO).catch(() => [] as OuraDailyActivity[]),
  ]);
  const readinessByDay = new Map(readiness.map((r) => [r.day, r]));
  const activityByDay = new Map(activity.map((a) => [a.day, a]));
  const daysSet = new Set<string>([...sleep.map((s) => s.day), ...readinessByDay.keys(), ...activityByDay.keys()]);
  for (const day of daysSet) {
    await writeOuraDay(admin, studentId, day, {
      sleep: pickMainSleep(sleep, day) ?? undefined,
      readiness: readinessByDay.get(day),
      activity: activityByDay.get(day),
    });
  }
  return { sleep: sleep.length, readiness: readiness.length, activity: activity.length };
}

// Comparação constant-time entre duas strings (evita timing attack na verificação
// de assinatura). Sempre percorre o tamanho do valor esperado.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// HMAC-SHA256(body) com o client_secret. Confirmar esquema exato na doc da Oura.
export async function verifyOuraSignature(rawBody: string, signatureHeader: string | null, clientSecret: string): Promise<boolean> {
  if (!signatureHeader) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(clientSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  const provided = signatureHeader.replace(/^sha256=/i, "").trim().toLowerCase();
  return timingSafeEqual(provided, hex);
}
