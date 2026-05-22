// Oura disconnect — revoga o token na Oura, remove tokens e marca conexão
// revogada. Best-effort: limpa local mesmo se a revogação remota falhar.
import {
  adminClient,
  corsHeaders,
  getOuraConfig,
  json,
  OURA_API_BASE,
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

    const { data: tokenRow } = await admin
      .from("wearable_oauth_tokens")
      .select("id, student_id, access_token, refresh_token, expires_at, external_user_id")
      .eq("student_id", studentId).eq("source", "oura").maybeSingle();

    // Revogação remota best-effort.
    if (tokenRow) {
      const row = tokenRow as OuraTokenRow;
      try {
        const { clientId, clientSecret } = await getOuraConfig(admin);
        await fetch(`${OURA_API_BASE}/oauth/revoke`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            token: row.access_token,
            client_id: clientId,
            client_secret: clientSecret,
          }),
        });
      } catch {
        // ignora — segue com a limpeza local
      }
      await admin.from("wearable_oauth_tokens").delete().eq("id", row.id);
    }

    await admin.from("wearable_connections")
      .update({ status: "revoked", revoked_at: new Date().toISOString() })
      .eq("student_id", studentId).eq("source", "oura");

    return json({ ok: true });
  } catch (err) {
    return json({ error: "internal", message: err instanceof Error ? err.message : "unknown" }, 500);
  }
});
