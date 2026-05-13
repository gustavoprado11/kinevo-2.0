// Fase 16 · Strava types
// Subset dos campos que o app consome. Strava retorna muito mais — guardamos
// o payload completo em `external_activities.raw` pra features futuras.

export type StravaActivityType =
    | "running"
    | "cycling"
    | "swimming"
    | "hiking"
    | "walking"
    | "workout"
    | "rowing"
    | "crossfit"
    | "other";

// Mapeamento Strava `sport_type` / `type` → categoria interna Kinevo.
// Strava tem 40+ tipos; agrupamos pra simplificar UI e filtros.
export const STRAVA_TYPE_MAP: Record<string, StravaActivityType> = {
    Run: "running",
    TrailRun: "running",
    VirtualRun: "running",
    Ride: "cycling",
    MountainBikeRide: "cycling",
    GravelRide: "cycling",
    EBikeRide: "cycling",
    EMountainBikeRide: "cycling",
    VirtualRide: "cycling",
    Swim: "swimming",
    Hike: "hiking",
    Walk: "walking",
    WeightTraining: "workout",
    Workout: "workout",
    Rowing: "rowing",
    Crossfit: "crossfit",
};

export interface StravaTokenPayload {
    access_token: string;
    refresh_token: string;
    expires_at: number; // unix seconds
    expires_in: number;
    athlete?: {
        id: number;
        firstname?: string;
        lastname?: string;
    };
}

export interface StravaActivity {
    id: number;
    name: string;
    type: string;
    sport_type?: string;
    distance: number; // meters
    moving_time: number; // seconds
    elapsed_time: number;
    total_elevation_gain: number;
    start_date: string; // ISO
    start_date_local: string;
    average_heartrate?: number;
    max_heartrate?: number;
    calories?: number;
    has_heartrate?: boolean;
}
