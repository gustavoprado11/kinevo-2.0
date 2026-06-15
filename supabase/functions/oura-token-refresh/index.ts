// Oura token refresh — invocada pelo pg_cron. Renova tokens que expiram em <24h.
// Espelha o padrão de renew-google-watch-channels.
import {
  adminClient,
  ensureValidToken,
  json,
  type OuraTokenRow,
} from "../_shared/oura.ts";

const REFRESH_WINDOW_MS = 24 * 60 * 60_000; // renova se expira em <24h

Deno.serve(async (req) => {
  // Auth: cron-only. Exige x-push-secret (mesmo secret interno do send-push,
  // migration 206). Roda com verify_jwt=false; fail-closed contra POST anônimo.
  const expectedSecret = Deno.env.get("PUSH_WEBHOOK_SECRET");
  const providedSecret = req.headers.get("x-push-secret");
  if (!expectedSecret || providedSecret !== expectedSecret) {
    return json({ error: "unauthorized" }, 401);
  }
  try {
    const admin = adminClient();
    const cutoff = new Date(Date.now() + REFRESH_WINDOW_MS).toISOString();

    const { data: rows } = await admin
      .from("wearable_oauth_tokens")
      .select("id, student_id, access_token, refresh_token, expires_at, external_user_id")
      .eq("source", "oura")
      .not("refresh_token", "is", null)
      .lte("expires_at", cutoff);

    const list = (rows ?? []) as OuraTokenRow[];
    let refreshed = 0;
    let failed = 0;

    let skippedRace = 0;
    for (const row of list) {
      try {
        await ensureValidToken(admin, row); // faz o refresh e persiste
        refreshed += 1;
      } catch (e) {
        // Refresh tokens da Oura são SINGLE-USE: se o webhook renovou nesse
        // meio-tempo, o refresh_token deste row já foi invalidado. Antes de
        // marcar erro, re-checa o row — se outro caminho já renovou (expires_at
        // avançou), foi corrida benigna, não erro real.
        const { data: fresh } = await admin
          .from("wearable_oauth_tokens")
          .select("expires_at")
          .eq("id", row.id).maybeSingle();
        const freshExp = (fresh as { expires_at?: string } | null)?.expires_at;
        const stillExpiring = !freshExp ||
          new Date(freshExp).getTime() - Date.now() < REFRESH_WINDOW_MS;
        if (!stillExpiring) { skippedRace += 1; continue; }

        failed += 1;
        // Refresh genuinamente falhou (token revogado pelo usuário na Oura).
        await admin.from("wearable_connections")
          .update({ status: "error", last_error: e instanceof Error ? e.message : "refresh_failed" })
          .eq("student_id", row.student_id).eq("source", "oura");
      }
    }

    return json({ ok: true, checked: list.length, refreshed, failed, skippedRace });
  } catch (err) {
    return json({ error: "internal", message: err instanceof Error ? err.message : "unknown" }, 500);
  }
});
