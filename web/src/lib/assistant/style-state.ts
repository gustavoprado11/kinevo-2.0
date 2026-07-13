/**
 * style-state — o progresso da entrevista de estilo, guardado na CONVERSA.
 *
 * O modelo NÃO é fonte de verdade do progresso: a cada turno a rota grava a
 * resposta do slot pendente e recomputa, em código, qual é o próximo. É isso que
 * torna a entrevista terminável (D2) — o modelo pode alucinar uma pergunta a
 * mais, mas o roteiro que ele recebe vem sempre do estado, não da memória dele.
 *
 * Vive em `ai_conversations.style_state` (migration 248) e só é apagado quando o
 * estilo é aprovado e salvo em `trainers.prescription_style`.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { PrescriptionStyle } from '@kinevo/shared/types/prescription'
import { STYLE_SLOTS, type StyleSlotId } from '@/lib/assistant/style-slots'

export interface StyleState {
    /** O que a mineração deduziu dos programas do treinador (ainda não aprovado). */
    mined: Partial<PrescriptionStyle> | null
    /** Slots que a mineração respondeu — não são perguntados. */
    minedSlots: StyleSlotId[]
    programsAnalyzed: number
    /** Respostas do treinador, em texto (é o que a UI devolve). */
    answers: Partial<Record<StyleSlotId, string>>
    /** Slot que a ÚLTIMA pergunta cobriu — a próxima mensagem do treinador é a resposta dele. */
    pendingSlot: StyleSlotId | null
}

export function emptyStyleState(): StyleState {
    return { mined: null, minedSlots: [], programsAnalyzed: 0, answers: {}, pendingSlot: null }
}

/** Primeiro slot que ninguém respondeu — nem a mineração, nem o treinador. */
export function nextPendingSlot(state: StyleState): StyleSlotId | null {
    for (const slot of STYLE_SLOTS) {
        if (state.minedSlots.includes(slot.id)) continue
        if (state.answers[slot.id]) continue
        return slot.id
    }
    return null
}

export function isInterviewComplete(state: StyleState): boolean {
    return nextPendingSlot(state) === null
}

/** Quantas perguntas ainda faltam — usado no prompt para o modelo não se perder. */
export function remainingSlots(state: StyleState): StyleSlotId[] {
    return STYLE_SLOTS.filter(
        (s) => !state.minedSlots.includes(s.id) && !state.answers[s.id],
    ).map((s) => s.id)
}

// ---------------------------------------------------------------------------
// Prompt do entrevistador
// ---------------------------------------------------------------------------

function describeMined(mined: Partial<PrescriptionStyle> | null, slot: StyleSlotId): string {
    if (!mined) return ''
    const parts: string[] = []
    const push = (label: string, value: unknown) => {
        if (value === null || value === undefined) return
        parts.push(`${label}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`)
    }

    switch (slot) {
        case 'split':
            push('splits', mined.splits_by_frequency)
            push('nomes', mined.session_naming)
            break
        case 'reps':
            push('compostos', mined.reps_compound)
            push('acessórios', mined.reps_accessory)
            break
        case 'rest':
            push('compostos', mined.rest_compound_seconds)
            push('acessórios', mined.rest_accessory_seconds)
            break
        case 'volume':
            push('enfatizado', mined.weekly_sets_emphasized)
            push('principal', mined.weekly_sets_principal)
            push('pequeno', mined.weekly_sets_small)
            break
        case 'methods':
            push('métodos', mined.methods_used)
            break
        case 'supersets':
            push('uso', mined.superset_usage)
            break
        default:
            break
    }
    return parts.join(', ')
}

/**
 * System prompt do modo entrevista. Traz o roteiro INTEIRO com o estado de cada
 * slot — o modelo não decide o que já foi feito, ele lê.
 */
export function buildStyleInterviewInstructions(state: StyleState, trainerName?: string | null): string {
    const pending = nextPendingSlot(state)

    const roteiro = STYLE_SLOTS.map((slot, i) => {
        const n = i + 1
        if (state.answers[slot.id]) {
            return `${n}. ${slot.id} — RESPONDIDO: "${state.answers[slot.id]}"`
        }
        if (state.minedSlots.includes(slot.id)) {
            const mined = describeMined(state.mined, slot.id)
            return `${n}. ${slot.id} — JÁ MINERADO dos programas dele (${mined || 'sem detalhe'}) → NÃO pergunte`
        }
        return `${n}. ${slot.id} — PENDENTE: ${slot.question} (opções: ${slot.options.join(' | ')}${slot.multiple ? '; múltipla escolha' : ''})`
    }).join('\n')

    const minedIntro = state.mined
        ? `Você já analisou ${state.programsAnalyzed} programas que ${trainerName ?? 'o treinador'} montou e deduziu boa parte do estilo dele (marcado como MINERADO abaixo). Não pergunte o que já sabe.`
        : `Não há programas suficientes para deduzir o estilo (${state.programsAnalyzed} encontrados; o piso é 5), então o roteiro inteiro precisa ser perguntado.`

    const acao = pending
        ? `PRÓXIMA AÇÃO: chame \`perguntar_estilo\` com slot="${pending}" e faça SÓ essa pergunta. Uma pergunta por turno — não junte duas, não antecipe a próxima.`
        : `PRÓXIMA AÇÃO: o roteiro acabou. Chame \`propor_ao_treinador\` com o estilo COMPLETO (um item por campo relevante: split, reps, descansos, volume, métodos, supersets, favoritos, progressão, aquecimento, observações), juntando o que foi MINERADO com o que ele RESPONDEU. Os valores são editáveis — é a última chance dele corrigir a mineração. Depois que ele aprovar (a mensagem dele começa com "Aprovado"), chame \`salvar_estilo\` com os valores finais.`

    return `# Identidade
Você está conduzindo a configuração do ESTILO DE PRESCRIÇÃO de ${trainerName ?? 'um personal trainer'} no Kinevo.
Ao final, o Assistente passa a montar programas do jeito que ELE monta. É uma entrevista curta, não uma conversa livre.

# Como se comportar
- Tom: direto, profissional, sem bajulação. Sem emojis.
- Uma pergunta por turno, na ordem do roteiro, usando SEMPRE a tool \`perguntar_estilo\` (nunca pergunte em texto solto).
- Não invente slots, não pule a ordem, não repita o que já foi respondido.
- Não use tools do Kinevo aqui (você não tem nenhuma): esta conversa não lê nem escreve dados do treinador.
- No texto que acompanha a pergunta, seja breve (uma linha de contexto, no máximo).

# Situação
${minedIntro}

# Roteiro (ordem fixa)
${roteiro}

${acao}`
}

// ---------------------------------------------------------------------------
// Persistência (service role — RLS das conversas é select-only)
// ---------------------------------------------------------------------------

export async function saveStyleState(
    admin: SupabaseClient,
    conversationId: string,
    state: StyleState | null,
): Promise<void> {
    const { error } = await admin
        .from('ai_conversations')
        .update({ style_state: state })
        .eq('id', conversationId)
    if (error) console.error('[style-state] falha ao salvar:', error.message)
}

export function parseStyleState(raw: unknown): StyleState {
    if (!raw || typeof raw !== 'object') return emptyStyleState()
    const s = raw as Partial<StyleState>
    return {
        mined: (s.mined as Partial<PrescriptionStyle> | null) ?? null,
        minedSlots: Array.isArray(s.minedSlots) ? (s.minedSlots as StyleSlotId[]) : [],
        programsAnalyzed: typeof s.programsAnalyzed === 'number' ? s.programsAnalyzed : 0,
        answers: (s.answers as Partial<Record<StyleSlotId, string>>) ?? {},
        pendingSlot: (s.pendingSlot as StyleSlotId | null) ?? null,
    }
}
