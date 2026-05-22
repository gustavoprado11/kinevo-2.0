// Oura OAuth client (Modelo B — server-side tokens).
// Fluxo:
//   1. openAuthorizationFlow() → abre browser em cloud.ouraring.com/oauth/authorize
//   2. Oura redireciona pra https://www.kinevoapp.com/oura-callback?code=...
//   3. A página web faz auto-deep-link pra kinevo://oura-callback?code=...
//   4. openAuthSessionAsync resolve com o deep link
//   5. exchangeCodeForToken() chama a edge function oura-oauth-exchange, que
//      troca o code, GUARDA OS TOKENS NO BACKEND (nunca no device), faz backfill
//      e marca a conexão ativa.
//
// Diferente do Strava: aqui o app não persiste tokens — tudo server-side.
import * as WebBrowser from "expo-web-browser";
import Constants from "expo-constants";

import { supabase } from "../supabase";
import type {
  OuraAuthorizationResult,
  OuraExchangeResponse,
  OuraSyncResponse,
} from "./types";

const OURA_AUTHORIZE_URL = "https://cloud.ouraring.com/oauth/authorize";
const OURA_SCOPE = "personal daily heartrate";

// Oura exige HTTPS no redirect registrado. A página web faz a ponte pro app.
const REDIRECT_URI = "https://www.kinevoapp.com/oura-callback";
const MOBILE_CALLBACK_SCHEME = "kinevo://oura-callback";

function getClientId(): string {
  const oura = (Constants.expoConfig?.extra as Record<string, unknown> | undefined)
    ?.oura as { clientId?: string } | undefined;
  if (!oura?.clientId) {
    throw new Error("Oura Client ID não configurado em app.json (extra.oura.clientId).");
  }
  return oura.clientId;
}

function buildAuthorizationUrl(): string {
  const params = new URLSearchParams({
    client_id: getClientId(),
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    scope: OURA_SCOPE,
  });
  return `${OURA_AUTHORIZE_URL}?${params.toString()}`;
}

function extractCodeFromUrl(url: string): string | null {
  try {
    const q = url.indexOf("?");
    if (q === -1) return null;
    return new URLSearchParams(url.slice(q + 1)).get("code");
  } catch {
    return null;
  }
}

export async function openAuthorizationFlow(): Promise<OuraAuthorizationResult> {
  const authUrl = buildAuthorizationUrl();
  const result = await WebBrowser.openAuthSessionAsync(authUrl, MOBILE_CALLBACK_SCHEME);
  if (result.type === "cancel" || result.type === "dismiss") {
    return { code: null, cancelled: true };
  }
  if (result.type !== "success" || !result.url) {
    return { code: null, cancelled: false, error: "Authorization flow failed" };
  }
  const code = extractCodeFromUrl(result.url);
  if (!code) return { code: null, cancelled: false, error: "Missing code in callback URL" };
  return { code, cancelled: false };
}

// Troca o code via edge function (tokens ficam server-side).
export async function exchangeCodeForToken(code: string): Promise<OuraExchangeResponse> {
  const { data, error } = await supabase.functions.invoke<OuraExchangeResponse>(
    "oura-oauth-exchange",
    { body: { code, redirect_uri: REDIRECT_URI } },
  );
  if (error) throw new Error(`oura-oauth-exchange failed: ${error.message}`);
  if (!data?.ok) throw new Error(data?.error ?? "oura-oauth-exchange returned not ok");
  return data;
}

export async function syncOura(days = 7): Promise<OuraSyncResponse> {
  const { data, error } = await supabase.functions.invoke<OuraSyncResponse>(
    "oura-sync",
    { body: { days } },
  );
  if (error) throw new Error(`oura-sync failed: ${error.message}`);
  return data ?? { ok: false, error: "empty_response" };
}

export async function disconnectOura(): Promise<void> {
  const { error } = await supabase.functions.invoke("oura-disconnect", { body: {} });
  if (error) throw new Error(`oura-disconnect failed: ${error.message}`);
}
