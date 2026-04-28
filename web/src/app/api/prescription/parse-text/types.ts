import type { WorkoutSet, MethodKey } from '@kinevo/shared/types/prescription'

export interface ParsedExercise {
    matched: boolean
    exercise_id: string | null
    catalog_name: string | null
    original_text: string
    sets: number
    reps: string
    rest_seconds: number | null
    notes: string | null
    superset_group: string | null
    /** Fase 5 — método avançado detectado pelo parser. `null` quando o texto
     *  descreve apenas séries lineares simples. */
    method_key: MethodKey | null
    /** Fase 5 — esquema per-set, descreve UMA rondada. Quando preenchido,
     *  `sets` agregado = `set_scheme.length * rounds`. */
    set_scheme: WorkoutSet[] | null
    /** Fase 5 — número de rondadas para métodos compostos (drop-set, cluster).
     *  1 para métodos lineares (pirâmide, top+backoff, 5x5). */
    rounds: number | null
}

export interface ParsedWorkout {
    name: string
    exercises: ParsedExercise[]
}

export interface ParseTextResponse {
    workouts: ParsedWorkout[]
}

export interface ParseTextRequest {
    text: string
    exercises: { id: string; name: string }[]
}
