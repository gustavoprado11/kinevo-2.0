/**
 * Motor de turno do Assistente (IA do Treinador) — núcleo compartilhado.
 *
 * Extraído do handler ⌘K (api/assistant/command) para ser reutilizado pela aba
 * dedicada conversacional (/assistente, surface 'workspace'). Mesma mecânica:
 *   - subsetting por intenção (corta 60–70% do input);
 *   - tools MCP via ponte in-memory + generateProgram determinístico;
 *   - HITL: CONFIRM_TOOLS chegam SEM execute (mcp-bridge) → o turno para e
 *     devolve um ToolConfirmationRequest para confirmação humana;
 *   - metering do turno (créditos das ações auto-executadas + custo real do LLM).
 *
 * Diferença entre superfícies:
 *   - ⌘K (command_bar): turno único sobre a TELA atual, sem histórico.
 *   - Aba (workspace): conversa multi-turno e persistida — passa `history`.
 */

import { generateText, tool, jsonSchema, type ToolSet } from 'ai'
import { openai } from '@ai-sdk/openai'
import type { SupabaseClient } from '@supabase/supabase-js'
import { buildMcpTools } from '@/lib/assistant/mcp-bridge'
import {
    CONFIRM_TOOLS,
    actionClassForTool,
    creditWeightForCall,
    computeTurnCredits,
    type ToolIntent,
    type TurnToolCall,
} from '@/lib/assistant/tool-policy'
import {
    recordAiUsage,
    turnCostMicros,
    type AiSurface,
    type AiUsageEventInput,
} from '@/lib/ai-usage/metering'
import { getAiUsageSummary, type AiUsageSummary } from '@/lib/ai-usage/usage-summary'
import { checkQuota } from '@/lib/ai-usage/quota'
import { getAiTierForTrainer, type AiTier } from '@/lib/auth/get-ai-tier'
import type { ToolConfirmationRequest } from '@/lib/assistant/hitl-types'
import { buildChatContext } from '@/lib/assistant/context-builder'
import { buildInstructions, PROMPT_VERSION } from '@/lib/assistant/system-prompt'
import { recordTurnTrace, toolResultOk } from '@/lib/assistant/turn-trace'
import { validateConfirmArgs } from '@/lib/assistant/arg-validation'
import { generateProgram } from '@/actions/prescription/generate-program'
import type { LLMModel } from '@/lib/prescription/llm-client'

export const ASSISTANT_MODEL: LLMModel = 'gpt-4.1-mini'
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Tiers que liberam o Assistente com IA (⌘K e aba dedicada). */
export const PRO_TIERS: ReadonlySet<AiTier> = new Set<AiTier>(['pro_ia', 'premium_ia'])

export type AssistantGate =
    | { allowed: true; tier: AiTier; period: 'week' | 'month' }
    | { allowed: false; status: 403; error: 'tier_locked'; message: string }
    | { allowed: false; status: 402; error: 'quota_exceeded'; message: string; resetAt: string | null }

/**
 * Gate de acesso ao Assistente (defense-in-depth — a UI já esconde):
 *   - tier Pro+ obrigatório;
 *   - cota do ciclo não esgotada (esgotou → 402 amigável; degrada pra GUI).
 * Compartilhado pelo ⌘K (command_bar) e pela aba dedicada (workspace).
 */
export async function gateAssistant(
    admin: SupabaseClient,
    trainerId: string,
): Promise<AssistantGate> {
    const tier = await getAiTierForTrainer(admin, trainerId)
    if (!PRO_TIERS.has(tier)) {
        return {
            allowed: false,
            status: 403,
            error: 'tier_locked',
            message:
                'O Assistente com IA está disponível nos planos Pro e Premium. Faça upgrade para operar o Kinevo com IA.',
        }
    }
    const quota = await checkQuota(admin, trainerId, tier)
    if (!quota.allowed) {
        return {
            allowed: false,
            status: 402,
            error: 'quota_exceeded',
            message:
                'Sua cota de IA deste ciclo acabou. Você pode continuar pela interface normal; os créditos renovam em breve.',
            resetAt: quota.resetAt ?? null,
        }
    }
    return { allowed: true, tier, period: quota.period ?? 'month' }
}

// ----------------------------------------------------------------------------
// Intent resolution (subsetting) — pela rota atual + palavras-chave da intenção.
// ----------------------------------------------------------------------------
const ROUTE_INTENTS: ReadonlyArray<readonly [string, ToolIntent[]]> = [
    ['/financial', ['financeiro']],
    ['/students', ['alunos', 'prescricao', 'avaliacao', 'comunicacao']],
    ['/schedule', ['agenda']],
    ['/forms', ['forms', 'avaliacao']],
    ['/avaliacoes', ['avaliacao', 'forms']],
    ['/marketing', ['leads']],
    ['/leads', ['leads']],
    ['/messages', ['comunicacao']],
    ['/programs', ['prescricao']],
    ['/exercises', ['prescricao']],
    ['/dashboard', ['alunos', 'financeiro', 'agenda']],
    // Aba dedicada: leque mais amplo (conversa pode ir a qualquer domínio).
    ['/assistente', ['alunos', 'prescricao', 'financeiro', 'agenda', 'comunicacao']],
]

const KEYWORD_INTENTS: ReadonlyArray<readonly [RegExp, ToolIntent]> = [
    [/pag|cobran|fatur|assinatur|plano|receita|mrr|inadimpl|contrat/i, 'financeiro'],
    [/treino|programa|prescri|exerc|s[ée]rie|carga|superset/i, 'prescricao'],
    [/agenda|sess[ãa]o|hor[áa]rio|reagend|marcar|consulta/i, 'agenda'],
    [/formul[áa]rio|check-?in|question[áa]rio/i, 'forms'],
    [/avalia|medi[çc][ãa]o|dobra|circunfer/i, 'avaliacao'],
    [/mensag|conversa|whats|recado/i, 'comunicacao'],
    [/lead|prospect|convers[ãa]o de lead/i, 'leads'],
    [/aluno|progresso|ader[êe]ncia|insight/i, 'alunos'],
]

export function resolveIntents(input: string, route: string | undefined): ToolIntent[] {
    const set = new Set<ToolIntent>()
    if (route) {
        for (const [prefix, intents] of ROUTE_INTENTS) {
            if (route.startsWith(prefix)) intents.forEach((i) => set.add(i))
        }
    }
    for (const [re, intent] of KEYWORD_INTENTS) {
        if (re.test(input)) set.add(intent)
    }
    // Fallback amplo, mas ainda com subsetting (não manda as 55).
    if (set.size === 0) {
        set.add('alunos')
        set.add('financeiro')
        set.add('agenda')
    }
    return [...set]
}

// ----------------------------------------------------------------------------
// Cópia PT-BR do card de confirmação (sem montar texto no client).
// ----------------------------------------------------------------------------
const DESTRUCTIVE_TOOLS: ReadonlySet<string> = new Set([
    'kinevo_cancel_contract',
    'kinevo_delete_workout_session',
    'kinevo_delete_workout_item',
    'kinevo_cancel_appointment_occurrence',
    'kinevo_cancel_appointment_series',
])

const CONFIRM_TITLES: Record<string, string> = {
    kinevo_create_contract: 'Registrar contrato / assinatura',
    kinevo_mark_payment_as_paid: 'Registrar pagamento como pago',
    kinevo_cancel_contract: 'Cancelar contrato',
    kinevo_convert_lead: 'Converter lead em aluno',
    kinevo_finalize_assessment: 'Finalizar avaliação',
    kinevo_delete_workout_session: 'Excluir sessão de treino',
    kinevo_delete_workout_item: 'Excluir exercício do treino',
    kinevo_cancel_appointment_occurrence: 'Cancelar esta sessão da agenda',
    kinevo_cancel_appointment_series: 'Cancelar a série de sessões',
}

function summarizeArgs(args: Record<string, unknown>): string {
    const parts: string[] = []
    for (const [k, v] of Object.entries(args)) {
        if (v === null || v === undefined || v === '') continue
        if (typeof v === 'object') continue
        parts.push(`${k}: ${String(v)}`)
        if (parts.length >= 4) break
    }
    return parts.length > 0 ? parts.join(' · ') : 'Confirme os detalhes antes de executar.'
}

function buildConfirmation(
    toolName: string,
    args: Record<string, unknown>,
): ToolConfirmationRequest {
    return {
        toolName,
        title: CONFIRM_TITLES[toolName] ?? toolName,
        summary: summarizeArgs(args),
        args,
        destructive: DESTRUCTIVE_TOOLS.has(toolName),
    }
}

const studentIdSchema = jsonSchema<{ studentId: string }>({
    type: 'object',
    properties: { studentId: { type: 'string', description: 'UUID do aluno' } },
    required: ['studentId'],
})

function studentCountFromArgs(args: unknown): number {
    if (args && typeof args === 'object' && 'student_ids' in args) {
        const ids = (args as { student_ids?: unknown }).student_ids
        if (Array.isArray(ids)) return ids.length
    }
    return 1
}

// ----------------------------------------------------------------------------
// Turno do assistente.
// ----------------------------------------------------------------------------
export interface AssistantTurnHistory {
    role: 'user' | 'assistant'
    content: string
}

export interface ExecutedToolSummary {
    toolName: string
    result: unknown
}

export interface AssistantTurnInput {
    admin: SupabaseClient
    trainerId: string
    trainerName: string | null
    input: string
    /** Superfície p/ metering (ai_usage_events.surface). */
    surface: AiSurface
    /** Período de cota do tier (vem do gate). */
    periodType: 'week' | 'month'
    /** Histórico anterior (aba conversacional); vazio no ⌘K. */
    history?: AssistantTurnHistory[]
    /** Rota atual (⌘K) — afeta o subsetting de tools. */
    route?: string
    /** Aluno em foco (UUID) — enriquece o contexto e direciona as tools. */
    studentId?: string
}

export interface AssistantTurnResult {
    text: string
    confirmation: ToolConfirmationRequest | null
    executed: ExecutedToolSummary[]
    credits: number
    summary: AiUsageSummary
}

const MAX_HISTORY = 20

/**
 * Executa um turno: entende a intenção, auto-executa leituras/ações simples e
 * pausa nas CONFIRM_TOOLS (HITL). Faz o metering e devolve o medidor atualizado.
 * Pressupõe que o caller já validou auth + tier (Pro+) + cota.
 */
export async function runAssistantTurn(opts: AssistantTurnInput): Promise<AssistantTurnResult> {
    const { admin, trainerId, trainerName, input, surface, periodType } = opts
    let bridgeClose: (() => Promise<void>) | null = null
    try {
        // 1. Subsetting por intenção (corta o input).
        const intents = resolveIntents(input, opts.route)
        const bridge = await buildMcpTools(trainerId, { intents })
        bridgeClose = bridge.close

        async function resolveStudentId(value: string): Promise<string | null> {
            if (!value || typeof value !== 'string') return null
            if (UUID_RE.test(value)) {
                const { data } = await admin
                    .from('students')
                    .select('id')
                    .eq('id', value)
                    .eq('coach_id', trainerId)
                    .maybeSingle()
                return data?.id ?? null
            }
            const escaped = value.replace(/[%_\\]/g, '\\$&')
            const { data } = await admin
                .from('students')
                .select('id')
                .eq('coach_id', trainerId)
                .ilike('name', `%${escaped}%`)
                .limit(1)
                .maybeSingle()
            return data?.id ?? null
        }

        const tools: ToolSet = {
            ...bridge.tools,
            generateProgram: tool({
                description:
                    'Gera um novo programa de treino completo para o aluno (rascunho para revisão). Usar quando o treinador pedir para criar/gerar um programa.',
                parameters: studentIdSchema,
                execute: async ({ studentId: rawId }) => {
                    const sid = await resolveStudentId(rawId)
                    if (!sid) return { success: false, error: `Aluno "${rawId}" não encontrado` }
                    try {
                        const gen = await generateProgram(sid)
                        if (gen.success) {
                            return {
                                success: true,
                                generationId: gen.generationId,
                                message: 'Programa gerado como rascunho.',
                                reviewUrl: `/students/${sid}/prescribe?review=${gen.generationId}`,
                            }
                        }
                        return { success: false, error: gen.error || 'Erro ao gerar programa' }
                    } catch {
                        return { success: false, error: 'Erro interno ao gerar programa' }
                    }
                },
            }),
        }

        // 2. Prompt + histórico. Instruções estáveis (system-prompt v2) primeiro;
        //    bloco HITL/MCP em seguida; contexto dinâmico por último (studentId
        //    enriquece com o perfil do aluno).
        const dynamicContext = await buildChatContext(trainerId, trainerName ?? '', opts.studentId)
        const routeHint = opts.route ? `\nTela atual do treinador: ${opts.route}.` : ''
        const studentHint = opts.studentId
            ? `\nAluno em foco (UUID): ${opts.studentId}. Use esse UUID nas tools quando a intenção for sobre este aluno.`
            : ''
        const system =
            buildInstructions(surface) +
            MCP_HITL_INSTRUCTIONS +
            '\n\n' +
            dynamicContext +
            routeHint +
            studentHint

        const history = (opts.history ?? []).slice(-MAX_HISTORY)
        const messages = [...history, { role: 'user' as const, content: input }]

        // 3. Entende a intenção e age. CONFIRM_TOOLS chegam sem execute → para.
        const result = await generateText({
            model: openai(ASSISTANT_MODEL),
            system,
            messages,
            maxTokens: 900,
            temperature: 0.3,
            maxSteps: 5,
            tools,
        })

        // 4. Coleta o executado (crédito) e a confirmação pendente (HITL).
        interface RawToolCall {
            toolCallId: string
            toolName: string
            args?: Record<string, unknown>
        }
        interface RawToolResult extends RawToolCall {
            result?: unknown
        }
        const steps = result.steps as unknown as Array<{ toolResults: RawToolResult[] }>
        const toolCalls = result.toolCalls as unknown as RawToolCall[]

        const executed: Array<{ toolName: string; args: Record<string, unknown>; result: unknown }> = []
        const executedIds = new Set<string>()
        for (const step of steps) {
            for (const tr of step.toolResults) {
                executedIds.add(tr.toolCallId)
                executed.push({ toolName: tr.toolName, args: tr.args ?? {}, result: tr.result })
            }
        }

        let confirmation: ToolConfirmationRequest | null = null
        let blockedReason: string | null = null
        for (const tc of toolCalls) {
            if (!executedIds.has(tc.toolCallId) && CONFIRM_TOOLS.has(tc.toolName)) {
                const card = buildConfirmation(tc.toolName, tc.args ?? {})
                // G5: valida os args ANTES de mostrar o card. Inválido → não mostra
                // card, vira clarificação. Válido com alvo → resumo legível no card.
                const validation = await validateConfirmArgs(admin, trainerId, tc.toolName, tc.args ?? {})
                if (!validation.ok) {
                    blockedReason = validation.reason
                } else {
                    if (validation.target) card.summary = validation.target.label
                    confirmation = card
                }
                break
            }
        }

        // Se a validação barrou a ação, devolve uma clarificação em vez do card.
        const finalText = blockedReason
            ? `${result.text ? result.text + '\n\n' : ''}⚠️ ${blockedReason}`
            : result.text

        // 5. Metering do turno (CONFIRM_TOOLS NÃO entram — cobradas no execute-tool).
        const turnCalls: TurnToolCall[] = executed.map((e) => ({
            tool: e.toolName,
            studentCount: studentCountFromArgs(e.args),
        }))
        const credits = computeTurnCredits(turnCalls)
        const costMicros = turnCostMicros(ASSISTANT_MODEL, {
            inputTokens: result.usage.promptTokens,
            outputTokens: result.usage.completionTokens,
        })

        const events: AiUsageEventInput[] = turnCalls.map((c, idx) => ({
            actionClass: actionClassForTool(c.tool),
            credits: creditWeightForCall(c.tool, c.studentCount),
            surface,
            ...(idx === 0
                ? {
                      model: ASSISTANT_MODEL,
                      inputTokens: result.usage.promptTokens,
                      outputTokens: result.usage.completionTokens,
                      costMicros,
                  }
                : {}),
        }))
        if (events.length === 0) {
            events.push({
                actionClass: 'query',
                credits: 1,
                surface,
                model: ASSISTANT_MODEL,
                inputTokens: result.usage.promptTokens,
                outputTokens: result.usage.completionTokens,
                costMicros,
            })
        }

        await recordAiUsage(admin, {
            trainerId,
            periodType,
            credits,
            costMicros,
            events,
        })

        const summary = await getAiUsageSummary(admin, trainerId)

        // 6. Trace do turno (best-effort — observabilidade + dataset de evals).
        await recordTurnTrace(admin, {
            trainerId,
            studentId: opts.studentId,
            kind: 'turn',
            surface,
            route: opts.route,
            promptVersion: PROMPT_VERSION,
            model: ASSISTANT_MODEL,
            input,
            output: finalText,
            tools: executed.map((e) => ({
                toolName: e.toolName,
                args: e.args,
                ok: toolResultOk(e.result),
            })),
            confirmation: confirmation
                ? { toolName: confirmation.toolName, destructive: confirmation.destructive }
                : null,
            intents,
            credits,
            inputTokens: result.usage.promptTokens,
            outputTokens: result.usage.completionTokens,
            costMicros,
        })

        return {
            text: finalText,
            confirmation,
            executed: executed.map((e) => ({ toolName: e.toolName, result: e.result })),
            credits,
            summary,
        }
    } finally {
        if (bridgeClose) await bridgeClose().catch(() => {})
    }
}

/**
 * Bloco específico do caminho MCP (⌘K + workspace): política HITL e dicas de tools
 * que só existem aqui (catálogo MCP). A persona/regras comuns vêm de buildInstructions.
 */
const MCP_HITL_INSTRUCTIONS = `

# Ações no Kinevo (HITL)
- Leituras e escritas reversíveis (atualizar aluno, criar rascunho de programa, agendar formulário):
  execute direto e relate objetivamente o que foi feito.
- Ações SENSÍVEIS (registrar/cancelar pagamento, cancelar contrato, converter lead, finalizar avaliação,
  excluir treino/exercício, cancelar sessão ou série da agenda) PRECISAM de confirmação humana:
  apenas CHAME a tool com os argumentos corretos — o app mostra o card de confirmação.
  NÃO peça confirmação por texto, NÃO descreva o card.
- Nunca dispare uma ação sensível em lote sem o treinador ter pedido explicitamente o alvo.
- Para o progresso de um aluno, use kinevo_get_student_progress antes de responder.
- Ao prescrever ou editar sessões, defina os dias da semana (scheduled_days) — é parte de uma boa
  prescrição e dispara os lembretes do aluno.`
