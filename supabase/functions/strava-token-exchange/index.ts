// Fase 16 (pre-impl) — Strava OAuth token exchange (authorization_code grant).
// Strava NÃO suporta PKCE; client_secret precisa ficar server-side.
// O client_secret é configurado via `supabase secrets set STRAVA_CLIENT_SECRET`.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const STRAVA_CLIENT_ID = Deno.env.get("STRAVA_CLIENT_ID");
const STRAVA_CLIENT_SECRET = Deno.env.get("STRAVA_CLIENT_SECRET");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
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
      return new Response(
        JSON.stringify({
          error: "Strava token exchange failed",
          details: data,
        }),
        {
          status: stravaResponse.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
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
