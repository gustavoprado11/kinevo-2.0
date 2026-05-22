// Oura OAuth — troca authorization_code por tokens, guarda server-side,
// faz backfill de 30 dias e marca a conexão como ativa.
// Spec: mobile/specs/active/oura-integration.md
import {
  adminClient,
  backfillOura,
  corsHeaders,
  exchangeCode,
  getOuraConfig,
  getPersonalInfo,
  json,
} from "../_shared/oura.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const admin = adminClient();

    // Identifica o aluno pelo JWT do usuário.
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    const { data: userRes, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userRes?.user) return json({ error: "unauthorized" }, 401);

    const { data: student } = await admin
      .from("students")
      .select("id")
      .eq("auth_user_id", userRes.user.id)
      .maybeSingle();
    const studentId = (student as { id?: string } | null)?.id;
    if (!studentId) return json({ error: "student_not_found" }, 404);

    const { code, redirect_uri } = await req.json();
    if (!code || typeof code !== "string" || !redirect_uri) {
      return json({ error: "missing_code_or_redirect_uri" }, 400);
    }

    const cfg = await getOuraConfig(admin);
    const tokens = await exchangeCode(code, redirect_uri, cfg);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    let externalUserId: string | null = null;
    try {
      externalUserId = (await getPersonalInfo(tokens.access_token)).id || null;
    } catch {
      // personal_info opcional — segue sem external_user_id (webhook fallback).
    }

    await admin.from("wearable_oauth_tokens").upsert({
      student_id: studentId,
      source: "oura",
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: expiresAt,
      scope: tokens.scope ?? null,
      external_user_id: externalUserId,
      updated_at: new Date().toISOString(),
    }, { onConflict: "student_id,source" });

    await admin.from("wearable_connections").upsert({
      student_id: studentId,
      source: "oura",
      status: "active",
      granted_categories: ["sleep", "hr_resting", "hrv", "steps"],
      external_user_id: externalUserId,
      connected_at: new Date().toISOString(),
      last_error: null,
    }, { onConflict: "student_id,source" });

    // Backfill best-effort — falha não invalida a conexão.
    let counts = { sleep: 0, readiness: 0, activity: 0 };
    try {
      counts = await backfillOura(admin, studentId, tokens.access_token, 30);
      await admin.from("wearable_connections")
        .update({ last_sync_at: new Date().toISOString() })
        .eq("student_id", studentId).eq("source", "oura");
    } catch (e) {
      await admin.from("wearable_connections")
        .update({ last_error: e instanceof Error ? e.message : "backfill_failed" })
        .eq("student_id", studentId).eq("source", "oura");
    }

    return json({ ok: true, external_user_id: externalUserId, counts });
  } catch (err) {
    return json({ error: "internal", message: err instanceof Error ? err.message : "unknown" }, 500);
  }
});
