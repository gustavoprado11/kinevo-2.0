// Fase 16 · Strava activity → external_activities row
// Pura, sem side effects. Idempotente: mesmo payload sempre vira mesma row.

import type { Database } from "@kinevo/shared";

import { STRAVA_TYPE_MAP, type StravaActivity, type StravaActivityType } from "./types";

type ExternalActivityInsert =
    Database["public"]["Tables"]["external_activities"]["Insert"];

export function mapStravaTypeToActivityType(
    stravaType: string | undefined,
): StravaActivityType {
    if (!stravaType) return "other";
    return STRAVA_TYPE_MAP[stravaType] ?? "other";
}

export function mapStravaActivityToRow(
    activity: StravaActivity,
    studentId: string,
): ExternalActivityInsert {
    const type = activity.sport_type ?? activity.type;
    return {
        student_id: studentId,
        source: "strava",
        external_id: String(activity.id),
        activity_type: mapStravaTypeToActivityType(type),
        name: activity.name?.trim() || "Atividade",
        distance_meters: activity.distance ?? null,
        // Strava: prefer moving_time (descansos descontados). Fallback elapsed.
        duration_seconds: Math.max(
            0,
            Math.round(activity.moving_time ?? activity.elapsed_time ?? 0),
        ),
        calories: activity.calories ?? null,
        avg_heart_rate:
            activity.has_heartrate && activity.average_heartrate != null
                ? Math.round(activity.average_heartrate)
                : null,
        max_heart_rate:
            activity.has_heartrate && activity.max_heartrate != null
                ? Math.round(activity.max_heartrate)
                : null,
        elevation_gain_meters: activity.total_elevation_gain ?? null,
        started_at: activity.start_date,
        raw: activity as unknown as ExternalActivityInsert["raw"],
    };
}
