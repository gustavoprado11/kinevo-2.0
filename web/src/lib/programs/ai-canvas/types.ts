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

export interface CanvasItemDTO {
    exercise_id: string
    sets?: number | null
    reps?: string | null
    rest_seconds?: number | null
    notes?: string | null
    /** Método de série (preset). No save aplica o set_scheme canônico do preset
     *  (igual ao chip de método do builder). null/'standard' = séries retas. */
    method?: MethodKey | null
    /** Tag de agrupamento: itens CONSECUTIVOS com a mesma tag viram um superset. */
    superset_group?: string | null
}

export interface CanvasSessionDTO {
    name: string
    /** 0=domingo … 6=sábado (mesma convenção do scheduled_days). */
    scheduled_days: number[]
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
