/**
 * Human-in-the-loop (HITL) — CONTRATO compartilhado (Fase 1, IA do Treinador).
 *
 * Tipos do hand-off de confirmação entre o motor e a UI: quando uma tool de
 * escrita/destrutiva precisa de OK humano, o servidor emite um
 * ToolConfirmationRequest; o card de confirmação (superfícies) devolve um
 * ToolConfirmationResult. Consumido pelo card de confirmação (T1) e pelo
 * handler execute-tool.
 */

/**
 * Pedido de confirmação de uma tool antes de executá-la.
 *
 * - title/summary: texto pronto pra UI (PT-BR; sem montar copy no client).
 * - args: payload exato que será executado se confirmado (eco de transparência).
 * - destructive: true → tratar como ação destrutiva (estilo de alerta/vermelho).
 */
export interface ToolConfirmationRequest {
    toolName: string
    title: string
    summary: string
    args: Record<string, unknown>
    destructive: boolean
}

/** Resultado da decisão humana sobre um ToolConfirmationRequest. */
export interface ToolConfirmationResult {
    confirmed: boolean
}
