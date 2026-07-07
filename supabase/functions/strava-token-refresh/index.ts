// Fase 16 (pre-impl) — Strava OAuth token refresh (refresh_token grant).
// Tokens Strava expiram em ~6h. Mobile chama este endpoint pra renovar
// usando o refresh_token persistido. Client secret server-side.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const STRAVA_CLIENT_ID = Deno.env.get("STRAVA_CLIENT_ID");
const STRAVA_CLIENT_SECRET = Deno.env.get("STRAVA_CLIENT_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET) {
      return new Response(
        JSON.stringify({ error: "Strava credentials not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Auth: exige um usuário Kinevo autenticado (evita open-proxy do
    // client_secret via anon key pública). O mobile chama via
    // supabase.functions.invoke, que envia o JWT da sessão.
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !jwt) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
    const { data: userRes, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userRes?.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { refresh_token } = await req.json();
    if (!refresh_token || typeof refresh_token !== "string") {
      return new Response(
        JSON.stringify({
          error: "Missing or invalid 'refresh_token' parameter",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const stravaResponse = await fetch(
      "https://www.strava.com/api/v3/oauth/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: STRAVA_CLIENT_ID,
          client_secret: STRAVA_CLIENT_SECRET,
          refresh_token,
          grant_type: "refresh_token",
        }),
      },
    );

    const data = await stravaResponse.json();

    if (!stravaResponse.ok) {
      console.error("[strava-token-refresh] Strava error:", stravaResponse.status, JSON.stringify(data));
      return new Response(
        JSON.stringify({ error: "Strava token refresh failed" }),
        {
          status: stravaResponse.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // F3 (analise-saude-aluno-2026-07-07): persiste os tokens renovados TAMBÉM no
    // servidor — é assim que conexões ANTIGAS (tokens só no SecureStore) ganham
    // token server-side no primeiro refresh após este deploy, sem update do app.
    // Best-effort: falha aqui não pode quebrar o refresh do app.
    try {
      const { data: student } = await admin
        .from("students").select("id")
        .eq("auth_user_id", userRes.user.id).maybeSingle();
      const studentId = (student as { id?: string } | null)?.id;
      if (studentId) {
        await admin.from("wearable_oauth_tokens").upsert(
          {
            student_id: studentId,
            source: "strava",
            access_token: data.access_token,
            refresh_token: data.refresh_token ?? null,
            expires_at: data.expires_at ? new Date(data.expires_at * 1000).toISOString() : null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "student_id,source" },
        );
        // external_user_id (id do atleta) não vem no refresh — se a conexão do
        // app já o conhece, copia p/ o token (o webhook mapeia por ele).
        const { data: conn } = await admin
          .from("wearable_connections").select("external_user_id")
          .eq("student_id", studentId).eq("source", "strava").maybeSingle();
        const athleteId = (conn as { external_user_id?: string | null } | null)?.external_user_id;
        if (athleteId) {
          await admin.from("wearable_oauth_tokens")
            .update({ external_user_id: athleteId })
            .eq("student_id", studentId).eq("source", "strava")
            .is("external_user_id", null);
        }
      }
    } catch (persistErr) {
      console.error("[strava-token-refresh] persistência server-side falhou (best-effort):", persistErr);
    }

    return new Response(
      JSON.stringify({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: data.expires_at,
        expires_in: data.expires_in,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: "Internal error",
        message: err instanceof Error ? err.message : "unknown",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
