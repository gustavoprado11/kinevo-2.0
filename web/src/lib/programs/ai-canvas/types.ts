// DTOs do turno de build "ao vivo" do canvas (feature: docs/feature-ia-builder-chat.md).
// Shape simples e desacoplado do MOTOR de prescrição (lib/prescription) — o cliente
// adapta RenderedProgram → Workout[] do builder com os MESMOS construtores do builder
// (makeExerciseItem + applyPreset), então métodos/supersets saem idênticos à UI.

import type { MethodKey } from '@kinevo/shared/types/prescription'

export interface CanvasExercise {
    id: string
    name: string
    muscle?: string | null
    equipment?: string | null
}

/** Config de bloco aeróbio emitida pela IA (subset do CardioConfig canônico). */
export interface CanvasCardioDTO {
    mode: 'continuous' | 'interval' | 'phased'
    equipment?: string | null
    objective?: 'time' | 'distance' | null
    duration_minutes?: number | null
    distance_km?: number | null
    intensity?: string | null
    /** Alvo estruturado (zona/RPE) — CardioIntensityTarget do shared. */
    intensity_target?: import('@kinevo/shared/types/workout-items').CardioIntensityTarget | null
    intervals?: { work_seconds: number; rest_seconds: number; rounds: number } | null
    /** Protocolo intervalado nomeado (shared/lib/cardio/interval-protocols). */
    protocol_key?: string | null
    /** Modo 'phased': sequência de fases (CardioSegment do shared), já com
     *  intensidades derivadas — duration_minutes/intensity do bloco viram totais. */
    segments?: import('@kinevo/shared/types/workout-items').CardioSegment[] | null
    notes?: string | null
}

export interface CanvasItemDTO {
    /** Vazio/ausente apenas em itens cardio. */
    exercise_id?: string | null
    sets?: number | null
    reps?: string | null
    rest_seconds?: number | null
    notes?: string | null
    /** Método de série (preset). No save aplica o set_scheme canônico do preset
     *  (igual ao chip de método do builder). null/'standard' = séries retas. */
    method?: MethodKey | null
    /** Tag de agrupamento: itens CONSECUTIVOS com a mesma tag viram um superset. */
    superset_group?: string | null
    /** Quando presente, o item é um BLOCO AERÓBIO (item_type 'cardio') —
     *  exercise_id/sets/reps/method/superset_group são ignorados. */
    cardio?: CanvasCardioDTO | null
}

export interface CanvasSessionDTO {
    name: string
    /** 0=domingo … 6=sábado (mesma convenção do scheduled_days). */
    scheduled_days: number[]
    /** Tipo da sessão (migration 268). Ausente = 'strength'. */
    workout_type?: 'strength' | 'cardio'
    items: CanvasItemDTO[]
}

export interface RenderedProgram {
    name?: string | null
    duration_weeks?: number | null
    sessions: CanvasSessionDTO[]
}

export interface CanvasChatMessage {
    role: 'user' | 'assistant'
    content: string
}

export interface CanvasTurnRequest {
    studentId: string
    message: string
    history?: CanvasChatMessage[]
    /** Catálogo compacto do builder (id+nome+grupo) — a IA busca por aqui (sem hit no banco). */
    exercises: CanvasExercise[]
    /** Snapshot do canvas atual — a IA preserva/ajusta a partir daqui. */
    currentProgram: RenderedProgram
}

export type CanvasStreamEvent =
    | { type: 'progress'; label: string }
    | { type: 'program'; program: RenderedProgram }
    | { type: 'done'; text: string; model: string }
    | { type: 'error'; message: string }
