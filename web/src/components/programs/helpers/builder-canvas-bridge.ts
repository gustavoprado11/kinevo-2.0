'use client'

// ── Ponte do canvas do builder (Fase 1 da feature "Gerar com IA ao vivo") ──
// Singleton de módulo que expõe a API de mutação do builder de programas para
// superfícies irmãs — em especial o chat "Gerar com IA", que monta e ajusta o
// programa direto no canvas em tempo real. O builder (via useWorkoutModel)
// registra esta API no mount e a remove no unmount; só um builder fica montado
// por vez, então o singleton é seguro.
//
// Decisão: ponte ADITIVA em vez de mover a posse do estado pro Zustand — o
// builder continua dono do estado (useState) e aqui só publicamos os mesmos
// mutadores (funções puras de builder-model) pra quem precisar escrever no
// canvas. Reversível e sem mudança de comportamento do builder.

import type { Workout, WorkoutItem } from '../builder-model'

export interface CanvasApi {
    /** Snapshot ao vivo dos workouts no canvas (lê o estado mais recente). */
    getWorkouts: () => Workout[]
    /** Workout ativo no momento (aba selecionada no builder). */
    getActiveWorkoutId: () => string | null
    /** Seleciona a aba de workout ativa. */
    setActiveWorkout: (id: string | null) => void
    /** Escotilha genérica: aplica um transform puro sobre os workouts. */
    apply: (mutator: (prev: Workout[]) => Workout[]) => void
    /** Cria um workout (Treino) com nome e dias; retorna o id criado. */
    createWorkoutWithName: (name: string, frequency?: string[]) => string
    updateWorkoutName: (workoutId: string, name: string) => void
    updateWorkoutFrequency: (workoutId: string, days: string[]) => void
    deleteWorkout: (workoutId: string) => void
    /** Acrescenta itens construídos por uma factory que enxerga o workout. */
    appendItemsWith: (workoutId: string, makeItems: (w: Workout) => WorkoutItem[]) => void
    updateItem: (workoutId: string, itemId: string, updates: Partial<WorkoutItem>) => void
    deleteItem: (workoutId: string, itemId: string) => void
}

let current: CanvasApi | null = null
let version = 0
const listeners = new Set<() => void>()

function emit(): void {
    version += 1
    for (const l of listeners) l()
}

export function registerCanvasApi(api: CanvasApi): void {
    current = api
    emit()
}

export function unregisterCanvasApi(): void {
    current = null
    emit()
}

/** API do canvas do builder atualmente montado, ou null se nenhum. */
export function getCanvasApi(): CanvasApi | null {
    return current
}

/** Há um builder montado pronto pra receber escrita do chat? */
export function isCanvasReady(): boolean {
    return current !== null
}

/** Assina disponibilidade do canvas (registro/desregistro). P/ useSyncExternalStore. */
export function subscribeCanvas(listener: () => void): () => void {
    listeners.add(listener)
    return () => {
        listeners.delete(listener)
    }
}

/** Versão monotônica; muda a cada registro/desregistro. Snapshot p/ useSyncExternalStore. */
export function getCanvasVersion(): number {
    return version
}
