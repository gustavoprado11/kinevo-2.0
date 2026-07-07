// Fase 16 (pre-impl) — Strava OAuth token exchange (authorization_code grant).
// Strava NÃO suporta PKCE; client_secret precisa ficar server-side.
// O client_secret é configurado via `supabase secrets set STRAVA_CLIENT_SECRET`.
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

    // Auth: exige um usuário Kinevo autenticado. Sem isto, qualquer um com a
    // anon key (pública) usa o client_secret do app pra trocar authorization
    // codes — open-proxy / confused-deputy contra o app Strava do Kinevo.
    // O mobile já chama via supabase.functions.invoke (envia o JWT da sessão).
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

    const { code } = await req.json();
    if (!code || typeof code !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing or invalid 'code' parameter" }),
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
          code,
          grant_type: "authorization_code",
        }),
      },
    );

    const data = await stravaResponse.json();

    if (!stravaResponse.ok) {
      // Não ecoar o payload do Strava (`details: data`) — pode vazar detalhes
      // do app/credenciais. Loga server-side; devolve erro genérico.
      console.error("[strava-token-exchange] Strava error:", stravaResponse.status, JSON.stringify(data));
      return new Response(
        JSON.stringify({ error: "Strava token exchange failed" }),
        {
          status: stravaResponse.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // F3 (analise-saude-aluno-2026-07-07): persiste os tokens TAMBÉM no servidor
    // (wearable_oauth_tokens) — habilita strava-webhook e wearable-reconcile a
    // buscar atividades sem o app aberto. Best-effort: falha aqui não pode
    // quebrar a conexão do app (que segue com os tokens no SecureStore).
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
            scope: data.scope ?? null,
            external_user_id: data.athlete?.id != null ? String(data.athlete.id) : null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "student_id,source" },
        );
      }
    } catch (persistErr) {
      console.error("[strava-token-exchange] persistência server-side falhou (best-effort):", persistErr);
    }

    // Retorna apenas campos necessários — não vazar payload completo
    return new Response(
      JSON.stringify({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: data.expires_at,
        expires_in: data.expires_in,
        athlete: {
          id: data.athlete?.id,
          firstname: data.athlete?.firstname,
          lastname: data.athlete?.lastname,
        },
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
