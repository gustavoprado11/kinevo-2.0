/**
 * Memória de tools entre turnos (Onda 2 — 2026-07-01).
 *
 * Problema: o histórico enviado ao modelo era só {role, content} — os RESULTADOS
 * das tools (IDs de programa, itens, agendamentos) sumiam entre turnos. Um
 * follow-up ("agora troca o supino por crucifixo") obrigava o modelo a reler
 * tudo (get_program de novo) e ainda assim errava quando o subset do turno não
 * tinha a tool de leitura.
 *
 * Solução em 3 peças:
 *   - `digestToolResult`: comprime um tool-result num digest curto com os UUIDs
 *     reais (projeção dedicada p/ programas; compactação genérica p/ o resto).
 *   - parts `{type:'context'}`: leituras que valem memória (MEMORY_READ_TOOLS)
 *     são persistidas como digest junto da mensagem do assistente. São INTERNAS:
 *     `stripInternalParts` as remove de TODA resposta ao cliente (web e mobile)
 *     — vivem só no DB e no prompt.
 *   - `toModelHistory`: reconstrói o histórico p/ o modelo anexando às mensagens
 *     do assistente um bloco <<DADOS_DE_TOOLS>> com os digests daquele turno
 *     (executadas + memórias + desfechos de confirmação), com orçamento de
 *     caracteres alocado do turno mais recente para trás.
 *
 * Segurança: digests derivam de resultados já redigidos (redactSensitive) e o
 * bloco é declarado no prompt como DADO não-confiável (mesma política do
 * <<DADOS_DO_ALUNO>>), nunca instrução.
 */

import type { AssistantMessage, AssistantMessagePart } from '@/lib/assistant/conversations'

// ── Envelope MCP ─────────────────────────────────────────────────────────────

/** Desempacota `{content:[{text:'<json>'}]}` (mcpSuccess). Defensivo: se já vier
 *  desempacotado, usa direto. */
function parseMcpPayload(result: unknown): Record<string, unknown> | null {
    if (!result || typeof result !== 'object') return null
    const content = (result as { content?: Array<{ text?: string }> }).content
    if (Array.isArray(content) && typeof content[0]?.text === 'string') {
        try {
            return JSON.parse(content[0].text) as Record<string, unknown>
        } catch {
            return null
        }
    }
    return result as Record<string, unknown>
}

// ── Compactação genérica ─────────────────────────────────────────────────────

const MAX_STRING = 60
const MAX_ARRAY = 12
const MAX_KEYS = 20
const MAX_DEPTH = 5
const DEFAULT_CAP = 600

function compactValue(v: unknown, depth: number): unknown {
    if (v === null || v === undefined) return undefined
    if (typeof v === 'string') return v.length > MAX_STRING ? v.slice(0, MAX_STRING) + '…' : v
    if (typeof v === 'number' || typeof v === 'boolean') return v
    if (depth >= MAX_DEPTH) return undefined
    if (Array.isArray(v)) {
        const out = v
            .slice(0, MAX_ARRAY)
            .map((x) => compactValue(x, depth + 1))
            .filter((x) => x !== undefined)
        if (v.length > MAX_ARRAY) out.push(`+${v.length - MAX_ARRAY} itens`)
        return out
    }
    if (typeof v === 'object') {
        const out: Record<string, unknown> = {}
        let n = 0
        for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
            if (n >= MAX_KEYS) break
            const c = compactValue(val, depth + 1)
            if (c === undefined) continue
            out[k] = c
            n++
        }
        return out
    }
    return undefined
}

// ── Projeção dedicada: programas (o follow-up mais valioso) ──────────────────

interface ProgramItemShape {
    id?: string
    item_type?: string
    sets?: number | null
    reps?: string | number | null
    exercise?: { id?: string; name?: string } | null
    children?: ProgramItemShape[]
}
interface ProgramWorkoutShape {
    id?: string
    name?: string
    scheduled_days?: number[]
    items?: ProgramItemShape[]
}
interface ProgramShape {
    id?: string
    name?: string
    status?: string
    student?: { id?: string; name?: string } | null
    workouts?: ProgramWorkoutShape[]
}

/** Digest legível de um payload com `program` — mantém TODOS os UUIDs (programa,
 *  sessões, itens): são eles que permitem editar sem reler. */
function digestProgram(payload: Record<string, unknown>): string | null {
    const prog = payload.program as ProgramShape | undefined
    if (!prog || typeof prog.id !== 'string') return null
    const student = prog.student
    const studentBits = student?.id
        ? `, aluno=${student.name ?? '?'} student_id=${student.id}`
        : typeof payload.student_id === 'string'
          ? `, student_id=${payload.student_id}`
          : ''
    const head = `programa "${prog.name ?? '?'}" program_id=${prog.id}${prog.status ? `, status=${prog.status}` : ''}${studentBits}`
    const workouts = Array.isArray(prog.workouts) ? prog.workouts : []
    const lines = workouts.map((w) => {
        const roots = Array.isArray(w.items) ? w.items : []
        const flat = roots.flatMap((it) => [it, ...(Array.isArray(it.children) ? it.children : [])])
        const itemsStr = flat
            .map((it) => {
                const label = it.exercise?.name ?? it.item_type ?? '?'
                const dose = it.sets ? ` ${it.sets}x${it.reps ?? '?'}` : ''
                return `${label}${dose} [item_id=${it.id ?? '?'}]`
            })
            .join('; ')
        return `  • sessão "${w.name ?? '?'}" [workout_id=${w.id ?? '?'}] dias=${JSON.stringify(w.scheduled_days ?? [])}: ${itemsStr}`
    })
    return [head, ...lines].join('\n')
}

const PROGRAM_PAYLOAD_TOOLS: ReadonlySet<string> = new Set([
    'kinevo_get_program',
    'kinevo_create_student_draft_program',
    'kinevo_create_program_template',
])

// ── Digest por tool ──────────────────────────────────────────────────────────

/**
 * Digest compacto de um tool-result. `null` = nada que valha memória (erro,
 * payload vazio, formato desconhecido).
 */
export function digestToolResult(toolName: string, result: unknown, cap = DEFAULT_CAP): string | null {
    const payload = parseMcpPayload(result)
    if (!payload) return null
    if (typeof payload.error === 'string' && payload.error.length > 0) return null
    if (PROGRAM_PAYLOAD_TOOLS.has(toolName)) {
        // Sem cap: os UUIDs não podem truncar — a projeção já é enxuta.
        const prog = digestProgram(payload)
        if (prog) return prog
    }
    let s: string
    try {
        s = JSON.stringify(compactValue(payload, 0)) ?? ''
    } catch {
        return null
    }
    if (!s || s === '{}' || s === '[]') return null
    return s.length > cap ? s.slice(0, cap) + '…' : s
}

/**
 * Leituras que valem memória entre turnos (viram part `context`). Critério:
 * o resultado carrega IDs que um follow-up de EDIÇÃO precisa (reagendar,
 * atualizar plano, reenviar formulário…). Writes não precisam estar aqui —
 * seus resultados já são persistidos nas parts `executed`.
 */
export const MEMORY_READ_TOOLS: ReadonlySet<string> = new Set([
    'kinevo_get_program',
    'kinevo_list_programs',
    'kinevo_list_appointments',
    'kinevo_get_assessments',
    'kinevo_list_plans',
    'kinevo_list_form_templates',
    'kinevo_list_leads',
])

// ── Histórico p/ o modelo ────────────────────────────────────────────────────

export interface ModelHistoryMessage {
    role: 'user' | 'assistant'
    content: string
}

const HISTORY_MAX_MESSAGES = 20
const DIGEST_BUDGET_CHARS = 2400

/**
 * Converte as mensagens persistidas no histórico enviado ao modelo, anexando às
 * mensagens do assistente o bloco <<DADOS_DE_TOOLS>> com os digests do turno.
 * O orçamento é alocado do turno MAIS RECENTE para trás — conversas longas
 * perdem a memória dos turnos antigos primeiro, nunca dos últimos.
 */
export function toModelHistory(
    messages: AssistantMessage[],
    opts: { maxMessages?: number; digestBudget?: number } = {},
): ModelHistoryMessage[] {
    const recent = messages.slice(-(opts.maxMessages ?? HISTORY_MAX_MESSAGES))
    let budget = opts.digestBudget ?? DIGEST_BUDGET_CHARS

    const blocks = new Map<number, string>()
    for (let i = recent.length - 1; i >= 0; i--) {
        if (budget <= 0) break
        const m = recent[i]
        if (m.role !== 'assistant' || m.parts.length === 0) continue
        const lines: string[] = []
        for (const p of m.parts) {
            if (p.type === 'context') {
                lines.push(`- ${p.toolName}: ${p.digest}`)
            } else if (p.type === 'executed') {
                const d = digestToolResult(p.toolName, p.result)
                lines.push(d ? `- ${p.toolName} (executada): ${d}` : `- ${p.toolName} (executada)`)
            } else if (p.type === 'confirmation' && p.status !== 'pending') {
                const d = p.status === 'confirmed' ? digestToolResult(p.request.toolName, p.result) : null
                lines.push(
                    `- ${p.request.toolName} (${p.status === 'confirmed' ? 'confirmada e executada' : 'cancelada pelo treinador'})${d ? `: ${d}` : ''}`,
                )
            }
        }
        if (lines.length === 0) continue
        const block = `\n\n<<DADOS_DE_TOOLS>>\n${lines.join('\n')}\n<<FIM_DADOS_DE_TOOLS>>`
        if (block.length <= budget) {
            blocks.set(i, block)
            budget -= block.length
        }
    }

    return recent.map((m, i) => ({ role: m.role, content: m.content + (blocks.get(i) ?? '') }))
}

// ── Histórico NATIVO (P2 — 13/jul) ───────────────────────────────────────────
//
// O achatamento em texto (<<DADOS_DE_TOOLS>>) era o maior gap do assistente
// contra o MCP externo: o modelo não via as PRÓPRIAS tool-calls em formato
// nativo e relia/errava IDs em follow-ups. Aqui as últimas mensagens do
// assistente viram pares nativos (assistant com tool-call + tool com
// tool-result), reconstruídos das parts persistidas (`executed` com args,
// `confirmation` confirmada). O que não vira nativo continua como digest:
//   - LEITURAS (parts `context`) — só o digest é persistido, por peso/LGPD;
//   - mensagens fora da janela nativa (orçamento) — degradam pro bloco texto.
// Question/proposal pendentes NUNCA viram tool-call (call sem result quebra
// providers); a resposta do treinador já está no turno de texto seguinte.

const NATIVE_WINDOW_MESSAGES = 4
const NATIVE_RESULT_CAP = 2000
const NATIVE_TOTAL_BUDGET = 12000

export type NativeModelMessage =
    | { role: 'user' | 'system'; content: string }
    | {
          role: 'assistant'
          content:
              | string
              | Array<
                    | { type: 'text'; text: string }
                    | { type: 'tool-call'; toolCallId: string; toolName: string; input: unknown }
                >
      }
    | {
          role: 'tool'
          content: Array<{
              type: 'tool-result'
              toolCallId: string
              toolName: string
              output: { type: 'json'; value: unknown } | { type: 'text'; value: string }
          }>
      }

interface NativeCall {
    toolCallId: string
    toolName: string
    input: unknown
    output: { type: 'json'; value: unknown } | { type: 'text'; value: string }
    chars: number
}

/** Output nativo de um tool-result: projeção dedicada p/ programas (IDs
 *  completos, compacta) ou JSON compactado com teto — nunca o payload cru. */
function nativeOutputFor(
    toolName: string,
    result: unknown,
): { output: NativeCall['output']; chars: number } | null {
    const payload = parseMcpPayload(result)
    if (!payload) return null
    if (PROGRAM_PAYLOAD_TOOLS.has(toolName)) {
        const prog = digestProgram(payload)
        if (prog) return { output: { type: 'text', value: prog }, chars: prog.length }
    }
    try {
        const s = JSON.stringify(compactValue(payload, 0)) ?? ''
        if (!s) return null
        if (s.length > NATIVE_RESULT_CAP) {
            const cut = s.slice(0, NATIVE_RESULT_CAP) + '…(truncado)'
            return { output: { type: 'text', value: cut }, chars: cut.length }
        }
        return { output: { type: 'json', value: JSON.parse(s) }, chars: s.length }
    } catch {
        return null
    }
}

/**
 * Converte as mensagens persistidas em ModelMessage[] com tool-calls NATIVOS
 * nas últimas mensagens do assistente. Substitui toModelHistory nos turnos da
 * aba e do mobile (o achatado permanece p/ compat/testes).
 */
export function toNativeModelHistory(
    messages: AssistantMessage[],
    opts: { maxMessages?: number; digestBudget?: number; nativeWindow?: number } = {},
): NativeModelMessage[] {
    const recent = messages.slice(-(opts.maxMessages ?? HISTORY_MAX_MESSAGES))
    const nativeWindow = opts.nativeWindow ?? NATIVE_WINDOW_MESSAGES

    // 1. Escolhe as mensagens NATIVAS: as últimas N do assistente com parts
    //    aproveitáveis, respeitando o orçamento total (mais recente primeiro).
    const nativeCalls = new Map<number, NativeCall[]>()
    let nativeBudget = NATIVE_TOTAL_BUDGET
    let picked = 0
    for (let i = recent.length - 1; i >= 0 && picked < nativeWindow; i--) {
        const m = recent[i]
        if (m.role !== 'assistant' || m.parts.length === 0) continue
        const calls: NativeCall[] = []
        let chars = 0
        for (let j = 0; j < m.parts.length; j++) {
            const p = m.parts[j]
            let toolName: string | null = null
            let input: unknown
            let result: unknown
            if (p.type === 'executed') {
                toolName = p.toolName
                input = p.args ?? {}
                result = p.result
            } else if (p.type === 'confirmation' && p.status === 'confirmed') {
                toolName = p.request.toolName
                input = p.request.args
                result = p.result
            }
            if (!toolName) continue
            const out = nativeOutputFor(toolName, result)
            if (!out) continue
            calls.push({
                toolCallId: `hist_${i}_${j}`,
                toolName,
                input,
                output: out.output,
                chars: out.chars,
            })
            chars += out.chars
        }
        if (calls.length === 0) continue
        if (chars > nativeBudget) break // sem orçamento → esta e as anteriores ficam no digest
        nativeBudget -= chars
        nativeCalls.set(i, calls)
        picked++
    }

    // 2. Blocos de digest: leituras (`context`) e cancelamentos SEMPRE em texto;
    //    executed/confirmed só nas mensagens NÃO nativas. Orçamento como antes.
    let digestBudget = opts.digestBudget ?? DIGEST_BUDGET_CHARS
    const blocks = new Map<number, string>()
    for (let i = recent.length - 1; i >= 0; i--) {
        if (digestBudget <= 0) break
        const m = recent[i]
        if (m.role !== 'assistant' || m.parts.length === 0) continue
        const isNative = nativeCalls.has(i)
        const lines: string[] = []
        for (const p of m.parts) {
            if (p.type === 'context') {
                lines.push(`- ${p.toolName}: ${p.digest}`)
            } else if (p.type === 'executed' && !isNative) {
                const d = digestToolResult(p.toolName, p.result)
                lines.push(d ? `- ${p.toolName} (executada): ${d}` : `- ${p.toolName} (executada)`)
            } else if (p.type === 'confirmation' && p.status === 'cancelled') {
                lines.push(`- ${p.request.toolName} (cancelada pelo treinador)`)
            } else if (p.type === 'confirmation' && p.status === 'confirmed' && !isNative) {
                const d = digestToolResult(p.request.toolName, p.result)
                lines.push(`- ${p.request.toolName} (confirmada e executada)${d ? `: ${d}` : ''}`)
            }
        }
        if (lines.length === 0) continue
        const block = `\n\n<<DADOS_DE_TOOLS>>\n${lines.join('\n')}\n<<FIM_DADOS_DE_TOOLS>>`
        if (block.length <= digestBudget) {
            blocks.set(i, block)
            digestBudget -= block.length
        }
    }

    // 3. Monta a sequência final.
    const out: NativeModelMessage[] = []
    for (let i = 0; i < recent.length; i++) {
        const m = recent[i]
        const text = m.content + (blocks.get(i) ?? '')
        const calls = m.role === 'assistant' ? nativeCalls.get(i) : undefined
        if (!calls) {
            out.push({ role: m.role, content: text })
            continue
        }
        out.push({
            role: 'assistant',
            content: [
                ...(text.trim() ? [{ type: 'text' as const, text }] : []),
                ...calls.map((c) => ({
                    type: 'tool-call' as const,
                    toolCallId: c.toolCallId,
                    toolName: c.toolName,
                    input: c.input,
                })),
            ],
        })
        out.push({
            role: 'tool',
            content: calls.map((c) => ({
                type: 'tool-result' as const,
                toolCallId: c.toolCallId,
                toolName: c.toolName,
                output: c.output,
            })),
        })
    }
    return out
}

// ── Entidade em foco: programa ───────────────────────────────────────────────

export interface ProgramFocus {
    id: string
    name: string | null
}

const UUID_IN_DIGEST_RE = /program_id=([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
const NAME_IN_DIGEST_RE = /^programa "([^"]+)"/

/**
 * O programa mais recente tocado na conversa (criado via draft ou lido via
 * get_program) — vira a dica "programa em foco" do turno, para o modelo editar
 * direto sem reler.
 */
export function deriveProgramFocus(messages: AssistantMessage[]): ProgramFocus | null {
    for (let i = messages.length - 1; i >= 0; i--) {
        const parts = messages[i].parts
        for (let j = parts.length - 1; j >= 0; j--) {
            const p = parts[j]
            if (p.type === 'executed' && PROGRAM_PAYLOAD_TOOLS.has(p.toolName)) {
                const payload = parseMcpPayload(p.result)
                const prog = payload?.program as ProgramShape | undefined
                if (prog && typeof prog.id === 'string') {
                    return { id: prog.id, name: typeof prog.name === 'string' ? prog.name : null }
                }
            } else if (p.type === 'context' && PROGRAM_PAYLOAD_TOOLS.has(p.toolName)) {
                const idMatch = UUID_IN_DIGEST_RE.exec(p.digest)
                if (idMatch) {
                    const nameMatch = NAME_IN_DIGEST_RE.exec(p.digest)
                    return { id: idMatch[1], name: nameMatch?.[1] ?? null }
                }
            }
        }
    }
    return null
}

// ── Strip p/ o cliente ───────────────────────────────────────────────────────

/**
 * Remove as parts internas (`context`) antes de devolver uma mensagem ao
 * cliente (GET de conversa, evento `done`, replay idempotente). A memória vive
 * só no DB/prompt — o cliente nunca a vê (e apps mobile antigos nem saberiam
 * renderizá-la).
 */
export function stripInternalParts<T extends { parts: AssistantMessagePart[] }>(message: T): T {
    if (!message.parts.some((p) => p.type === 'context')) return message
    return { ...message, parts: message.parts.filter((p) => p.type !== 'context') }
}
