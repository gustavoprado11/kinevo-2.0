// Fase 16 · Strava REST API wrapper
// Auto-refresh + simples retry em 401 (token expirou no meio do request).

import { getValidAccessToken, refreshAccessToken, getStoredTokens } from "./oauth";
import type { StravaActivity } from "./types";

const STRAVA_API_BASE = "https://www.strava.com/api/v3";

async function authorizedFetch(
    path: string,
    init: RequestInit = {},
    retryOn401 = true,
): Promise<Response> {
    const token = await getValidAccessToken();
    if (!token) throw new Error("Strava not authorized");

    const res = await fetch(`${STRAVA_API_BASE}${path}`, {
        ...init,
        headers: {
            ...(init.headers ?? {}),
            Authorization: `Bearer ${token}`,
        },
    });

    if (res.status === 401 && retryOn401) {
        // Token rejeitado mid-flight — força refresh e tenta uma vez.
        const stored = await getStoredTokens();
        if (stored) {
            await refreshAccessToken(stored.refreshToken);
            return authorizedFetch(path, init, false);
        }
    }
    return res;
}

export interface GetActivitiesParams {
    after?: number; // unix seconds
    before?: number;
    page?: number;
    perPage?: number;
}

export async function getActivities(
    params: GetActivitiesParams = {},
): Promise<StravaActivity[]> {
    const search = new URLSearchParams();
    if (params.after != null) search.set("after", String(params.after));
    if (params.before != null) search.set("before", String(params.before));
    if (params.page != null) search.set("page", String(params.page));
    search.set("per_page", String(params.perPage ?? 30));

    const res = await authorizedFetch(`/athlete/activities?${search.toString()}`);
    if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`Strava /athlete/activities ${res.status}: ${detail}`);
    }
    const data = (await res.json()) as StravaActivity[];
    return Array.isArray(data) ? data : [];
}
