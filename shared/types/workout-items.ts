// ============================================================================
// Kinevo — Workout Item Types
// ============================================================================
// Types for workout item configuration (warmup, cardio, etc.)
// Matches the item_config JSONB column in workout_item_templates
// and assigned_workout_items (migration 079).
// ============================================================================

/** All possible item_type values */
export type WorkoutItemType = 'exercise' | 'superset' | 'note' | 'warmup' | 'cardio'

/** Session-level type (workout_templates.workout_type / assigned_workouts.workout_type, migration 268) */
export type WorkoutType = 'strength' | 'cardio'

export const WORKOUT_TYPE_LABELS: Record<WorkoutType, string> = {
    strength: 'Força',
    cardio: 'Aeróbio',
}

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

/** Cardio mode. 'phased' = sequência de segmentos (contínuos e/ou blocos
 *  intervalados) — ver CardioSegment. */
export type CardioMode = 'continuous' | 'interval' | 'phased'

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

/** Tipo do alvo de intensidade estruturado (pacote zonas). */
export type CardioIntensityType = 'zone' | 'hr' | 'rpe' | 'pace'

/**
 * Alvo de intensidade estruturado do bloco aeróbio. Quando presente, o campo
 * legado `intensity` (string) passa a ser DERIVADO dele (formatIntensityTarget
 * em shared/lib/cardio/zones) — as superfícies de exibição continuam lendo a
 * string, sem mudança.
 */
export interface CardioIntensityTarget {
    type: CardioIntensityType
    /** type 'zone': Z1–Z5 (resolvida por students.max_heart_rate_bpm). */
    zone?: 1 | 2 | 3 | 4 | 5
    /** type 'hr': faixa absoluta em bpm. */
    hr_min_bpm?: number
    hr_max_bpm?: number
    /** type 'rpe': 1–10. */
    rpe?: number
    /** type 'pace': min/km, ex. "5:30" ou "5:30-6:00". */
    pace_min_per_km?: string
}

/**
 * Um segmento do modo 'phased': fase contínua (steady) OU bloco intervalado.
 * Sequências mistas cobrem os dois casos de uso reais — "séries diferentes"
 * no intervalado (vários blocos com números distintos) e contínuo progressivo
 * (várias fases com intensidades diferentes) — além do misto
 * aquecimento + tiros + desaquecimento.
 */
export interface CardioSegment {
    kind: 'steady' | 'interval'
    /** Rótulo opcional exibido ao aluno ("Aquecimento", "Tiros", "Solto"). */
    label?: string
    /** kind 'steady': duração da fase em minutos. */
    duration_minutes?: number
    /** kind 'interval': estrutura work/rest × rounds do bloco. */
    intervals?: CardioIntervalConfig
    /** Alvo de intensidade DO SEGMENTO (mesma semântica do bloco simples). */
    intensity_target?: CardioIntensityTarget
    /** String derivada do alvo do segmento (exibição). */
    intensity?: string
}

/**
 * Override de UMA semana na progressão semanal do bloco aeróbio.
 * Semântica: o override "vale A PARTIR da semana `week`" — o resolvedor aplica
 * o override de maior `week` ≤ semana corrente do programa (semanas antes do
 * primeiro override usam a config base). Dois sabores:
 *   • SEM `mode` → merge raso sobre a base (só muda km/min/intensidade…).
 *   • COM `mode` → substituição ESTRUTURAL: a estrutura da semana é só a do
 *     override (intervals/segments/objective/… da base são descartados;
 *     equipment e notes são herdados).
 */
export interface CardioWeekOverride {
    /** Semana do programa (1-based) a partir da qual o override vale. */
    week: number
    /** Rótulo da semana exibido ao aluno ("Regenerativa", "Semana da prova"). */
    label?: string
    /** Presente = substituição estrutural completa (ver doc acima). */
    mode?: CardioMode
    objective?: CardioObjective
    duration_minutes?: number
    distance_km?: number
    intensity?: string           // derivada no save, como na base
    intensity_target?: CardioIntensityTarget
    intervals?: CardioIntervalConfig
    protocol_key?: string
    segments?: CardioSegment[]
    notes?: string
}

/** Cardio item configuration */
export interface CardioConfig {
    mode: CardioMode
    equipment?: CardioEquipment
    // Continuous mode
    objective?: CardioObjective
    /** Contínuo: alvo de duração. Em 'phased' vira DERIVADO (total estimado)
     *  — mantém contador/superfícies/apps antigos funcionando. */
    duration_minutes?: number
    distance_km?: number
    intensity?: string           // free-text OU derivada de intensity_target/segments
    /** Alvo estruturado (zonas/FC/RPE/pace) — ver CardioIntensityTarget. */
    intensity_target?: CardioIntensityTarget
    // Interval mode
    intervals?: CardioIntervalConfig
    /** Protocolo nomeado (shared/lib/cardio/interval-protocols); editar os
     *  números manualmente limpa o selo. */
    protocol_key?: string
    /** Modo 'phased': a sequência de segmentos. */
    segments?: CardioSegment[]
    /**
     * Progressão semanal: overrides por semana do programa (ordenados por
     * `week`, únicos). Os campos base do config continuam sendo a "semana 1"
     * (retrocompat: superfícies antigas e o Watch leem só a base). Resolução
     * em shared/lib/cardio/progression.ts.
     */
    progression?: CardioWeekOverride[]
    notes?: string
}

/** Union of all possible item_config shapes */
export type ItemConfig = WarmupConfig | CardioConfig | Record<string, never>
