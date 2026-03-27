import { streamText, tool } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { buildChatContext } from '@/lib/assistant/context-builder'
import { generateProgram } from '@/actions/prescription/generate-program'
import { enrichStudentContext } from '@/lib/prescription/context-enricher'

export const maxDuration = 60

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

        // 3. Parse body
        const { messages, studentId } = await req.json()

        // 4. Build context
        const systemPrompt = await buildChatContext(trainer.id, trainer.name, studentId || undefined)

        // 5. Stream with tools
        const result = streamText({
            model: openai('gpt-4.1-mini'),
            system: systemPrompt + TOOL_INSTRUCTIONS,
            messages,
            maxTokens: 1500,
            temperature: 0.7,
            maxSteps: 3,
            tools: {
                generateProgram: tool({
                    description: 'Gera um novo programa de treino para o aluno. Usar quando o trainer pedir para criar/gerar um programa, ou quando o programa atual expirou. O programa é salvo como rascunho para revisão.',
                    parameters: z.object({
                        studentId: z.string().describe('ID do aluno para quem gerar o programa'),
                    }),
                    execute: async ({ studentId: sid }) => {
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
                    parameters: z.object({
                        studentId: z.string().describe('ID do aluno para analisar'),
                    }),
                    execute: async ({ studentId: sid }) => {
                        const context = await enrichStudentContext(supabase, sid)
                        const { data: recentSets } = await supabaseAdmin
                            .from('set_logs')
                            .select('exercise_id, weight, reps_completed, workout_sessions!inner(completed_at, student_id)')
                            .eq('workout_sessions.student_id', sid)
                            .eq('is_completed', true)
                            .gte('workout_sessions.completed_at', new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString())
                            .limit(200)

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
                    parameters: z.object({
                        studentId: z.string().describe('ID do aluno'),
                    }),
                    execute: async ({ studentId: sid }) => {
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
- Quando o trainer pedir para gerar um programa, use a tool generateProgram. Após gerar, informe que foi criado como rascunho e forneça o link para revisão.
- Não gere programa sem que o trainer peça explicitamente.
- Quando pedirem análise ou panorama de um aluno, use analyzeStudentProgress e formate os dados em análise clara.
- Quando perguntarem sobre alertas ou status, use getStudentInsights se precisar de dados atualizados.
- Ao mencionar links de revisão, use o formato: [Revisar programa](/students/ID/prescribe?review=GEN_ID)`
