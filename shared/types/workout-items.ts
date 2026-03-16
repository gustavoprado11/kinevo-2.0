// ============================================================================
// Kinevo — Workout Item Types
// ============================================================================
// Types for workout item configuration (warmup, cardio, etc.)
// Matches the item_config JSONB column in workout_item_templates
// and assigned_workout_items (migration 079).
// ============================================================================

/** All possible item_type values */
export type WorkoutItemType = 'exercise' | 'superset' | 'note' | 'warmup' | 'cardio'

/** Warmup type options */
export type WarmupType = 'free' | 'light_cardio' | 'mobility' | 'activation'

export const WARMUP_TYPE_LABELS: Record<WarmupType, string> = {
    free: 'Livre',
    light_cardio: 'Cardio leve',
    mobility: 'Mobilidade',
    activation: 'Ativação',
}

export const WARMUP_TYPE_OPTIONS: readonly WarmupType[] = [
    'free', 'light_cardio', 'mobility', 'activation',
] as const

/** Cardio equipment options */
export type CardioEquipment =
    | 'treadmill'
    | 'bike'
    | 'elliptical'
    | 'rower'
    | 'stairmaster'
    | 'jump_rope'
    | 'outdoor_run'
    | 'outdoor_bike'
    | 'swimming'
    | 'other'

export const CARDIO_EQUIPMENT_LABELS: Record<CardioEquipment, string> = {
    treadmill: 'Esteira',
    bike: 'Bicicleta',
    elliptical: 'Elíptico',
    rower: 'Remo',
    stairmaster: 'Escada',
    jump_rope: 'Corda',
    outdoor_run: 'Corrida Outdoor',
    outdoor_bike: 'Bike Outdoor',
    swimming: 'Natação',
    other: 'Outro',
}

export const CARDIO_EQUIPMENT_OPTIONS: readonly CardioEquipment[] = [
    'treadmill', 'bike', 'elliptical', 'rower', 'stairmaster',
    'jump_rope', 'outdoor_run', 'outdoor_bike', 'swimming', 'other',
] as const

/** Cardio mode */
export type CardioMode = 'continuous' | 'interval'

/** Cardio objective (continuous mode) */
export type CardioObjective = 'time' | 'distance'

export const CARDIO_OBJECTIVE_LABELS: Record<CardioObjective, string> = {
    time: 'Tempo',
    distance: 'Distância',
}

/** Warmup item configuration */
export interface WarmupConfig {
    warmup_type: WarmupType
    description?: string
    duration_minutes?: number
}

/** Interval protocol for cardio */
export interface CardioIntervalConfig {
    work_seconds: number
    rest_seconds: number
    rounds: number
}

/** Cardio item configuration */
export interface CardioConfig {
    mode: CardioMode
    equipment?: CardioEquipment
    // Continuous mode
    objective?: CardioObjective
    duration_minutes?: number
    distance_km?: number
    intensity?: string           // free-text (e.g. "Zona 2", "RPE 6", "130bpm")
    // Interval mode
    intervals?: CardioIntervalConfig
    notes?: string
}

/** Union of all possible item_config shapes */
export type ItemConfig = WarmupConfig | CardioConfig | Record<string, never>
