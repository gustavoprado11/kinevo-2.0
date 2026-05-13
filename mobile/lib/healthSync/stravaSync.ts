// Fase 16 · Strava sync — função pura sem hooks/React.
// Pode rodar dentro de TaskManager (background) ou disparada manualmente do hook.

import type { SupabaseClient } from "@supabase/supabase-js";

import { getActivities } from "../strava/api";
import { getStoredTokens } from "../strava/oauth";
import { mapStravaActivityToRow } from "../strava/mapping";
import type { StravaActivityType } from "../strava/types";

import { getStudentId } from "./shared";

export interface StravaSyncResult {
    ok: boolean;
    synced: number;
    error?: string;
}

export const ALL_STRAVA_CATEGORIES: StravaActivityType[] = [
    "running",
    "cycling",
    "swimming",
    "hiking",
    "walking",
    "workout",
    "rowing",
    "crossfit",
    "other",
];

async function upsertStravaConnectionStatus(
    supabase: SupabaseClient<any>,
    studentId: string,
    patch: {
        status?: "active" | "revoked" | "error";
        granted_categories?: string[];
        last_error?: string | null;
        external_user_id?: string | null;
    } = {},
): Promise<void> {
    await supabase.from("wearable_connections" as any).upsert(
        {
            student_id: studentId,
            source: "strava",
            status: patch.status ?? "active",
            ...(patch.granted_categories !== undefined
                ? { granted_categories: patch.granted_categories }
                : {}),
            ...(patch.external_user_id !== undefined
                ? { external_user_id: patch.external_user_id }
                : {}),
            last_sync_at: new Date().toISOString(),
            ...(patch.last_error !== undefined ? { last_error: patch.last_error } : {}),
        },
        { onConflict: "student_id,source" },
    );
}

interface StravaSyncOptions {
    // Modo histórico: pega últimas N atividades (limit por perPage).
    perPage?: number;
    // Modo incremental: só atividades depois desse timestamp (unix seconds).
    afterUnixSeconds?: number;
}

async function getGrantedCategories(
    supabase: SupabaseClient<any>,
    studentId: string,
): Promise<Set<string>> {
    const { data } = await supabase
        .from("wearable_connections" as any)
        .select("granted_categories")
        .eq("student_id", studentId)
        .eq("source", "strava")
        .maybeSingle();
    const list = (data as { granted_categories?: string[] } | null)?.granted_categories;
    if (!list || list.length === 0) return new Set(ALL_STRAVA_CATEGORIES);
    return new Set(list);
}

export async function syncStrava(
    supabase: SupabaseClient<any>,
    opts: StravaSyncOptions = {},
): Promise<StravaSyncResult> {
    const studentId = await getStudentId(supabase);
    if (!studentId) return { ok: false, synced: 0, error: "Student not found" };

    const tokens = await getStoredTokens();
    if (!tokens) return { ok: false, synced: 0, error: "Strava not authorized" };

    try {
        const activities = await getActivities({
            perPage: opts.perPage ?? 30,
            after: opts.afterUnixSeconds,
        });

        if (activities.length === 0) {
            await upsertStravaConnectionStatus(supabase, studentId, {
                status: "active",
                last_error: null,
            });
            return { ok: true, synced: 0 };
        }

        const allowed = await getGrantedCategories(supabase, studentId);
        const rows = activities
            .map((a) => mapStravaActivityToRow(a, studentId))
            .filter((row) => allowed.has(row.activity_type));

        if (rows.length === 0) {
            await upsertStravaConnectionStatus(supabase, studentId, {
                status: "active",
                last_error: null,
            });
            return { ok: true, synced: 0 };
        }

        const { error: upsertError } = await supabase
            .from("external_activities" as any)
            .upsert(rows, { onConflict: "source,external_id" });

        if (upsertError) {
            await upsertStravaConnectionStatus(supabase, studentId, {
                status: "error",
                last_error: upsertError.message,
            });
            return { ok: false, synced: 0, error: upsertError.message };
        }

        await upsertStravaConnectionStatus(supabase, studentId, {
            status: "active",
            last_error: null,
        });
        return { ok: true, synced: rows.length };
    } catch (err) {
        const message = err instanceof Error ? err.message : "unknown";
        await upsertStravaConnectionStatus(supabase, studentId, {
            status: "error",
            last_error: message,
        });
        return { ok: false, synced: 0, error: message };
    }
}

export async function syncStravaIncremental(
    supabase: SupabaseClient<any>,
    daysBack = 7,
): Promise<StravaSyncResult> {
    const afterUnixSeconds = Math.floor(
        (Date.now() - daysBack * 24 * 60 * 60 * 1000) / 1000,
    );
    return syncStrava(supabase, { perPage: 100, afterUnixSeconds });
}

export async function syncStravaHistorical(
    supabase: SupabaseClient<any>,
    perPage = 30,
): Promise<StravaSyncResult> {
    return syncStrava(supabase, { perPage });
}

// Helper pra healthSyncTask saber se Strava está conectado (sem precisar tokens).
export async function isStravaConnected(
    supabase: SupabaseClient<any>,
): Promise<boolean> {
    const studentId = await getStudentId(supabase);
    if (!studentId) return false;
    const { data } = await supabase
        .from("wearable_connections" as any)
        .select("status")
        .eq("student_id", studentId)
        .eq("source", "strava")
        .maybeSingle();
    return (data as { status?: string } | null)?.status === "active";
}
