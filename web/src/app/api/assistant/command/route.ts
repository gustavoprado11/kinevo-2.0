/**
 * ⌘K Command Bar — handler (Fase 1 · IA do Treinador, Trilha 1).
 *
 * A barra de comando opera a TELA ATUAL: o treinador digita uma intenção em
 * linguagem natural e a IA entende, executa as leituras/ações simples
 * automaticamente e PAUSA nas ações que exigem confirmação humana (HITL),
 * devolvendo um ToolConfirmationRequest que o cliente confirma via
 * POST /api/assistant/execute-tool (já existente).
 *
 * Gate em 2 níveis (defense-in-depth):
 *   - GET: informa a UI se o tier libera a superfície (Pro+) + medidor de cota.
 *   - POST: revalida tier (Pro+) e cota antes de gastar LLM. Cota esgotada →
 *     402 amigável (a UI degrada pra GUI; nunca trava o app).
 *
 * Custo: subsetting por intenção (tool-policy) corta 60–70% do input. Metering
 * registrado no fim do turno (créditos das ações auto-executadas + custo real).
 * As CONFIRM_TOOLS são cobradas no execute-tool, ao confirmar.
 */

import { generateText, tool, jsonSchema, type ToolSet } from 'ai'
import { openai } from '@ai-sdk/openai'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAiTierForTrainer, type AiTier } from '@/lib/auth/get-ai-tier'
import { buildMcpTools } from '@/lib/assistant/mcp-bridge'
import {
    CONFIRM_TOOLS,
    actionClassForTool,
    creditWeightForCall,
    computeTurnCredits,
    type ToolIntent,
    type TurnToolCall,
} from '@/lib/assistant/tool-policy'
import { checkQuota } from '@/lib/ai-usage/quota'
import { getAiUsageSummary } from '@/lib/ai-usage/usage-summary'
import {
    recordAiUsage,
    turnCostMicros,
    type AiUsageEventInput,
} from '@/lib/ai-usage/metering'
import type { ToolConfirmationRequest } from '@/lib/assistant/hitl-types'
import { buildChatContext } from '@/lib/assistant/context-builder'
import { generateProgram } from '@/actions/prescription/generate-program'
import type { LLMModel } from '@/lib/prescription/llm-client'

export const maxDuration = 60

const MODEL: LLMModel = 'gpt-4.1-mini'
const SURFACE = 'command_bar' as const
const PRO_TIERS: ReadonlySet<AiTier> = new Set<AiTier>(['pro_ia', 'premium_ia'])
const MAX_INPUT_CHARS = 2000
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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

function resolveIntents(input: string, route: string | undefined): ToolIntent[] {
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

// ----------------------------------------------------------------------------
// generateProgram (roteamento de prescrição — 1 chamada determinística).
// ----------------------------------------------------------------------------
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
// GET — acesso/medidor (gate de UI). Não gasta LLM.
// ----------------------------------------------------------------------------
export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { data: trainer } = await supabase
            .from('trainers')
            .select('id')
            .eq('auth_user_id', user.id)
            .single()
        if (!trainer) return NextResponse.json({ error: 'Trainer not found' }, { status: 404 })

        const summary = await getAiUsageSummary(supabaseAdmin, trainer.id)
        return NextResponse.json({
            tier: summary.tier,
            allowed: PRO_TIERS.has(summary.tier),
            summary,
        })
    } catch (error) {
        console.error('[command GET] error:', error)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}

interface ExecutedToolCall {
    toolName: string
    args: Record<string, unknown>
    result: unknown
}

// ----------------------------------------------------------------------------
// POST — entende a intenção, executa o que pode e pausa nas confirmações.
// ----------------------------------------------------------------------------
export async function POST(req: NextRequest) {
    let bridgeClose: (() => Promise<void>) | null = null
    try {
        // 1. Auth
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        // 2. Resolve trainer
        const { data: trainer } = await supabase
            .from('trainers')
            .select('id, name')
            .eq('auth_user_id', user.id)
            .single()
        if (!trainer) return NextResponse.json({ error: 'Trainer not found' }, { status: 404 })

        // 3. Gate de tier (Pro+) — defense-in-depth (a UI já esconde).
        const tier = await getAiTierForTrainer(supabaseAdmin, trainer.id)
        if (!PRO_TIERS.has(tier)) {
            return NextResponse.json(
                {
                    error: 'tier_locked',
                    message:
                        'A barra de comando com IA está disponível nos planos Pro e Premium. Faça upgrade para operar a tela com IA.',
                },
                { status: 403 },
            )
        }

        // 4. Gate de cota — esgotou → 402 amigável (degrada pra GUI, não trava).
        const quota = await checkQuota(supabaseAdmin, trainer.id, tier)
        if (!quota.allowed) {
            return NextResponse.json(
                {
                    error: 'quota_exceeded',
                    message:
                        'Sua cota de IA deste ciclo acabou. Você pode continuar pela interface normal; os créditos renovam em breve.',
                    resetAt: quota.resetAt,
                },
                { status: 402 },
            )
        }

        // 5. Parse + sanitização (espelha os guard-rails do api/assistant/chat).
        const body = await req.json().catch(() => null)
        const rawInput: unknown = body?.input
        const input = typeof rawInput === 'string' ? rawInput.trim().slice(0, MAX_INPUT_CHARS) : ''
        if (input.length === 0) {
            return NextResponse.json({ error: 'Comando vazio.' }, { status: 400 })
        }
        const route: string | undefined = typeof body?.route === 'string' ? body.route : undefined
        const studentId: string | undefined =
            typeof body?.studentId === 'string' && UUID_RE.test(body.studentId)
                ? body.studentId
                : undefined

        // 6. Subsetting por intenção (corta o input).
        const intents = resolveIntents(input, route)
        const bridge = await buildMcpTools(trainer.id, { intents })
        bridgeClose = bridge.close

        async function resolveStudentId(value: string): Promise<string | null> {
            if (!value || typeof value !== 'string') return null
            if (UUID_RE.test(value)) {
                const { data } = await supabaseAdmin
                    .from('students')
                    .select('id')
                    .eq('id', value)
                    .eq('coach_id', trainer!.id)
                    .maybeSingle()
                return data?.id ?? null
            }
            const escaped = value.replace(/[%_\\]/g, '\\$&')
            const { data } = await supabaseAdmin
                .from('students')
                .select('id')
                .eq('coach_id', trainer!.id)
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

        // 7. Prompt: opera a tela atual; HITL cuida das confirmações.
        const baseContext = await buildChatContext(trainer.id, trainer.name)
        const routeHint = route ? `\nTela atual do treinador: ${route}.` : ''
        const studentHint = studentId
            ? `\nAluno em foco (UUID): ${studentId}. Use esse UUID nas tools quando a intenção for sobre este aluno.`
            : ''
        const system = baseContext + routeHint + studentHint + COMMAND_INSTRUCTIONS

        // 8. Entende a intenção e age. Reads/writes simples auto-executam; as
        //    CONFIRM_TOOLS chegam SEM execute (mcp-bridge) → generateText para
        //    e devolve a tool call para confirmação humana.
        const result = await generateText({
            model: openai(MODEL),
            system,
            messages: [{ role: 'user', content: input }],
            maxTokens: 900,
            temperature: 0.3,
            maxSteps: 5,
            tools,
        })

        // 9. Coleta o que foi executado (crédito) e a confirmação pendente (HITL).
        //    Com `tools: ToolSet` (genérico amplo), os tipos de tool-call/result do
        //    AI SDK colapsam — normalizamos via shapes locais.
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

        const executed: ExecutedToolCall[] = []
        const executedIds = new Set<string>()
        for (const step of steps) {
            for (const tr of step.toolResults) {
                executedIds.add(tr.toolCallId)
                executed.push({
                    toolName: tr.toolName,
                    args: tr.args ?? {},
                    result: tr.result,
                })
            }
        }

        let confirmation: ToolConfirmationRequest | null = null
        for (const tc of toolCalls) {
            if (!executedIds.has(tc.toolCallId) && CONFIRM_TOOLS.has(tc.toolName)) {
                confirmation = buildConfirmation(tc.toolName, tc.args ?? {})
                break
            }
        }

        // 10. Metering do turno (créditos das ações auto-executadas + custo real).
        //     As CONFIRM_TOOLS NÃO entram aqui — são cobradas no execute-tool.
        const turnCalls: TurnToolCall[] = executed.map((e) => ({
            tool: e.toolName,
            studentCount: studentCountFromArgs(e.args),
        }))
        const credits = computeTurnCredits(turnCalls)
        const costMicros = turnCostMicros(MODEL, {
            inputTokens: result.usage.promptTokens,
            outputTokens: result.usage.completionTokens,
        })

        const events: AiUsageEventInput[] = turnCalls.map((c, idx) => ({
            actionClass: actionClassForTool(c.tool),
            credits: creditWeightForCall(c.tool, c.studentCount),
            surface: SURFACE,
            // Atribui o custo do LLM ao primeiro evento (evita dupla contagem).
            ...(idx === 0
                ? {
                      model: MODEL,
                      inputTokens: result.usage.promptTokens,
                      outputTokens: result.usage.completionTokens,
                      costMicros,
                  }
                : {}),
        }))
        if (events.length === 0) {
            // Turno sem ação executada (só consulta/confirmação pendente): cobra 1.
            events.push({
                actionClass: 'query',
                credits: 1,
                surface: SURFACE,
                model: MODEL,
                inputTokens: result.usage.promptTokens,
                outputTokens: result.usage.completionTokens,
                costMicros,
            })
        }

        await recordAiUsage(supabaseAdmin, {
            trainerId: trainer.id,
            periodType: quota.period ?? 'month',
            credits,
            costMicros,
            events,
        })

        // 11. Resumo atualizado (medidor pós-turno).
        const summary = await getAiUsageSummary(supabaseAdmin, trainer.id)

        return NextResponse.json({
            text: result.text,
            confirmation,
            executed: executed.map((e) => ({ toolName: e.toolName, result: e.result })),
            credits,
            summary,
        })
    } catch (error) {
        console.error('[command POST] error:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal error' },
            { status: 500 },
        )
    } finally {
        if (bridgeClose) await bridgeClose().catch(() => {})
    }
}

const COMMAND_INSTRUCTIONS = `

Você é a barra de comando ⌘K do Kinevo: o treinador digita uma intenção e você OPERA a tela atual.
- Resolva a intenção com o MENOR número de ações. Use as tools disponíveis; não invente dados.
- Para LEITURAS e ações simples, execute direto e responda em 1–2 frases o que foi feito/encontrado.
- Ações sensíveis (registrar/cancelar pagamento, cancelar contrato, converter lead, finalizar avaliação,
  excluir treino/exercício, cancelar sessão da agenda) PRECISAM de confirmação humana: apenas CHAME a tool
  com os argumentos corretos — o app mostra o card de confirmação. NÃO peça confirmação por texto.
- Ao usar tools com aluno, passe sempre o UUID do aluno (formato xxxxxxxx-xxxx-...). Nunca o nome.
- Para gerar um programa de treino completo, use generateProgram (gera rascunho para revisão).
- Seja direto e em português. Sem rodeios.`
