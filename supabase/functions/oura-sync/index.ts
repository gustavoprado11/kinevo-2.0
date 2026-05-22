// Oura sync manual — "Sync agora" puxa os últimos N dias pro aluno autenticado.
// (O caminho normal é via webhook; este é o fallback acionado pelo usuário.)
import {
  adminClient,
  backfillOura,
  corsHeaders,
  ensureValidToken,
  json,
  type OuraTokenRow,
} from "../_shared/oura.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const admin = adminClient();
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: userRes, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userRes?.user) return json({ error: "unauthorized" }, 401);

    const { data: student } = await admin
      .from("students").select("id")
      .eq("auth_user_id", userRes.user.id).maybeSingle();
    const studentId = (student as { id?: string } | null)?.id;
    if (!studentId) return json({ error: "student_not_found" }, 404);

    const body = await req.json().catch(() => ({}));
    const days = Math.min(Math.max(Number(body?.days) || 7, 1), 60);

    const { data: tokenRow } = await admin
      .from("wearable_oauth_tokens")
      .select("id, student_id, access_token, refresh_token, expires_at, external_user_id")
      .eq("student_id", studentId).eq("source", "oura").maybeSingle();
    if (!tokenRow) return json({ error: "not_connected" }, 404);

    const accessToken = await ensureValidToken(admin, tokenRow as OuraTokenRow);
    const counts = await backfillOura(admin, studentId, accessToken, days);

    await admin.from("wearable_connections")
      .update({ last_sync_at: new Date().toISOString(), last_error: null })
      .eq("student_id", studentId).eq("source", "oura");

    return json({ ok: true, counts });
  } catch (err) {
    return json({ error: "internal", message: err instanceof Error ? err.message : "unknown" }, 500);
  }
});
