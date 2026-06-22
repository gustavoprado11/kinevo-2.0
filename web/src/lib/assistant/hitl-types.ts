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
    /**
     * Chave de idempotência (C6): o card a devolve ao execute-tool, que dedup
     * re-cliques/retries da MESMA confirmação (anti contrato/pagamento duplicado).
     */
    idempotencyKey?: string
}

/** Resultado da decisão humana sobre um ToolConfirmationRequest. */
export interface ToolConfirmationResult {
    confirmed: boolean
}

/**
 * Pergunta estruturada ao treinador ("Ask the user"): quando falta informação
 * para agir, o motor emite isto e a UI mostra as opções como botões clicáveis.
 *
 * - options: 2 a 6 rótulos curtos.
 * - multiple: true → o treinador pode marcar várias antes de enviar.
 * - allowOther: true → oferecer um caminho de texto livre ("Outro…").
 */
export interface QuestionRequest {
    question: string
    options: string[]
    multiple: boolean
    allowOther: boolean
}

/** Item de uma proposta: um par rótulo + valor (o valor é editável na UI). */
export interface ProposalItem {
    label: string
    value: string
}

/**
 * Proposta estruturada para o treinador APROVAR/AJUSTAR/CANCELAR (ex.: a estrutura
 * de um programa antes de criar). A UI mostra cada item com o valor editável inline;
 * "Aprovar" devolve os valores finais (já com os ajustes do treinador).
 */
export interface ProposalRequest {
    items: ProposalItem[]
    approveLabel: string
}
