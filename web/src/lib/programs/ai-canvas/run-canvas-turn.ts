// Turno de build "ao vivo" do canvas do builder.
//
// Reusa o engine do Assistente (contexto do aluno via buildChatContext, mesmo
// modelo de build Sonnet) mas com um conjunto de tools próprio e voltado ao
// CANVAS, não ao banco: a IA busca exercícios no catálogo que o cliente mandou
// (sem hit no banco) e chama render_program com o programa completo; o handler
// emite o evento `program`, que o cliente aplica AO VIVO no canvas pela ponte.
// Nada persiste aqui — o save acontece só no Ativar/Agendar do builder.
//
// NÃO toca lib/prescription/ (motor protegido). Replica ~10 linhas de seleção
// de modelo pra não acoplar à API privada do command-engine.

import { generateText, tool, stepCountIs, type ModelMessage } from 'ai'
import { openai } from '@ai-sdk/openai'
import { anthropic } from '@ai-sdk/anthropic'
import { google } from '@ai-sdk/google'
import { z } from 'zod'
import { buildChatContext } from '@/lib/assistant/context-builder'
import type {
    CanvasChatMessage,
    CanvasExercise,
    CanvasSessionDTO,
    CanvasStreamEvent,
    RenderedProgram,
} from './types'

const BUILD_MODELS: ReadonlySet<string> = new Set([
    'gpt-4.1', 'gpt-4.1-mini', 'gpt-4o-mini', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001',
    // Gemini via @ai-sdk/google@2 (AI SDK 5): os 3.x já funcionam (thought
    // signatures tratadas pelo provider). 2.5-flash mantido como alternativa.
    'gemini-3.5-flash', 'gemini-3-flash-preview', 'gemini-2.5-flash',
])
const DEFAULT_BUILD_MODEL = 'gemini-3.5-flash'
const FALLBACK_MODEL = 'gpt-4.1-mini'

/**
 * Modelo do build do canvas. Env DEDICADO `CANVAS_BUILD_MODEL` (isola do
 * Assistente de prod, que lê `ASSISTANT_BUILD_MODEL`); cai pra esse e, por fim,
 * no default. Claude exige ANTHROPIC_API_KEY; Gemini exige GOOGLE_GENERATIVE_AI_API_KEY.
 */
function resolveBuildModel(): string {
    const env = process.env.CANVAS_BUILD_MODEL || process.env.ASSISTANT_BUILD_MODEL
    const wanted = env && BUILD_MODELS.has(env) ? env : DEFAULT_BUILD_MODEL
    if (wanted.startsWith('claude') && !process.env.ANTHROPIC_API_KEY) return FALLBACK_MODEL
    if (wanted.startsWith('gemini') && !process.env.GOOGLE_GENERATIVE_AI_API_KEY) return FALLBACK_MODEL
    return wanted
}

function providerFor(model: string) {
    if (model.startsWith('gemini')) return google(model)
    if (model.startsWith('claude')) return anthropic(model)
    return openai(model)
}

function snapshotForPrompt(program: RenderedProgram): string {
    if (!program.sessions || program.sessions.length === 0) return '(canvas vazio — nenhuma sessão ainda)'
    const lines = program.sessions.map((s, i) => {
        const days = (s.scheduled_days ?? []).join(',')
        const items = (s.items ?? []).map(it => `    - ${it.exercise_id} ${it.sets ?? '?'}x${it.reps ?? '?'}`).join('\n')
        return `  Sessão ${i + 1}: "${s.name}" [dias ${days || '—'}]\n${items || '    (sem exercícios)'}`
    })
    const meta = `nome="${program.name ?? ''}" duração=${program.duration_weeks ?? '—'}sem`
    return `${meta}\n${lines.join('\n')}`
}

function buildSystemPrompt(studentContext: string, studentName: string, currentProgram: RenderedProgram): string {
    return [
        `Você é o assistente de prescrição do Kinevo montando um programa de treino DIRETO NO CANVAS do builder, para o aluno ${studentName}.`,
        `O treinador conversa com você e você monta/ajusta o programa em tempo real.`,
        '',
        studentContext,
        '',
        'ESTADO ATUAL DO CANVAS (programa sendo editado):',
        snapshotForPrompt(currentProgram),
        '',
        'REGRAS DE QUALIDADE (um treinador de verdade vai revisar — não entregue algo raso):',
        '1. EXERCÍCIOS POR SESSÃO: 5 a 7 por sessão de hipertrofia (MÍNIMO 4). Um treino com 3 exercícios é raso e inaceitável, exceto se o treinador pedir treino curto explicitamente.',
        '2. CASAR EXERCÍCIO↔SESSÃO: todo exercício precisa bater com os grupos do NOME da sessão. Ex.: "Costas e Bíceps" = puxadas, remadas, rosca — NUNCA agachamento/levantamento terra (perna/posterior) ou remada alta (ombro/trapézio). Confira os músculos que o search_exercises devolve antes de incluir.',
        '3. VOLUME SEMANAL: garanta 10–20 séries/semana por grupo muscular principal treinado; no grupo ENFATIZADO, mire o topo da faixa. Some as séries do mesmo grupo entre as sessões ANTES de finalizar — nenhum grupo treinado pode ficar com volume ridículo (costas com 3 séries na semana é erro grave).',
        '4. SPLIT COERENTE: para a frequência pedida, use uma divisão que cubra todos os grupos com volume equilibrado (ex.: 5x → Push/Pull/Legs + Upper/Lower, ou Inferior/Superior alternando ênfases). Não repita o mesmo exercício em sessões diferentes sem motivo.',
        '5. ORDEM E PRESCRIÇÃO: 1–2 compostos do grupo-alvo no início, depois acessórios e isoladores. Reps/descanso de hipertrofia (compostos 6–10, isoladores 10–15; descanso 60–120s).',
        '',
        'COMO MONTAR:',
        '- Chame search_exercises UMA VEZ POR GRUPO MUSCULAR (parâmetro muscle) pra achar os exercícios certos de cada sessão — busque quantas vezes precisar ANTES de montar.',
        '- Use SOMENTE exercise_id retornado por search_exercises. NUNCA invente ids.',
        '- Quando o programa (ou o ajuste) estiver completo, chame render_program com o PROGRAMA INTEIRO — todas as sessões e TODOS os exercícios — preservando o que já existe no canvas, exceto o que o treinador pediu pra mudar. render_program SUBSTITUI o canvas.',
        '- Sempre defina scheduled_days (0=domingo … 6=sábado) em cada sessão.',
        '- Depois de render_program, escreva 1–2 frases curtas do que montou/mudou. NÃO liste o programa inteiro em texto.',
        '- Se faltar info essencial (objetivo ou dias), faça UMA pergunta curta antes de montar.',
    ].join('\n')
}

export interface RunCanvasTurnArgs {
    trainerId: string
    trainerName: string
    studentId: string
    studentName: string
    message: string
    history: CanvasChatMessage[]
    exercises: CanvasExercise[]
    currentProgram: RenderedProgram
    onEvent: (e: CanvasStreamEvent) => void
}

export interface RunCanvasTurnResult {
    text: string
    rendered: boolean
    model: string
}

export async function runCanvasTurn(args: RunCanvasTurnArgs): Promise<RunCanvasTurnResult> {
    const { trainerId, trainerName, studentId, studentName, message, history, exercises, currentProgram, onEvent } = args

    const studentContext = await buildChatContext(trainerId, trainerName, studentId)
    const catalogById = new Map(exercises.map(e => [e.id, e]))
    let rendered = false

    const system = buildSystemPrompt(studentContext, studentName, currentProgram)

    const tools = {
        search_exercises: tool({
            description:
                'Busca exercícios REAIS no catálogo do treinador. Use SEMPRE antes de montar; só use exercise_id retornado aqui — NUNCA invente ids.',
            inputSchema: z.object({
                query: z.string().optional().describe('Texto do nome (ex.: agachamento, supino, remada)'),
                muscle: z.string().optional().describe('Grupo muscular (ex.: Peito, Costas, Quadríceps, Glúteo)'),
                limit: z.number().optional().describe('Máx. de resultados (padrão 15, teto 30)'),
            }),
            execute: async ({ query, muscle, limit }) => {
                const q = (query ?? '').toLowerCase().trim()
                const m = (muscle ?? '').toLowerCase().trim()
                let results = exercises
                if (q) results = results.filter(e => e.name.toLowerCase().includes(q))
                if (m) results = results.filter(e => (e.muscle ?? '').toLowerCase().includes(m))
                const top = results.slice(0, Math.min(limit ?? 15, 30))
                onEvent({ type: 'progress', label: `Buscando exercícios${query ? ` · ${query}` : ''}` })
                return {
                    count: top.length,
                    exercises: top.map(e => ({ id: e.id, name: e.name, muscle: e.muscle ?? null, equipment: e.equipment ?? null })),
                }
            },
        }),
        render_program: tool({
            description:
                'Renderiza o PROGRAMA COMPLETO no canvas do builder (SUBSTITUI o que estiver lá). Chame quando o programa/ajuste estiver pronto, com TODAS as sessões e exercícios. Use só exercise_id vindos de search_exercises ou já presentes no canvas atual.',
            inputSchema: z.object({
                name: z.string().optional().describe('Nome do programa (ex.: "Hipertrofia — Ênfase Glúteo")'),
                duration_weeks: z.number().optional().describe('Duração em semanas (ex.: 8)'),
                sessions: z.array(z.object({
                    name: z.string().describe('Nome da sessão (ex.: "Treino A — Inferiores")'),
                    scheduled_days: z.array(z.number()).describe('Dias 0=domingo … 6=sábado (ex.: [1,4] = seg/qui)'),
                    items: z.array(z.object({
                        exercise_id: z.string().describe('exercise_id REAL do catálogo'),
                        sets: z.number().optional().describe('Número de séries'),
                        reps: z.string().optional().describe('Reps (ex.: "8-12", "10", "AMRAP")'),
                        rest_seconds: z.number().optional().describe('Descanso entre séries (s)'),
                        notes: z.string().optional().describe('Observação curta'),
                    })).describe('Exercícios na ordem (compostos primeiro)'),
                })).describe('Sessões na ordem (Treino A, B, …)'),
            }),
            execute: async ({ name, duration_weeks, sessions }) => {
                let dropped = 0
                const cleanSessions: CanvasSessionDTO[] = (sessions ?? []).map(s => ({
                    name: s.name,
                    scheduled_days: Array.isArray(s.scheduled_days) ? s.scheduled_days.filter(d => d >= 0 && d <= 6) : [],
                    items: (s.items ?? [])
                        .filter(it => {
                            const ok = !!it.exercise_id && catalogById.has(it.exercise_id)
                            if (!ok) dropped++
                            return ok
                        })
                        .map(it => ({
                            exercise_id: it.exercise_id,
                            sets: it.sets ?? null,
                            reps: it.reps ?? null,
                            rest_seconds: it.rest_seconds ?? null,
                            notes: it.notes ?? null,
                        })),
                }))
                const program: RenderedProgram = {
                    name: name ?? currentProgram.name ?? null,
                    duration_weeks: duration_weeks ?? currentProgram.duration_weeks ?? null,
                    sessions: cleanSessions,
                }
                rendered = true
                onEvent({ type: 'progress', label: 'Montando no canvas…' })
                onEvent({ type: 'program', program })
                const itemCount = cleanSessions.reduce((n, s) => n + s.items.length, 0)
                return { ok: true, sessions: cleanSessions.length, items: itemCount, dropped_invalid: dropped }
            },
        }),
    }

    const messages: ModelMessage[] = [
        ...history.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: message },
    ]

    const runGen = (model: string) =>
        generateText({
            model: providerFor(model),
            system,
            messages,
            // 8000 (não 4000): um render_program de 5 sessões × 5–7 exercícios é
            // grande; com pouco budget a saída trunca e a IA "cabe" só 3 por sessão.
            maxOutputTokens: 8000,
            temperature: 0.4,
            // Teto de passos: a IA busca exercícios por grupo (várias vezes) antes
            // do render_program; 16 dá folga pras buscas sem virar loop.
            stopWhen: stepCountIs(16),
            tools,
        })

    // Erro TRANSITÓRIO do provedor (ex.: 529 overloaded / 429 / 5xx): vale
    // re-tentar o modelo forte. Erro persistente/auth: degrada pro mini.
    const isTransient = (err: unknown): boolean => {
        const e = err as { statusCode?: number; status?: number; message?: string } | undefined
        const code = e?.statusCode ?? e?.status
        if (code && [408, 409, 425, 429, 500, 502, 503, 504, 529].includes(code)) return true
        const msg = (e?.message ?? '').toLowerCase()
        return msg.includes('overloaded') || msg.includes('rate limit') || msg.includes('529') || msg.includes('timeout')
    }
    const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

    let model = resolveBuildModel()
    let result: Awaited<ReturnType<typeof runGen>> | null = null

    // Build é qualidade-crítico: num blip transitório do Sonnet (ex.: 529 da
    // Anthropic), tenta de novo algumas vezes ANTES de cair pro mini — senão um
    // momento de sobrecarga derruba a qualidade do treino inteiro.
    const strongModel = model
    const maxAttempts = strongModel === FALLBACK_MODEL ? 1 : 3
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            result = await runGen(model)
            break
        } catch (err) {
            if (model === strongModel && model !== FALLBACK_MODEL && isTransient(err) && attempt < maxAttempts) {
                onEvent({ type: 'progress', label: `Modelo ocupado — tentando de novo (${attempt}/${maxAttempts - 1})…` })
                await sleep(700 * attempt)
                continue
            }
            if (model === FALLBACK_MODEL) throw err
            model = FALLBACK_MODEL
            onEvent({ type: 'progress', label: 'Sonnet indisponível — usando modelo alternativo…' })
            result = await runGen(model)
            break
        }
    }
    if (!result) throw new Error('Falha ao gerar: sem resultado do modelo.')

    const text =
        result.text?.trim() ||
        (rendered ? 'Pronto — montei no canvas. Quer ajustar algo?' : 'Me diz o objetivo do ciclo e a frequência (dias) que eu monto.')
    onEvent({ type: 'done', text, model })
    return { text, rendered, model }
}
