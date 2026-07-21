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
import { formatIntensityTarget } from '@kinevo/shared/lib/cardio/zones'
import { CARDIO_PROTOCOLS, cardioProtocol } from '@kinevo/shared/lib/cardio/interval-protocols'
import { cardioTotalSeconds, summarizeSegments } from '@kinevo/shared/lib/cardio/segments'
import type { CardioConfig, CardioIntensityTarget, CardioSegment } from '@kinevo/shared/types/workout-items'
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
    'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3-flash-preview', 'gemini-2.5-flash',
])
const DEFAULT_BUILD_MODEL = 'gemini-3.6-flash'
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
        const typeTag = s.workout_type === 'cardio' ? ' [AERÓBIA]' : ''
        const items = (s.items ?? []).map(it => {
            if (it.cardio) {
                const c = it.cardio
                const desc = c.mode === 'phased' && c.segments?.length
                    ? `por fases (${c.segments.length}) ${summarizeSegments(c.segments)}`
                    : c.mode === 'interval' && c.intervals
                        ? `intervalado ${c.intervals.work_seconds}s/${c.intervals.rest_seconds}s ×${c.intervals.rounds}`
                        : `contínuo ${c.duration_minutes ?? '?'}min`
                return `    - [cardio] ${desc}${c.intensity && c.mode !== 'phased' ? ` (${c.intensity})` : ''}`
            }
            return `    - ${it.exercise_id} ${it.sets ?? '?'}x${it.reps ?? '?'}`
        }).join('\n')
        return `  Sessão ${i + 1}: "${s.name}"${typeTag} [dias ${days || '—'}]\n${items || '    (sem exercícios)'}`
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
        'PRESCRIÇÃO AVANÇADA (opcional — use quando elevar a qualidade, sem exagerar):',
        '- MÉTODOS (campo "method" do item): drop_set (queda de carga sem descanso — ótimo p/ finalizar isoladores), pyramid_down/pyramid_up (pirâmide de reps), 5x5 (força em compostos), top_backoff (série pesada + backoffs ~80%), cluster (rest-pause). Aplique em 1–2 exercícios-CHAVE por sessão quando fizer sentido; o resto fica em séries retas (sem method).',
        '- SUPERSETS (campo "superset_group"): p/ bi-set/tri-set, dê a MESMA tag (ex.: "A1") a itens CONSECUTIVOS (antagonistas ou economia de tempo). Um exercício em superset NÃO leva method.',
        '',
        'AERÓBIO:',
        '- SESSÃO AERÓBIA EXCLUSIVA (pedido tipo "3x força + 2x aeróbio zona 2"): crie a sessão com workout_type="cardio" e itens SÓ com o campo "cardio" (sem exercise_id). Bloco contínuo: { mode:"continuous", equipment (treadmill/bike/outdoor_run/rower/elliptical/…), duration_minutes OU objective:"distance"+distance_km }. Sessão aeróbia NÃO leva exercício de força; as regras 1–5 acima não se aplicam a ela.',
        '- INTENSIDADE: prefira o campo ESTRUTURADO — zone (1–5: Z1 recuperação, Z2 base aeróbia, Z3 moderado, Z4 limiar, Z5 VO2max; resolve na FCmáx do aluno automaticamente) OU rpe (1–10). Texto livre em intensity só quando nenhum dos dois se aplica.',
        '- INTERVALADO: prefira um protocol nomeado — tabata (20/10×8, all-out), hiit_15_15, hiit_30_30, hiit_40_20, norwegian_4x4 (4min/3min×4, limiar) — que já preenche intervals + intensidade sugerida. Só monte intervals manualmente quando nenhum protocolo servir.',
        '- POR FASES (mode:"phased" + segments): quando a sessão aeróbia tem estrutura em sequência — aquecimento + bloco principal + volta à calma, séries intervaladas diferentes em sequência, ou contínuo com intensidades variadas. Cada fase é { kind:"steady", duration_minutes, zone/rpe, label? } ou { kind:"interval", protocol OU intervals, zone/rpe? }. A intensidade vai POR FASE (não no bloco) e TODA fase deve ter zone OU rpe — não deixe fase sem alvo. Ex.: aeróbio 4×4 completo = steady 10min zone 1 → interval norwegian_4x4 → steady 5min zone 1.',
        '- Cardio no FIM de uma sessão de força: adicione um item com "cardio" no final da sessão normal (workout_type continua "strength").',
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
    /** FCmáx do aluno — resolve "Zona N" em bpm na string derivada do bloco aeróbio. */
    studentMaxHr?: number | null
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
    /** Uso de tokens do turno inteiro (todos os passos) — para metering na rota. */
    usage: { inputTokens: number; outputTokens: number }
}

export async function runCanvasTurn(args: RunCanvasTurnArgs): Promise<RunCanvasTurnResult> {
    const { trainerId, trainerName, studentId, studentName, studentMaxHr, message, history, exercises, currentProgram, onEvent } = args

    // Canvas é SEMPRE prescrição (montar/ajustar treino) → precisa do detalhe clínico
    // e dos check-ins para prescrever com segurança (restrições/dores).
    const studentContext = await buildChatContext(trainerId, trainerName, studentId, {
        includeMedical: true,
        includeCheckins: true,
    })
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
                    workout_type: z.enum(['strength', 'cardio']).optional()
                        .describe('Tipo da sessão. "cardio" = sessão aeróbia exclusiva (itens só com o campo cardio). Padrão: strength.'),
                    items: z.array(z.object({
                        exercise_id: z.string().optional().describe('exercise_id REAL do catálogo. Omitir apenas em itens cardio.'),
                        sets: z.number().optional().describe('Número de séries'),
                        reps: z.string().optional().describe('Reps (ex.: "8-12", "10", "AMRAP")'),
                        rest_seconds: z.number().optional().describe('Descanso entre séries (s)'),
                        notes: z.string().optional().describe('Observação curta'),
                        method: z.enum(['standard', 'pyramid_down', 'pyramid_up', 'drop_set', 'top_backoff', '5x5', 'cluster']).optional()
                            .describe('Método de série. standard=séries retas (padrão). drop_set=queda de carga; pyramid_down/up=pirâmide; 5x5=força; top_backoff=top+backoffs; cluster=rest-pause. Use só em 1–2 exercícios-chave/sessão.'),
                        superset_group: z.string().optional()
                            .describe('Tag p/ superset (ex.: "A1"). Itens CONSECUTIVOS com a MESMA tag viram um bi/tri-set. Não combine com method no mesmo item.'),
                        cardio: z.object({
                            mode: z.enum(['continuous', 'interval', 'phased'])
                                .describe("'phased' = sequência de fases (segments) executadas em ordem — ex.: 10min Z1 → Tabata → 5min Z1"),
                            equipment: z.enum(['treadmill', 'bike', 'elliptical', 'rower', 'stairmaster', 'jump_rope', 'outdoor_run', 'outdoor_bike', 'swimming', 'other']).optional(),
                            objective: z.enum(['time', 'distance']).optional(),
                            duration_minutes: z.number().optional(),
                            distance_km: z.number().optional(),
                            zone: z.number().int().min(1).max(5).optional()
                                .describe('Alvo ESTRUTURADO preferido: zona de FC Z1–Z5 (1=Recuperação 50–60% FCmáx, 2=Base aeróbia, 3=Moderado, 4=Limiar, 5=VO2max). Resolve na FCmáx do aluno.'),
                            rpe: z.number().int().min(1).max(10).optional()
                                .describe('Alvo estruturado alternativo: RPE 1–10 (use zone OU rpe, não os dois)'),
                            intensity: z.string().optional().describe('Texto livre de intensidade — só quando zone/rpe não se aplicam (ex.: "130-140bpm")'),
                            protocol: z.enum(CARDIO_PROTOCOLS.map(p => p.key) as [string, ...string[]]).optional()
                                .describe('Protocolo intervalado nomeado (tabata 20/10×8, hiit_15_15, hiit_30_30, hiit_40_20, norwegian_4x4 4min/3min×4) — preenche intervals + intensidade sugerida; dispensa o objeto intervals.'),
                            intervals: z.object({
                                work_seconds: z.number(),
                                rest_seconds: z.number(),
                                rounds: z.number(),
                            }).optional().describe('mode=interval sem protocol: obrigatório'),
                            segments: z.array(z.object({
                                kind: z.enum(['steady', 'interval']).describe("'steady' = fase contínua; 'interval' = bloco work/rest × rounds"),
                                label: z.string().optional().describe('Nome da fase (ex.: "Aquecimento", "Volta à calma")'),
                                duration_minutes: z.number().optional().describe('steady: duração da fase em minutos'),
                                protocol: z.enum(CARDIO_PROTOCOLS.map(p => p.key) as [string, ...string[]]).optional()
                                    .describe('interval: protocolo nomeado (preenche intervals + intensidade sugerida)'),
                                intervals: z.object({
                                    work_seconds: z.number(),
                                    rest_seconds: z.number(),
                                    rounds: z.number(),
                                }).optional().describe('interval sem protocol: obrigatório'),
                                zone: z.number().int().min(1).max(5).optional().describe('Intensidade da fase: zona Z1–Z5'),
                                rpe: z.number().int().min(1).max(10).optional().describe('Intensidade da fase: RPE 1–10'),
                                intensity: z.string().optional().describe('Texto livre de intensidade da fase'),
                            })).optional().describe('mode=phased: sequência de fases em ordem. Intensidade POR FASE (zone/rpe), não no bloco.'),
                            notes: z.string().optional(),
                        }).optional().describe('Quando presente, o item é um BLOCO AERÓBIO — exercise_id/sets/reps/method são ignorados.'),
                    })).describe('Itens na ordem (compostos primeiro; blocos cardio onde couber)'),
                })).describe('Sessões na ordem (Treino A, B, …)'),
            }),
            execute: async ({ name, duration_weeks, sessions }) => {
                let dropped = 0
                const cleanSessions: CanvasSessionDTO[] = (sessions ?? []).map(s => ({
                    name: s.name,
                    scheduled_days: Array.isArray(s.scheduled_days) ? s.scheduled_days.filter(d => d >= 0 && d <= 6) : [],
                    workout_type: s.workout_type === 'cardio' ? 'cardio' as const : 'strength' as const,
                    items: (s.items ?? [])
                        .filter(it => {
                            // Bloco cardio não referencia o catálogo; exercício precisa de id válido.
                            if (it.cardio) return true
                            const ok = !!it.exercise_id && catalogById.has(it.exercise_id)
                            if (!ok) dropped++
                            return ok
                        })
                        .map(it => {
                            if (it.cardio && it.cardio.mode === 'phased' && it.cardio.segments?.length) {
                                // Por fases: deriva a intensidade de cada fase
                                // (zona/RPE/protocolo, FCmáx do aluno) + totais.
                                const builtSegments: CardioSegment[] = it.cardio.segments
                                    .map(seg => {
                                        const segProtocol = seg.kind === 'interval' ? cardioProtocol(seg.protocol) : null
                                        let target: CardioIntensityTarget | null = null
                                        if (seg.zone != null) target = { type: 'zone', zone: seg.zone as 1 | 2 | 3 | 4 | 5 }
                                        else if (seg.rpe != null) target = { type: 'rpe', rpe: seg.rpe }
                                        else if (segProtocol) target = segProtocol.suggested_target
                                        const derived = target ? formatIntensityTarget(target, studentMaxHr ?? null) : null
                                        const out: CardioSegment = { kind: seg.kind }
                                        if (seg.label) out.label = seg.label
                                        if (seg.kind === 'steady' && seg.duration_minutes != null) out.duration_minutes = seg.duration_minutes
                                        if (seg.kind === 'interval') {
                                            const iv = seg.intervals ?? segProtocol?.intervals
                                            if (iv) out.intervals = iv
                                        }
                                        if (target) out.intensity_target = target
                                        if (derived) out.intensity = derived
                                        else if (seg.intensity) out.intensity = seg.intensity
                                        return out
                                    })
                                    .filter(seg => (seg.kind === 'steady' ? seg.duration_minutes != null : !!seg.intervals))
                                const totalSeconds = cardioTotalSeconds({ mode: 'phased', segments: builtSegments } as CardioConfig)
                                return {
                                    exercise_id: null,
                                    sets: null,
                                    reps: null,
                                    rest_seconds: null,
                                    notes: null,
                                    method: null,
                                    superset_group: null,
                                    cardio: {
                                        mode: 'phased' as const,
                                        equipment: it.cardio.equipment ?? null,
                                        objective: null,
                                        duration_minutes: totalSeconds > 0 ? Math.max(1, Math.round(totalSeconds / 60)) : null,
                                        distance_km: null,
                                        intensity: summarizeSegments(builtSegments) || null,
                                        intensity_target: null,
                                        intervals: null,
                                        protocol_key: null,
                                        segments: builtSegments,
                                        notes: it.cardio.notes ?? null,
                                    },
                                }
                            }
                            if (it.cardio) {
                                // Protocolo nomeado → números + selo; zone/rpe → alvo
                                // estruturado + string derivada (FCmáx do aluno).
                                const protocolDef = cardioProtocol(it.cardio.protocol)
                                const intervals = it.cardio.intervals ?? protocolDef?.intervals ?? null
                                let target: CardioIntensityTarget | null = null
                                if (it.cardio.zone != null) target = { type: 'zone', zone: it.cardio.zone as 1 | 2 | 3 | 4 | 5 }
                                else if (it.cardio.rpe != null) target = { type: 'rpe', rpe: it.cardio.rpe }
                                else if (protocolDef) target = protocolDef.suggested_target
                                const derived = target ? formatIntensityTarget(target, studentMaxHr ?? null) : null
                                return {
                                    exercise_id: null,
                                    sets: null,
                                    reps: null,
                                    rest_seconds: null,
                                    notes: null,
                                    method: null,
                                    superset_group: null,
                                    cardio: {
                                        // 'phased' sem segments não se sustenta — degrada pra contínuo.
                                        mode: protocolDef ? 'interval' as const : it.cardio.mode === 'phased' ? 'continuous' as const : it.cardio.mode,
                                        equipment: it.cardio.equipment ?? null,
                                        objective: it.cardio.objective ?? null,
                                        duration_minutes: it.cardio.duration_minutes ?? null,
                                        distance_km: it.cardio.distance_km ?? null,
                                        intensity: derived ?? it.cardio.intensity ?? null,
                                        intensity_target: target,
                                        intervals,
                                        protocol_key: protocolDef?.key ?? null,
                                        notes: it.cardio.notes ?? null,
                                    },
                                }
                            }
                            return {
                                exercise_id: it.exercise_id,
                                sets: it.sets ?? null,
                                reps: it.reps ?? null,
                                rest_seconds: it.rest_seconds ?? null,
                                notes: it.notes ?? null,
                                method: it.method && it.method !== 'standard' ? it.method : null,
                                superset_group: it.superset_group?.trim() || null,
                            }
                        }),
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
    // totalUsage = soma de TODOS os passos (buscas + render), não só o último.
    const usage = {
        inputTokens: result.totalUsage?.inputTokens ?? 0,
        outputTokens: result.totalUsage?.outputTokens ?? 0,
    }
    return { text, rendered, model, usage }
}
