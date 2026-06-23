import { streamText, tool, jsonSchema, stepCountIs } from 'ai'
import { openai } from '@ai-sdk/openai'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { buildChatContext } from '@/lib/assistant/context-builder'
import { buildInstructions, PROMPT_VERSION } from '@/lib/assistant/system-prompt'
import { recordTurnTrace, toolResultOk, type TraceToolCall } from '@/lib/assistant/turn-trace'
import { logAssistantError } from '@/lib/assistant/errors'
import { generateProgram } from '@/actions/prescription/generate-program'
import { enrichStudentContext } from '@/lib/prescription/context-enricher'
import { consumeRateLimit } from '@/lib/rate-limit'
import { getAiUsageSummary } from '@/lib/ai-usage/usage-summary'
import {
    recordAiUsage,
    turnCostMicros,
    type AiSurface,
    type TokenUsage,
} from '@/lib/ai-usage/metering'
import { recordFreeTrial, getQuotaForTier, checkFreeTrial } from '@/lib/ai-usage/quota'
import {
    computeTurnCredits,
    actionClassForTool,
    type ActionClass,
    type TurnToolCall,
} from '@/lib/assistant/tool-policy'

export const maxDuration = 60

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_MESSAGE_CHARS = 8000
const MAX_MESSAGES = 50

// Modelo do chat contextual (single source — usado no streamText e no metering).
const CHAT_MODEL = 'gpt-4.1-mini' as const

/** Surface deste handler para o log de uso (ai_usage_events.surface). */
const CHAT_SURFACE: AiSurface = 'chat'

/**
 * Classe de ação das 3 tools do chat contextual (não são tools MCP do catálogo;
 * `actionClassForTool` as classificaria como 'write' por padrão). Mapeamento
 * explícito para metering/free-trial corretos.
 */
const CHAT_TOOL_ACTION_CLASS: Record<string, ActionClass> = {
    generateProgram: 'prescription',
    analyzeStudentProgress: 'query',
    getStudentInsights: 'query',
}

function chatToolActionClass(toolName: string): ActionClass {
    return CHAT_TOOL_ACTION_CLASS[toolName] ?? actionClassForTool(toolName)
}

// Prioridade para o evento-resumo do turno (qual classe representa o turno).
const ACTION_CLASS_PRIORITY: readonly ActionClass[] = ['prescription', 'bulk', 'write', 'query']

function dominantActionClass(classes: ReadonlySet<ActionClass>): ActionClass {
    for (const c of ACTION_CLASS_PRIORITY) {
        if (classes.has(c)) return c
    }
    return 'query'
}

// JSON Schema definitions (zod v4 serialization is incompatible with OpenAI function calling)
const studentIdSchema = jsonSchema<{ studentId: string }>({
    type: 'object',
    properties: { studentId: { type: 'string', description: 'ID do aluno' } },
    required: ['studentId'],
})

export async function POST(req: Request) {
    try {
        // 1. Auth
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return new Response('Unauthorized', { status: 401 })
        }

        // 2. Resolve trainer
        const { data: trainer } = await supabase
            .from('trainers')
            .select('id, name')
            .eq('auth_user_id', user.id)
            .single()

        if (!trainer) {
            return new Response('Trainer not found', { status: 404 })
        }

        // 3. Rate limit (per-trainer) — prevents cost amplification via LLM.
        const rateLimitKey = `assistant:chat:${trainer.id}`
        const limit = await consumeRateLimit(rateLimitKey, { perMinute: 15, perDay: 300 })
        if (!limit.allowed) {
            return new Response(limit.error || 'Rate limit exceeded', { status: 429 })
        }

        // 3b. Tier + gate de cota ANTES do turno (defense-in-depth via service role).
        //     `getAiUsageSummary.exhausted` unifica os dois mundos:
        //       - pago  → balde mensal de créditos esgotado;
        //       - free  → todas as classes de ação 1× já testadas.
        //     Estouro NÃO trava o app: devolvemos 402 amigável para a UI degradar
        //     pra GUI (banner/upsell). O resto do app segue normal.
        const usage = await getAiUsageSummary(supabaseAdmin, trainer.id)
        const tier = usage.tier
        if (usage.exhausted) {
            const message =
                tier === 'free'
                    ? 'Você já testou os recursos de IA do plano Gratuito. Assine um plano para continuar com a IA — o resto do app segue normal.'
                    : 'Cota de IA do período atingida. A IA volta no próximo ciclo; você pode continuar usando o app normalmente.'
            return new Response(
                JSON.stringify({
                    error: 'ai_quota_exhausted',
                    tier,
                    message,
                    resetAt: usage.periodEnd,
                }),
                { status: 402, headers: { 'Content-Type': 'application/json' } },
            )
        }

        // 4. Parse body + sanitize messages.
        // SECURITY: `role` must be forced to 'user'/'assistant' — without this,
        // a malicious client could inject `role: 'system'` with jailbreak instructions
        // that the model would treat as trusted (prompt injection).
        // Content is clamped to MAX_MESSAGE_CHARS and array length to MAX_MESSAGES
        // to prevent cost amplification.
        const body = await req.json()
        const studentId: string | undefined = typeof body?.studentId === 'string' && UUID_RE.test(body.studentId)
            ? body.studentId
            : undefined
        type SafeMessage = { role: 'user' | 'assistant'; content: string }
        const rawMessages: unknown[] = Array.isArray(body?.messages) ? body.messages : []
        const messages: SafeMessage[] = rawMessages
            .slice(-MAX_MESSAGES)
            .map((m): SafeMessage => {
                const raw = m as { role?: unknown; content?: unknown }
                return {
                    role: raw?.role === 'assistant' ? 'assistant' : 'user',
                    content: typeof raw?.content === 'string' ? raw.content.slice(0, MAX_MESSAGE_CHARS) : '',
                }
            })
            .filter((m) => m.content.length > 0)

        // 5. Build context. Instruções estáveis (system-prompt v2) primeiro; contexto
        //    dinâmico (data/hora, alunos, snapshot) em seguida.
        const dynamicContext = await buildChatContext(trainer.id, trainer.name, studentId)
        const systemPrompt = buildInstructions(CHAT_SURFACE) + '\n\n' + dynamicContext

        // Student ID context for tools (when in contextual mode)
        const studentIdHint = studentId
            ? `\nContexto atual: o aluno em foco tem student_id UUID: ${studentId}. Ao usar tools, passe sempre este UUID como studentId.`
            : ''

        // Helper: resolve name → UUID (from LLM tool call).
        // SECURITY: validates ownership against trainer.id for BOTH UUID and name paths,
        // so a prompt-injected tool call with an arbitrary UUID from another trainer's
        // student is rejected.
        async function resolveStudentId(input: string): Promise<string | null> {
            if (!input || typeof input !== 'string') return null
            if (UUID_RE.test(input)) {
                const { data } = await supabaseAdmin
                    .from('students')
                    .select('id')
                    .eq('id', input)
                    .eq('coach_id', trainer!.id)
                    .maybeSingle()
                return data?.id ?? null
            }
            const escaped = input.replace(/[%_\\]/g, '\\$&')
            const { data } = await supabaseAdmin
                .from('students')
                .select('id')
                .eq('coach_id', trainer!.id)
                .ilike('name', `%${escaped}%`)
                .limit(1)
                .maybeSingle()
            return data?.id ?? null
        }

        // 5. Stream with tools
        const result = streamText({
            model: openai(CHAT_MODEL),
            system: systemPrompt + studentIdHint + TOOL_INSTRUCTIONS,
            messages,
            maxOutputTokens: 1500,
            temperature: 0.7,
            stopWhen: stepCountIs(3),
            // 6. Metering do turno (best-effort — NUNCA derruba a resposta).
            //    - pago: cobra créditos no período (increment_ai_usage) + loga o
            //      evento com o custo do LLM (tokens→USD) em ai_usage_events.
            //    - free: marca cada classe de ação testada em ai_free_trials (1× cada).
            onFinish: async ({ totalUsage: turnUsage, steps, text }) => {
                try {
                    const turnCalls: TurnToolCall[] = []
                    const testedClasses = new Set<ActionClass>()
                    for (const step of steps) {
                        for (const call of step.toolCalls) {
                            turnCalls.push({ tool: call.toolName })
                            testedClasses.add(chatToolActionClass(call.toolName))
                        }
                    }
                    // Turno só de conversa/leitura conta como 'query'.
                    if (testedClasses.size === 0) testedClasses.add('query')

                    if (tier === 'free') {
                        for (const actionClass of testedClasses) {
                            await recordFreeTrial(supabaseAdmin, trainer.id, actionClass)
                        }
                        return
                    }

                    const credits = computeTurnCredits(turnCalls)
                    const tokenUsage: TokenUsage = {
                        inputTokens: turnUsage.inputTokens ?? 0,
                        outputTokens: turnUsage.outputTokens ?? 0,
                    }
                    const costMicros = turnCostMicros(CHAT_MODEL, tokenUsage)
                    const periodType = getQuotaForTier(tier)?.period ?? 'month'

                    await recordAiUsage(supabaseAdmin, {
                        trainerId: trainer.id,
                        periodType,
                        creditLimit: getQuotaForTier(tier)?.credits ?? null, // clamp no teto (C1)
                        credits,
                        costMicros,
                        events: [
                            {
                                actionClass: dominantActionClass(testedClasses),
                                credits,
                                surface: CHAT_SURFACE,
                                model: CHAT_MODEL,
                                inputTokens: tokenUsage.inputTokens,
                                outputTokens: tokenUsage.outputTokens,
                                costMicros,
                            },
                        ],
                    })
                } catch (meteringError) {
                    console.error('[CHAT API] metering onFinish error:', meteringError)
                }

                // Trace do turno (best-effort — observabilidade + dataset de evals).
                const traceTools: TraceToolCall[] = []
                for (const step of steps) {
                    const resultById = new Map<string, unknown>()
                    for (const r of step.toolResults ?? []) {
                        resultById.set((r as { toolCallId: string }).toolCallId, (r as { output?: unknown }).output)
                    }
                    for (const call of step.toolCalls) {
                        const id = (call as { toolCallId: string }).toolCallId
                        traceTools.push({
                            toolName: call.toolName,
                            args: (call as { input?: Record<string, unknown> }).input ?? {},
                            ok: toolResultOk(resultById.get(id)),
                        })
                    }
                }
                const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content ?? ''
                const tokenUsageTrace: TokenUsage = {
                    inputTokens: turnUsage.inputTokens ?? 0,
                    outputTokens: turnUsage.outputTokens ?? 0,
                }
                await recordTurnTrace(supabaseAdmin, {
                    trainerId: trainer.id,
                    studentId,
                    kind: 'turn',
                    surface: CHAT_SURFACE,
                    promptVersion: PROMPT_VERSION,
                    model: CHAT_MODEL,
                    input: lastUser,
                    output: text ?? '',
                    tools: traceTools,
                    confirmation: null,
                    credits: computeTurnCredits(traceTools.map((t) => ({ tool: t.toolName }))),
                    inputTokens: tokenUsageTrace.inputTokens,
                    outputTokens: tokenUsageTrace.outputTokens,
                    costMicros: turnCostMicros(CHAT_MODEL, tokenUsageTrace),
                })
            },
            tools: {
                generateProgram: tool({
                    description: 'Gera um novo programa de treino para o aluno. Usar quando o trainer pedir para criar/gerar um programa, ou quando o programa atual expirou. O programa é salvo como rascunho para revisão.',
                    inputSchema: studentIdSchema,
                    execute: async ({ studentId: rawId }) => {
                        // Free: "1× cada ação" — a geração de programa aciona o motor de
                        // prescrição (caro). O gate global (exhausted) só bloqueia quando TODAS
                        // as classes foram testadas; aqui auto-gate por classe para que o free
                        // não gere prescrições ilimitadas enquanto outra classe segue não-testada.
                        if (tier === 'free') {
                            const trial = await checkFreeTrial(supabaseAdmin, trainer.id, 'prescription')
                            if (trial.alreadyUsed) {
                                return { success: false, error: 'No plano Gratuito você já testou a geração de programa. Assine um plano para gerar mais.' }
                            }
                        }
                        const sid = await resolveStudentId(rawId)
                        if (!sid) return { success: false, error: `Aluno "${rawId}" não encontrado` }
                        try {
                            const result = await generateProgram(sid)
                            if (result.success) {
                                return {
                                    success: true,
                                    generationId: result.generationId,
                                    message: 'Programa gerado como rascunho.',
                                    reviewUrl: `/students/${sid}/prescribe?review=${result.generationId}`,
                                }
                            }
                            return { success: false, error: result.error || 'Erro ao gerar programa' }
                        } catch {
                            return { success: false, error: 'Erro interno ao gerar programa' }
                        }
                    },
                }),

                analyzeStudentProgress: tool({
                    description: 'Analisa o progresso detalhado de um aluno: progressão de carga, aderência, volume e tendências. Usar quando pedirem análise, relatório ou panorama do aluno.',
                    inputSchema: studentIdSchema,
                    execute: async ({ studentId: rawId }) => {
                        const sid = await resolveStudentId(rawId)
                        if (!sid) return { error: `Aluno "${rawId}" não encontrado` }
                        const context = await enrichStudentContext(supabaseAdmin as any, sid)
                        // S9: dados do aluno (PII) só vão pro log atrás da flag de debug.
                        if (process.env.KINEVO_LLM_DEBUG_PAYLOAD === 'true') {
                            console.log('[TOOL analyzeStudentProgress]', rawId, '→', sid, {
                                name: context.student_name,
                                programs: context.previous_programs?.length,
                                loadEntries: context.load_progression?.length,
                                sessions4w: context.session_patterns?.completed_sessions_4w,
                            })
                        }

                        const { data: recentSets, error: setsError } = await supabaseAdmin
                            .from('set_logs')
                            .select('exercise_id, weight, reps_completed, workout_sessions!inner(completed_at, student_id)')
                            .eq('workout_sessions.student_id', sid)
                            .eq('is_completed', true)
                            .gte('workout_sessions.completed_at', new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString())
                            .limit(200)

                        if (setsError) console.error('[TOOL analyzeStudentProgress] set_logs error:', setsError)
                        console.log('[TOOL analyzeStudentProgress] recentSets:', recentSets?.length || 0)

                        return {
                            studentName: context.student_name,
                            loadProgression: context.load_progression,
                            sessionPatterns: context.session_patterns,
                            previousPrograms: context.previous_programs.map(p => ({
                                name: p.name,
                                completionRate: p.completion_rate,
                                status: p.status,
                            })),
                            recentSetsCount: recentSets?.length || 0,
                        }
                    },
                }),

                getStudentInsights: tool({
                    description: 'Busca os insights/alertas ativos do assistente para um aluno. Usar quando perguntarem sobre alertas, problemas ou status de um aluno.',
                    inputSchema: studentIdSchema,
                    execute: async ({ studentId: rawId }) => {
                        const sid = await resolveStudentId(rawId)
                        if (!sid) return { insights: [], count: 0, error: `Aluno "${rawId}" não encontrado` }
                        const { data } = await supabaseAdmin
                            .from('assistant_insights')
                            .select('category, priority, title, body, action_type, created_at')
                            .eq('student_id', sid)
                            .eq('trainer_id', trainer.id)
                            .in('status', ['new', 'read'])
                            .order('created_at', { ascending: false })
                            .limit(10)
                        return { insights: data || [], count: data?.length || 0 }
                    },
                }),
            },
        })

        return result.toUIMessageStreamResponse()
    } catch (error) {
        const message = logAssistantError('CHAT API', error)
        return new Response(
            JSON.stringify({ error: 'internal_error', message }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
    }
}

const TOOL_INSTRUCTIONS = `

Instruções sobre ações:
- Ao chamar tools, SEMPRE passe o student_id como UUID (formato xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx). Nunca passe o nome do aluno como studentId.
- Se o aluno em foco já tem UUID informado no contexto, use esse UUID diretamente.
- Quando o trainer pedir para gerar um programa, use a tool generateProgram. Após gerar, informe que foi criado como rascunho e forneça o link para revisão.
- Não gere programa sem que o trainer peça explicitamente.
- Quando pedirem análise ou panorama de um aluno, use analyzeStudentProgress e formate os dados em análise clara.
- Quando perguntarem sobre alertas ou status, use getStudentInsights se precisar de dados atualizados.
- Ao mencionar links de revisão, use o formato: [Revisar programa](/students/ID/prescribe?review=GEN_ID)`
