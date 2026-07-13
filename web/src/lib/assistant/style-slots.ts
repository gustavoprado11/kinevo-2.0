/**
 * Roteiro da entrevista de estilo — ordem FIXA, uma pergunta por turno.
 *
 * O roteiro é declarativo de propósito: a ROTA (não o modelo) é a fonte de
 * verdade do progresso. A cada turno recomputamos "qual é o primeiro slot
 * pendente" a partir do que já foi minerado + respondido, e é isso que vai no
 * prompt. Assim a entrevista sempre termina, sempre na mesma ordem, e retomar
 * uma conversa abandonada cai no slot certo.
 *
 * Spec: web/specs/active/assistente-estilo-prescricao.md §6.2
 */
import type { PrescriptionStyle } from '@kinevo/shared/types/prescription'

export const STYLE_SLOT_IDS = [
    'split',
    'reps',
    'rest',
    'volume',
    'methods',
    'supersets',
    'progression',
    'warmup',
    'notes',
] as const

export type StyleSlotId = (typeof STYLE_SLOT_IDS)[number]

export interface StyleSlot {
    id: StyleSlotId
    /** O que perguntar (o modelo reescreve com naturalidade, mas o teor é este). */
    question: string
    /** Opções sugeridas — viram os botões clicáveis. */
    options: string[]
    multiple: boolean
    /** Campos do estilo que este slot preenche — se a mineração já os trouxe, pula. */
    fills: Array<keyof PrescriptionStyle>
}

/**
 * Os 6 primeiros slots são MINERÁVEIS (o programa que o treinador já montou
 * responde). Os 3 últimos são filosofia: nenhum programa conta como o treinador
 * PENSA a progressão ou o aquecimento — sempre pergunta.
 */
export const STYLE_SLOTS: readonly StyleSlot[] = [
    {
        id: 'split',
        question: 'Como você costuma dividir os treinos da semana?',
        options: [
            'PPL (push/pull/legs)',
            'Upper/Lower',
            'Full-body',
            'Por foco (ex.: "Inferior — Glúteo")',
            'ABC / letras',
        ],
        multiple: false,
        fills: ['splits_by_frequency', 'session_naming'],
    },
    {
        id: 'reps',
        question: 'Que faixas de repetições você prefere?',
        options: [
            'Compostos 4–6, acessórios 10–12',
            'Compostos 6–8, acessórios 10–15',
            'Compostos 8–12, acessórios 12–15',
        ],
        multiple: false,
        fills: ['reps_compound', 'reps_accessory'],
    },
    {
        id: 'rest',
        question: 'E os descansos?',
        options: [
            'Longos (compostos 2–3min, acessórios 60–90s)',
            'Moderados (compostos 90s–2min, acessórios 45–60s)',
            'Curtos (compostos 60–90s, acessórios 30–45s)',
        ],
        multiple: false,
        fills: ['rest_compound_seconds', 'rest_accessory_seconds'],
    },
    {
        id: 'volume',
        question: 'Qual é a sua postura de volume semanal?',
        options: [
            'Conservador (menos séries, mais qualidade)',
            'Moderado',
            'Agressivo (perto do teto)',
        ],
        multiple: false,
        fills: ['weekly_sets_emphasized', 'weekly_sets_principal', 'weekly_sets_small'],
    },
    {
        id: 'methods',
        question: 'Que métodos avançados você usa na prescrição?',
        options: [
            'Drop-set',
            'Pirâmide',
            'Cluster (rest-pause)',
            'Top + backoff',
            '5×5',
            'Nenhum — séries retas',
        ],
        multiple: true,
        fills: ['methods_used', 'methods_avoided'],
    },
    {
        id: 'supersets',
        question: 'Com que frequência você usa supersets?',
        options: ['Frequente', 'Ocasional', 'Raro ou nunca'],
        multiple: false,
        fills: ['superset_usage'],
    },
    {
        id: 'progression',
        question: 'Como você progride a carga do aluno?',
        options: [
            'Dupla progressão (reps até o teto, depois carga)',
            'Percentual de 1RM',
            'RIR / RPE',
            'Pela sensação do aluno',
        ],
        multiple: false,
        fills: ['progression'],
    },
    {
        id: 'warmup',
        question: 'Como é o aquecimento nos seus treinos?',
        options: [
            'Séries de aproximação no primeiro composto',
            'Cardio leve + mobilidade',
            'Direto ao trabalho',
        ],
        multiple: false,
        fills: ['warmup'],
    },
    {
        id: 'notes',
        question: 'Algo mais que eu deva seguir sempre ao montar seus treinos?',
        options: ['Nada a acrescentar'],
        multiple: false,
        fills: ['special_populations', 'equipment_notes', 'notes'],
    },
] as const

export function slotById(id: StyleSlotId): StyleSlot | undefined {
    return STYLE_SLOTS.find((s) => s.id === id)
}
