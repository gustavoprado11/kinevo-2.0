/**
 * Redação de campos sensíveis ANTES de persistir resultados de tools (auditoria
 * 2026-06-22, S6/L2).
 *
 * Alguns resultados de ação carregam segredo — o caso crítico é
 * `kinevo_convert_lead`, que devolve `credentials` (senha em texto puro do aluno
 * recém-criado). Esse resultado é mostrado UMA vez ao treinador na resposta da
 * ação (transitório), mas NUNCA deve ficar gravado em texto puro no histórico
 * (`ai_messages.parts`) nem em traces. Aqui fazemos um deep-clone trocando os
 * valores das chaves sensíveis por um marcador, preservando o resto da estrutura.
 */

/** Chaves cujo VALOR é redigido (comparação case-insensitive). */
const SENSITIVE_KEYS: ReadonlySet<string> = new Set([
    'credentials',
    'password',
    'senha',
    'secret',
    'token',
    'access_token',
    'refresh_token',
    'api_key',
    'apikey',
])

export const REDACTED = '[redigido]'

const MAX_DEPTH = 8

/**
 * Deep-clone de `value` redigindo o valor de qualquer chave sensível (em qualquer
 * profundidade). Não-objetos passam intactos. Guard de profundidade evita estouro
 * em estruturas cíclicas/profundas.
 */
export function redactSensitive(value: unknown, depth = 0): unknown {
    if (depth >= MAX_DEPTH || value === null || typeof value !== 'object') return value
    if (Array.isArray(value)) return value.map((v) => redactSensitive(v, depth + 1))
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        out[k] = SENSITIVE_KEYS.has(k.toLowerCase()) ? REDACTED : redactSensitive(v, depth + 1)
    }
    return out
}
