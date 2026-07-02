/**
 * Writer do trace por turno (tabela assistant_turn_traces — migr 211).
 *
 * Best-effort: NUNCA lança. Um trace que falha jamais pode derrubar a resposta do
 * assistente (mesma filosofia do metering em onFinish). É chamado em 2 pontos:
 *   - command-engine.runAssistantTurn   → kind 'turn' (⌘K / workspace / dock / voz / proativo)
 *   - api/assistant/execute-tool         → kind 'confirmed_action' (ação sensível confirmada)
 *
 * A tabela é nova e ainda não está nos tipos gerados (Database), por isso o `admin`
 * é tipado como SupabaseClient genérico — evita ter que regenerar os tipos agora.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { AiSurface } from '@/lib/ai-usage/metering'

export type TraceKind = 'turn' | 'confirmed_action'

export interface TraceToolCall {
    toolName: string
    args?: Record<string, unknown>
    /** true se a tool retornou sucesso (default true). */
    ok?: boolean
}

export interface TraceConfirmation {
    toolName: string
    destructive?: boolean
}

export interface TurnTraceInput {
    trainerId: string
    studentId?: string | null
    kind?: TraceKind
    surface?: AiSurface | null
    route?: string | null
    promptVersion?: string | null
    model?: string | null
    input?: string
    output?: string
    tools?: TraceToolCall[]
    confirmation?: TraceConfirmation | null
    intents?: string[]
    credits?: number
    inputTokens?: number | null
    outputTokens?: number | null
    costMicros?: number | null
}

/** Limite de texto persistido (input/output) — evita linhas gigantes. */
const MAX_TEXT = 8000

function clampText(s: string | undefined): string {
    if (!s) return ''
    return s.length > MAX_TEXT ? s.slice(0, MAX_TEXT) : s
}

/**
 * Deriva `ok` de um resultado de tool. Cobre os dois envelopes que circulam:
 *   - MCP (CallToolResult): `mcpError()` seta `isError:true` e empacota
 *     `{"error":"…"}` no content textual — esta é a fonte da verdade do caminho MCP;
 *   - tools próprias do chat streaming: objeto com `{error}` / `{success:false}`.
 * Defensivo: se o transporte não preservar `isError`, ainda detecta o payload de
 * erro do `mcpError` varrendo o content. Errar p/ "falhou" é o lado seguro do
 * billing (auditoria 2026-06-22, C2: tool que falha NÃO pode ser cobrada).
 */
export function toolResultOk(result: unknown): boolean {
    if (!result || typeof result !== 'object') return true
    const r = result as {
        error?: unknown
        success?: unknown
        isError?: unknown
        content?: unknown
    }
    if (r.isError === true) return false
    if (r.error !== undefined && r.error !== null) return false
    if (r.success === false) return false
    if (Array.isArray(r.content)) {
        for (const part of r.content) {
            const text = (part as { text?: unknown })?.text
            if (typeof text !== 'string') continue
            try {
                const parsed = JSON.parse(text) as { error?: unknown }
                if (typeof parsed?.error === 'string' && parsed.error.length > 0) return false
            } catch {
                // content não-JSON: ignora
            }
        }
    }
    return true
}

/**
 * Extrai a mensagem de erro de um resultado MCP que falhou (`mcpError()` empacota
 * `{"error":"…"}` no content textual). Também cobre `{error}` de topo. Retorna
 * null se não houver mensagem legível — o caller usa um fallback amigável.
 */
export function mcpErrorMessage(result: unknown): string | null {
    if (!result || typeof result !== 'object') return null
    const r = result as { error?: unknown; content?: unknown }
    if (typeof r.error === 'string' && r.error.length > 0) return r.error
    if (Array.isArray(r.content)) {
        for (const part of r.content) {
            const text = (part as { text?: unknown })?.text
            if (typeof text !== 'string') continue
            try {
                const parsed = JSON.parse(text) as { error?: unknown }
                if (typeof parsed?.error === 'string' && parsed.error.length > 0) return parsed.error
            } catch {
                // content não-JSON: ignora
            }
        }
    }
    return null
}

/**
 * Grava um trace de turno. Best-effort — engole qualquer erro (loga e segue).
 */
export async function recordTurnTrace(
    admin: SupabaseClient,
    t: TurnTraceInput,
): Promise<void> {
    try {
        const row = {
            trainer_id: t.trainerId,
            student_id: t.studentId ?? null,
            kind: t.kind ?? 'turn',
            surface: t.surface ?? null,
            route: t.route ?? null,
            prompt_version: t.promptVersion ?? null,
            model: t.model ?? null,
            input: clampText(t.input),
            output: clampText(t.output),
            tools: (t.tools ?? []).map((c) => ({
                toolName: c.toolName,
                args: c.args ?? {},
                ok: c.ok ?? true,
            })),
            confirmation: t.confirmation ?? null,
            intents: t.intents ?? [],
            credits: t.credits ?? 0,
            input_tokens: t.inputTokens ?? null,
            output_tokens: t.outputTokens ?? null,
            cost_usd_micros: t.costMicros ?? null,
        }
        const { error } = await admin.from('assistant_turn_traces').insert(row)
        if (error) console.error('[recordTurnTrace] insert error (best-effort):', error.message)
    } catch (e) {
        console.error('[recordTurnTrace] unexpected error (best-effort):', e)
    }
}
