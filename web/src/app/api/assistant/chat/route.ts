import { streamText, tool, jsonSchema } from 'ai'
import { openai } from '@ai-sdk/openai'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { buildChatContext } from '@/lib/assistant/context-builder'
import { generateProgram } from '@/actions/prescription/generate-program'
import { enrichStudentContext } from '@/lib/prescription/context-enricher'
import { checkRateLimit, recordRequest } from '@/lib/rate-limit'

export const maxDuration = 60

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_MESSAGE_CHARS = 8000
const MAX_MESSAGES = 50

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
        const limit = checkRateLimit(rateLimitKey, { perMinute: 15, perDay: 300 })
        if (!limit.allowed) {
            return new Response(limit.error || 'Rate limit exceeded', { status: 429 })
        }
        recordRequest(rateLimitKey)

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

        // 5. Build context
        const systemPrompt = await buildChatContext(trainer.id, trainer.name, studentId)

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
            model: openai('gpt-4.1-mini'),
            system: systemPrompt + studentIdHint + TOOL_INSTRUCTIONS,
            messages,
            maxTokens: 1500,
            temperature: 0.7,
            maxSteps: 3,
            tools: {
                generateProgram: tool({
                    description: 'Gera um novo programa de treino para o aluno. Usar quando o trainer pedir para criar/gerar um programa, ou quando o programa atual expirou. O programa é salvo como rascunho para revisão.',
                    parameters: studentIdSchema,
                    execute: async ({ studentId: rawId }) => {
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
                    parameters: studentIdSchema,
                    execute: async ({ studentId: rawId }) => {
                        const sid = await resolveStudentId(rawId)
                        if (!sid) return { error: `Aluno "${rawId}" não encontrado` }
                        console.log('[TOOL analyzeStudentProgress] resolved:', rawId, '→', sid)
                        const context = await enrichStudentContext(supabaseAdmin as any, sid)
                        console.log('[TOOL analyzeStudentProgress] enricher result:', {
                            name: context.student_name,
                            programs: context.previous_programs?.length,
                            loadEntries: context.load_progression?.length,
                            sessions4w: context.session_patterns?.completed_sessions_4w,
                        })

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
                    parameters: studentIdSchema,
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

        return result.toDataStreamResponse()
    } catch (error) {
        console.error('[CHAT API] ERROR:', error)
        return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }),
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
