/**
 * style-interview — o turno da entrevista de estilo.
 *
 * É um MODO do assistente, não um motor novo: mesma persona, mesmo streaming,
 * mesmas parts (question/proposal) que a UI já sabe renderizar. O que muda é o
 * que ele NÃO carrega — e é essa a razão de existir deste arquivo:
 *
 *  - sem ponte MCP / subsetting / read-guard / guarda de homônimos: a entrevista
 *    não lê nem escreve dados do treinador (a mineração já aconteceu server-side);
 *  - sem contexto dinâmico (alunos, insights): nada disso importa aqui;
 *  - sem metering (D5): configurar o estilo é investimento do treinador na
 *    plataforma, não uso — não consome crédito. O turn-trace continua, para custo.
 *
 * As 3 tools locais:
 *  - `perguntar_estilo`   — client tool (sem execute) → vira QuestionRequest na UI,
 *    com o `slot` devolvido para a rota saber o que a próxima resposta responde;
 *  - `propor_ao_treinador` — a proposta editável que a UI já renderiza;
 *  - `salvar_estilo`      — a ÚNICA com execute: sanitiza (clamps!) e grava.
 *
 * Spec: web/specs/active/assistente-estilo-prescricao.md §6.3
 */
import { streamText, tool, jsonSchema, stepCountIs, type ToolSet } from 'ai'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { PrescriptionStyle } from '@kinevo/shared/types/prescription'
import type { QuestionRequest, ProposalRequest } from '@/lib/assistant/hitl-types'
import { PROMPT_VERSION } from '@/lib/assistant/system-prompt'
import { recordTurnTrace } from '@/lib/assistant/turn-trace'
import { sanitizeStyle } from '@/lib/assistant/style-block'
import { STYLE_SLOT_IDS, type StyleSlotId } from '@/lib/assistant/style-slots'
import {
    buildStyleInterviewInstructions,
    saveStyleState,
    type StyleState,
} from '@/lib/assistant/style-state'

export interface StyleInterviewInput {
    admin: SupabaseClient
    trainerId: string
    trainerName: string | null
    conversationId: string
    input: string
    state: StyleState
    history?: Array<{ role: 'user' | 'assistant'; content: string }>
    model: string
    /** Provider resolvido pelo motor (mesma função do turno normal). */
    provider: (model: string) => Parameters<typeof streamText>[0]['model']
    onProgress?: (label: string) => void
    onTextDelta?: (delta: string) => void
    onTextReset?: () => void
    abortSignal?: AbortSignal
}

export interface StyleInterviewResult {
    text: string
    question: QuestionRequest | null
    proposal: ProposalRequest | null
    /** Slot que a pergunta deste turno cobre — a rota grava a próxima resposta nele. */
    slot: StyleSlotId | null
    /** true quando o estilo foi aprovado e gravado neste turno. */
    saved: boolean
}

const perguntarEstiloSchema = jsonSchema<{
    slot: string
    pergunta: string
    opcoes: string[]
    multipla?: boolean
}>({
    type: 'object',
    properties: {
        slot: {
            type: 'string',
            enum: [...STYLE_SLOT_IDS],
            description: 'O slot do roteiro que esta pergunta cobre.',
        },
        pergunta: { type: 'string', description: 'A pergunta ao treinador, curta e direta.' },
        opcoes: { type: 'array', items: { type: 'string' }, description: '2 a 6 opções curtas.' },
        multipla: { type: 'boolean', description: 'true se ele pode escolher várias.' },
    },
    required: ['slot', 'pergunta', 'opcoes'],
})

const proporEstiloSchema = jsonSchema<{ itens: { rotulo: string; valor: string }[]; rotulo_acao?: string }>({
    type: 'object',
    properties: {
        itens: {
            type: 'array',
            description: 'Linhas rótulo+valor EDITÁVEIS com o estilo completo.',
            items: {
                type: 'object',
                properties: {
                    rotulo: { type: 'string', description: 'Ex.: "Split (5x/semana)", "Reps — compostos".' },
                    valor: { type: 'string', description: 'O valor proposto, editável pelo treinador.' },
                },
                required: ['rotulo', 'valor'],
            },
        },
        rotulo_acao: { type: 'string', description: 'Rótulo do botão. Default: "Aprovar".' },
    },
    required: ['itens'],
})

/** Schema do estilo final. Frouxo de propósito: quem aperta é o sanitizeStyle. */
const salvarEstiloSchema = jsonSchema<Record<string, unknown>>({
    type: 'object',
    properties: {
        splits_by_frequency: {
            type: 'object',
            description: 'Split por frequência semanal. Ex.: {"5":"PPL + Upper/Lower"}.',
            additionalProperties: { type: 'string' },
        },
        session_naming: { type: 'string' },
        exercises_per_session: {
            type: 'object',
            properties: { min: { type: 'number' }, max: { type: 'number' } },
        },
        reps_compound: { type: 'string', description: 'Ex.: "6–8".' },
        reps_accessory: { type: 'string', description: 'Ex.: "10–15".' },
        rest_compound_seconds: {
            type: 'object',
            properties: { min: { type: 'number' }, max: { type: 'number' } },
        },
        rest_accessory_seconds: {
            type: 'object',
            properties: { min: { type: 'number' }, max: { type: 'number' } },
        },
        weekly_sets_emphasized: {
            type: 'object',
            description: 'Séries/semana no grupo enfatizado. NUNCA acima de 20.',
            properties: { min: { type: 'number' }, max: { type: 'number' } },
        },
        weekly_sets_principal: {
            type: 'object',
            properties: { min: { type: 'number' }, max: { type: 'number' } },
        },
        weekly_sets_small: {
            type: 'object',
            properties: { min: { type: 'number' }, max: { type: 'number' } },
        },
        methods_used: {
            type: 'array',
            items: { type: 'string' },
            description: 'method_keys reais: drop_set, cluster, pyramid_down, pyramid_up, top_backoff, 5x5.',
        },
        methods_avoided: { type: 'array', items: { type: 'string' } },
        superset_usage: { type: 'string', enum: ['frequente', 'ocasional', 'raro'] },
        favorite_exercises: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    group: { type: 'string' },
                    names: { type: 'array', items: { type: 'string' } },
                },
                required: ['group', 'names'],
            },
        },
        avoided_exercises: { type: 'array', items: { type: 'string' } },
        equipment_notes: { type: 'string' },
        progression: { type: 'string' },
        warmup: { type: 'string' },
        special_populations: { type: 'string' },
        notes: { type: 'string' },
    },
})

/**
 * Grava o estilo aprovado. Escrita reversível de configuração do PRÓPRIO
 * treinador — não é CONFIRM_TOOL: a proposta aprovada já FOI a confirmação.
 */
async function persistStyle(
    admin: SupabaseClient,
    trainerId: string,
    conversationId: string,
    state: StyleState,
    raw: unknown,
): Promise<{ saved: boolean; style?: PrescriptionStyle }> {
    const style = sanitizeStyle(raw, {
        source: state.mined ? 'hybrid' : 'interview',
        mined: state.mined
            ? { programs_analyzed: state.programsAnalyzed, last_mined_at: new Date().toISOString() }
            : null,
    })

    const { error } = await admin
        .from('trainers')
        .update({ prescription_style: style })
        .eq('id', trainerId)

    if (error) {
        console.error('[style-interview] falha ao salvar o estilo:', error.message)
        return { saved: false }
    }

    // Entrevista concluída: o rascunho morre para uma reabertura da conversa não
    // reviver um roteiro pela metade.
    await saveStyleState(admin, conversationId, null)
    return { saved: true, style }
}

export async function runStyleInterviewTurn(
    opts: StyleInterviewInput,
): Promise<StyleInterviewResult> {
    const { admin, trainerId, trainerName, conversationId, input, state } = opts

    let saved = false

    const tools: ToolSet = {
        perguntar_estilo: tool({
            description:
                'Faz UMA pergunta do roteiro de estilo ao treinador, com opções clicáveis. Informe o `slot` correspondente. Não descreva os botões; apenas chame a tool.',
            inputSchema: perguntarEstiloSchema,
        }),
        propor_ao_treinador: tool({
            description:
                'Apresenta o ESTILO COMPLETO como proposta editável (linhas rótulo+valor) para o treinador aprovar ou ajustar. Use só quando o roteiro terminar.',
            inputSchema: proporEstiloSchema,
        }),
        salvar_estilo: tool({
            description:
                'Salva o estilo APROVADO pelo treinador. Chame apenas depois que ele aprovar a proposta, com os valores finais (já com as edições dele).',
            inputSchema: salvarEstiloSchema,
            execute: async (args: unknown) => {
                const result = await persistStyle(admin, trainerId, conversationId, state, args)
                saved = result.saved
                return result.saved
                    ? { saved: true, message: 'Estilo salvo. Os próximos programas seguem esse padrão.' }
                    : { saved: false, message: 'Não consegui salvar o estilo agora.' }
            },
        }),
    }

    const system = buildStyleInterviewInstructions(state, trainerName)
    const messages = [
        ...(opts.history ?? []).slice(-20),
        { role: 'user' as const, content: input },
    ]

    const stream = streamText({
        model: opts.provider(opts.model),
        system,
        messages,
        maxOutputTokens: 2000,
        temperature: 0.3,
        // Um turno da entrevista é: uma pergunta, OU a proposta, OU o save. 4 passos
        // cobrem com folga (e barram qualquer tentativa de "entrevistar sozinho").
        stopWhen: stepCountIs(4),
        tools,
        abortSignal: opts.abortSignal,
    })

    let streamError: unknown = null
    let aborted = false
    let sawText = false
    for await (const part of stream.fullStream) {
        if (part.type === 'text-delta') {
            if (part.text) {
                sawText = true
                opts.onTextDelta?.(part.text)
            }
        } else if (part.type === 'start-step') {
            if (sawText) {
                sawText = false
                opts.onTextReset?.()
            }
        } else if (part.type === 'tool-input-start') {
            if (part.toolName === 'salvar_estilo') opts.onProgress?.('Salvando seu estilo…')
        } else if (part.type === 'error') {
            streamError = part.error
        } else if (part.type === 'abort') {
            aborted = true
        }
    }

    if (aborted) {
        const e = new Error('Turno interrompido pelo treinador.')
        e.name = 'AbortError'
        throw e
    }
    if (streamError) {
        throw streamError instanceof Error ? streamError : new Error(String(streamError))
    }

    const [text, steps, totalUsage, toolCalls] = await Promise.all([
        stream.text,
        stream.steps,
        stream.totalUsage,
        stream.toolCalls,
    ])

    const executedIds = new Set(
        steps.flatMap((s) => s.toolResults ?? []).map((r) => (r as { toolCallId: string }).toolCallId),
    )

    let question: QuestionRequest | null = null
    let proposal: ProposalRequest | null = null
    let slot: StyleSlotId | null = null

    for (const tc of toolCalls) {
        if (executedIds.has(tc.toolCallId)) continue

        if (tc.toolName === 'perguntar_estilo') {
            const a = (tc.input ?? {}) as { slot?: unknown; pergunta?: unknown; opcoes?: unknown; multipla?: unknown }
            const options = Array.isArray(a.opcoes)
                ? a.opcoes.map((o) => String(o).trim()).filter(Boolean).slice(0, 6)
                : []
            const askedSlot = STYLE_SLOT_IDS.find((s) => s === a.slot) ?? null
            if (typeof a.pergunta === 'string' && a.pergunta.trim() && options.length > 0 && askedSlot) {
                question = {
                    question: a.pergunta.trim(),
                    options,
                    multiple: a.multipla === true,
                    allowOther: true,
                }
                slot = askedSlot
            }
        }

        if (tc.toolName === 'propor_ao_treinador') {
            const a = (tc.input ?? {}) as { itens?: unknown; rotulo_acao?: unknown }
            const items = Array.isArray(a.itens)
                ? a.itens
                      .map((it) => {
                          const o = (it ?? {}) as { rotulo?: unknown; valor?: unknown }
                          return { label: String(o.rotulo ?? '').trim(), value: String(o.valor ?? '').trim() }
                      })
                      .filter((it) => it.label.length > 0)
                      .slice(0, 20)
                : []
            if (items.length > 0) {
                proposal = {
                    items,
                    approveLabel:
                        typeof a.rotulo_acao === 'string' && a.rotulo_acao.trim()
                            ? a.rotulo_acao.trim()
                            : 'Aprovar meu estilo',
                }
            }
        }
    }

    const finalText =
        text ||
        (question?.question ?? '') ||
        (proposal ? 'Confira o seu estilo abaixo — pode ajustar qualquer valor antes de aprovar.' : '') ||
        (saved ? 'Estilo salvo. A partir de agora eu monto os treinos assim.' : '')

    // D5: SEM metering (nenhum crédito consumido). O trace continua — o custo do
    // LLM é real e precisa aparecer, marcado para não se misturar aos turnos de uso.
    await recordTurnTrace(admin, {
        trainerId,
        kind: 'turn',
        surface: 'workspace',
        route: '/assistente (entrevista de estilo)',
        promptVersion: PROMPT_VERSION,
        model: opts.model,
        input,
        output: finalText,
        tools: toolCalls.map((tc) => ({ toolName: tc.toolName, args: tc.input as Record<string, unknown>, ok: true })),
        intents: ['style_interview'],
        credits: 0,
        inputTokens: totalUsage?.inputTokens ?? 0,
        outputTokens: totalUsage?.outputTokens ?? 0,
    })

    return { text: finalText, question, proposal, slot, saved }
}
