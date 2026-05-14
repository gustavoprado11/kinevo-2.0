// Fase 16 · Strava OAuth client
// Fluxo:
//   1. openAuthorizationFlow() → abre browser nativo em www.strava.com/oauth/authorize
//   2. Strava redireciona pra https://kinevo.app/strava-callback.html?code=...
//   3. Página web faz auto-deep-link pra kinevo://strava-callback?code=...
//   4. openAuthSessionAsync resolve com o deep link URL
//   5. exchangeCodeForToken() chama edge function strava-token-exchange
//   6. Tokens persistidos em SecureStore (NUNCA em MMKV — são secrets)
//
// PKCE NÃO é suportado pela Strava — exchange precisa de client_secret,
// portanto roda server-side via Supabase Edge Function.

import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import Constants from "expo-constants";

import { supabase } from "../supabase";
import type { StravaTokenPayload } from "./types";

const STRAVA_AUTHORIZE_URL = "https://www.strava.com/oauth/authorize";
const STRAVA_DEAUTHORIZE_URL = "https://www.strava.com/oauth/deauthorize";
const STRAVA_SCOPE = "read,activity:read_all";

// Web callback page deep-links back to mobile scheme.
// Strava exige HTTPS dentro do Authorization Callback Domain registrado
// (www.kinevoapp.com) — custom schemes (kinevo://) são rejeitados com
// {field: "redirect_uri", code: "invalid"}.
const REDIRECT_URI = "https://www.kinevoapp.com/strava-callback";
const MOBILE_CALLBACK_SCHEME = "kinevo://strava-callback";

// SecureStore keys.
const KEY_ACCESS_TOKEN = "strava_access_token";
const KEY_REFRESH_TOKEN = "strava_refresh_token";
const KEY_EXPIRES_AT = "strava_expires_at";
const KEY_ATHLETE_ID = "strava_athlete_id";

const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

function getClientId(): string {
    const id =
        (Constants.expoConfig?.extra as Record<string, unknown> | undefined)
            ?.strava as { clientId?: string } | undefined;
    if (!id?.clientId) {
        throw new Error(
            "Strava Client ID não configurado em app.json (extra.strava.clientId).",
        );
    }
    return id.clientId;
}

export interface StravaTokens {
    accessToken: string;
    refreshToken: string;
    expiresAt: number; // unix seconds
    athleteId: string | null;
}

export async function getStoredTokens(): Promise<StravaTokens | null> {
    try {
        const [accessToken, refreshToken, expiresAtStr, athleteId] = await Promise.all([
            SecureStore.getItemAsync(KEY_ACCESS_TOKEN, SECURE_STORE_OPTIONS),
            SecureStore.getItemAsync(KEY_REFRESH_TOKEN, SECURE_STORE_OPTIONS),
            SecureStore.getItemAsync(KEY_EXPIRES_AT, SECURE_STORE_OPTIONS),
            SecureStore.getItemAsync(KEY_ATHLETE_ID, SECURE_STORE_OPTIONS),
        ]);
        if (!accessToken || !refreshToken || !expiresAtStr) return null;
        return {
            accessToken,
            refreshToken,
            expiresAt: Number(expiresAtStr),
            athleteId,
        };
    } catch {
        return null;
    }
}

async function persistTokens(tokens: StravaTokens): Promise<void> {
    await Promise.all([
        SecureStore.setItemAsync(KEY_ACCESS_TOKEN, tokens.accessToken, SECURE_STORE_OPTIONS),
        SecureStore.setItemAsync(KEY_REFRESH_TOKEN, tokens.refreshToken, SECURE_STORE_OPTIONS),
        SecureStore.setItemAsync(KEY_EXPIRES_AT, String(tokens.expiresAt), SECURE_STORE_OPTIONS),
        tokens.athleteId
            ? SecureStore.setItemAsync(KEY_ATHLETE_ID, tokens.athleteId, SECURE_STORE_OPTIONS)
            : Promise.resolve(),
    ]);
}

export async function clearStoredTokens(): Promise<void> {
    await Promise.all([
        SecureStore.deleteItemAsync(KEY_ACCESS_TOKEN, SECURE_STORE_OPTIONS),
        SecureStore.deleteItemAsync(KEY_REFRESH_TOKEN, SECURE_STORE_OPTIONS),
        SecureStore.deleteItemAsync(KEY_EXPIRES_AT, SECURE_STORE_OPTIONS),
        SecureStore.deleteItemAsync(KEY_ATHLETE_ID, SECURE_STORE_OPTIONS),
    ]);
}

function buildAuthorizationUrl(): string {
    const clientId = getClientId();
    const params = new URLSearchParams({
        client_id: clientId,
        response_type: "code",
        redirect_uri: REDIRECT_URI,
        approval_prompt: "auto",
        scope: STRAVA_SCOPE,
    });
    return `${STRAVA_AUTHORIZE_URL}?${params.toString()}`;
}

function extractCodeFromUrl(url: string): string | null {
    try {
        const queryStart = url.indexOf("?");
        if (queryStart === -1) return null;
        const params = new URLSearchParams(url.slice(queryStart + 1));
        return params.get("code");
    } catch {
        return null;
    }
}

export interface AuthorizationResult {
    code: string | null;
    cancelled: boolean;
    error?: string;
}

export async function openAuthorizationFlow(): Promise<AuthorizationResult> {
    const authUrl = buildAuthorizationUrl();
    // openAuthSessionAsync resolve quando o browser redireciona pro scheme passado.
    const result = await WebBrowser.openAuthSessionAsync(authUrl, MOBILE_CALLBACK_SCHEME);

    if (result.type === "cancel" || result.type === "dismiss") {
        return { code: null, cancelled: true };
    }
    if (result.type !== "success" || !result.url) {
        return { code: null, cancelled: false, error: "Authorization flow failed" };
    }
    const code = extractCodeFromUrl(result.url);
    if (!code) {
        return { code: null, cancelled: false, error: "Missing code in callback URL" };
    }
    return { code, cancelled: false };
}

export async function exchangeCodeForToken(code: string): Promise<StravaTokens> {
    const { data, error } = await supabase.functions.invoke<StravaTokenPayload>(
        "strava-token-exchange",
        { body: { code } },
    );
    if (error) throw new Error(`strava-token-exchange failed: ${error.message}`);
    if (!data?.access_token || !data?.refresh_token || !data?.expires_at) {
        throw new Error("strava-token-exchange returned invalid payload");
    }
    const tokens: StravaTokens = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: data.expires_at,
        athleteId: data.athlete?.id != null ? String(data.athlete.id) : null,
    };
    await persistTokens(tokens);
    return tokens;
}

export async function refreshAccessToken(refreshToken: string): Promise<StravaTokens> {
    const { data, error } = await supabase.functions.invoke<StravaTokenPayload>(
        "strava-token-refresh",
        { body: { refresh_token: refreshToken } },
    );
    if (error) throw new Error(`strava-token-refresh failed: ${error.message}`);
    if (!data?.access_token || !data?.refresh_token || !data?.expires_at) {
        throw new Error("strava-token-refresh returned invalid payload");
    }
    // Athlete id não vem no refresh — preservar valor já armazenado.
    const previous = await getStoredTokens();
    const tokens: StravaTokens = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: data.expires_at,
        athleteId: previous?.athleteId ?? null,
    };
    await persistTokens(tokens);
    return tokens;
}

// Retorna access token válido, fazendo refresh se faltam <5min pra expirar.
export async function getValidAccessToken(): Promise<string | null> {
    const stored = await getStoredTokens();
    if (!stored) return null;

    const fiveMinFromNow = Math.floor(Date.now() / 1000) + 5 * 60;
    if (stored.expiresAt > fiveMinFromNow) {
        return stored.accessToken;
    }
    const refreshed = await refreshAccessToken(stored.refreshToken);
    return refreshed.accessToken;
}

// Best-effort deauthorize na Strava + cleanup local.
// Se a chamada falhar (offline, token já revogado), ainda limpa SecureStore.
export async function deauthorizeStrava(): Promise<void> {
    const stored = await getStoredTokens();
    if (stored?.accessToken) {
        try {
            await fetch(STRAVA_DEAUTHORIZE_URL, {
                method: "POST",
                headers: { Authorization: `Bearer ${stored.accessToken}` },
            });
        } catch {
            // Ignora — proceder com limpeza local de qualquer forma.
        }
    }
    await clearStoredTokens();
}
