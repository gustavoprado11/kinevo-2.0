/**
 * Rate-limits do Assistente (Guardrail G6 — Fase B).
 *
 * Reusa o limitador DURÁVEL e atômico (`consumeRateLimit`, migration 195) — sem
 * infra nova. Centraliza os limites em um lugar para ficarem fáceis de ajustar e
 * consistentes entre os caminhos.
 *
 * Duas chaves distintas (janelas independentes):
 *   - TURNO:   todo turno de IA (⌘K, aba workspace). Anti-amplificação de custo.
 *   - SENSÍVEL: ações confirmadas no /execute-tool (pagar, cancelar, excluir...).
 *     Limite mais apertado — anti-loop / anti-engano em sequência.
 *
 * Janelas suportadas pelo backend: por minuto e por dia. (Aproxima "por hora".)
 * Fail-open: se o backend hiccupar, `consumeRateLimit` libera (o endpoint já tem auth).
 */

import { consumeRateLimit } from '@/lib/rate-limit'

/** Turno de IA por treinador. Alinhado ao chat streaming (15/min, 300/dia). */
export const TURN_LIMIT = { perMinute: 15, perDay: 300 } as const

/** Ações sensíveis confirmadas (HITL) por treinador — mais apertado. */
export const SENSITIVE_LIMIT = { perMinute: 8, perDay: 120 } as const

export type LimitResult = { allowed: boolean; error?: string }

/** Limita turnos de IA (⌘K / workspace). */
export function limitTurn(trainerId: string): Promise<LimitResult> {
    return consumeRateLimit(`assistant:turn:${trainerId}`, TURN_LIMIT)
}

/** Limita ações sensíveis confirmadas (execute-tool). */
export function limitSensitive(trainerId: string): Promise<LimitResult> {
    return consumeRateLimit(`assistant:sensitive:${trainerId}`, SENSITIVE_LIMIT)
}
