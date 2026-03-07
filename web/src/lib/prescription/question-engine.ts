// ============================================================================
// Kinevo Prescription Engine — Conditional Question Engine
// ============================================================================
// Server-side question selection based on student profile flags.
// Guarantees critical questions are always asked, regardless of AI behavior.
// AI can complement with up to 1 extra question (total max: 3).

import type {
    StudentPrescriptionProfile,
    PrescriptionAgentQuestion,
} from '@kinevo/shared/types/prescription'

import type { EnrichedStudentContext } from './context-enricher'
import type { VolumeTradeoffInfo } from './constraints-engine'
import type { QuestionnaireData } from './questionnaire-mapper'

// ============================================================================
// Types
// ============================================================================

interface ConditionalQuestion {
    /** Fixed ID — used for answer matching */
    id: string
    /** Selection priority (lower = more important) */
    priority: number
    /** Evaluates whether this question should be included */
    condition: (
        profile: StudentPrescriptionProfile,
        context: EnrichedStudentContext,
        tradeoff?: VolumeTradeoffInfo,
        questionnaire?: QuestionnaireData | null,
    ) => boolean
    /** Builds the question (allows interpolation of student data) */
    build: (
        profile: StudentPrescriptionProfile,
        context: EnrichedStudentContext,
        tradeoff?: VolumeTradeoffInfo,
        questionnaire?: QuestionnaireData | null,
    ) => PrescriptionAgentQuestion
}

// ============================================================================
// Question Pool
// ============================================================================

export const QUESTION_POOL: ConditionalQuestion[] = [
    // ── P0 — Volume trade-off (when budget exceeds capacity) ──
    {
        id: 'volume_tradeoff',
        priority: 0,
        condition: (_profile, _context, tradeoff) => {
            return tradeoff?.needsTradeoff === true
        },
        build: (_profile, context, tradeoff) => {
            const t = tradeoff!
            const estTimeMore = Math.round((t.exercisesPerSession + 1) * 9)
            return {
                id: 'volume_tradeoff',
                question: `O volume ideal para ${context.student_name} (nível ${t.level}) não cabe em ${t.frequency} dias com ${t.exercisesPerSession} exercícios por sessão. Como prefere resolver?`,
                context: `Budget mínimo: ${t.totalBudgetMin} séries/sem. Capacidade estimada: ${t.totalWeeklySets} séries/sem.`,
                type: 'single_choice' as const,
                options: [
                    `Aumentar para ${t.exercisesPerSession + 1} exercícios por sessão (sessões de ~${estTimeMore}min)`,
                    `Manter ${t.exercisesPerSession} exercícios — priorizar compostos multiarticulares e aceitar volume reduzido`,
                    ...(t.frequency < 6 ? [`Adicionar 1 dia de treino (passar para ${t.frequency + 1} dias/semana)`] : []),
                ],
            }
        },
    },

    // ── P1 — Equipment (mandatory if missing) ──
    // Skip if questionnaire answered with equipment and no divergence
    {
        id: 'equipment',
        priority: 1,
        condition: (profile, _context, _tradeoff, questionnaire) => {
            if (questionnaire?.suggested_equipment && !questionnaire.divergences.some(d => d.field === 'equipment')) {
                return false // Questionnaire already provided equipment info
            }
            return (
                !profile.available_equipment ||
                profile.available_equipment.length === 0 ||
                profile.available_equipment.includes('')
            )
        },
        build: (_profile, context) => ({
            id: 'equipment',
            question: `Qual é o ambiente de treino de ${context.student_name}?`,
            context: 'Necessário para selecionar exercícios adequados',
            type: 'single_choice' as const,
            options: [
                'Academia completa',
                'Home gym completo (barra, halteres, polia)',
                'Home gym básico (halteres, banco)',
                'Ao ar livre',
                'Apenas peso corporal',
            ],
            allows_text: false,
        }),
    },

    // ── P2 — Ambiguous medical restriction ──
    // Triggered when there's a restriction with severity 'moderate' or 'mild'
    // Skip if questionnaire already provided detailed injury info
    {
        id: 'restriction_detail',
        priority: 2,
        condition: (profile, _context, _tradeoff, questionnaire) => {
            if (questionnaire?.has_injury && questionnaire.injury_description) {
                return false // Questionnaire already provided injury details
            }
            return (
                profile.medical_restrictions?.some(
                    (r) => r.severity === 'moderate' || r.severity === 'mild',
                ) ?? false
            )
        },
        build: (profile, context) => {
            const restriction = profile.medical_restrictions?.find(
                (r) => r.severity === 'moderate' || r.severity === 'mild',
            )
            const conditionName = restriction?.description || 'a condição registrada'
            return {
                id: 'restriction_detail',
                question: `Sobre a restrição de ${context.student_name} (${conditionName}): há exercícios específicos ou amplitudes de movimento a evitar?`,
                context: 'Informação necessária para garantir segurança na prescrição',
                type: 'text' as const,
                placeholder: 'Ex: evitar flexão de joelho acima de 90°, não fazer exercícios de impacto...',
            }
        },
    },

    // ── P3 — Critical adherence ──
    // Triggered when adherence < 50%
    {
        id: 'adherence_barrier',
        priority: 3,
        condition: (_profile, context) => {
            const adherence = computeAdherence(context)
            return adherence < 50
        },
        build: (_profile, context) => ({
            id: 'adherence_barrier',
            question: `A aderência de ${context.student_name} está em ${computeAdherence(context)}% nas últimas 4 semanas. Qual a principal barreira?`,
            context: 'Entender a barreira permite ajustar complexidade e volume do programa',
            type: 'single_choice' as const,
            options: [
                'Falta de tempo / agenda imprevisível',
                'Falta de motivação',
                'Dor ou desconforto durante os treinos',
                'Programa anterior muito complexo ou longo',
                'Outro motivo',
            ],
            allows_text: true,
            placeholder: 'Se marcou "Outro", descreva aqui...',
        }),
    },

    // ── P4 — Duration mismatch ──
    // Triggered when avg session duration > target * 1.2
    {
        id: 'duration_mismatch',
        priority: 4,
        condition: (profile, context) => {
            const avgDuration = context.session_patterns?.avg_session_duration_minutes
            const target = profile.session_duration_minutes
            if (!avgDuration || !target) return false
            return avgDuration > target * 1.2
        },
        build: (profile, context) => {
            const avg = Math.round(context.session_patterns?.avg_session_duration_minutes || 0)
            const target = profile.session_duration_minutes || 60
            return {
                id: 'duration_mismatch',
                question: `As sessões de ${context.student_name} duram em média ${avg}min (acima dos ${target}min configurados). Ajustar o programa para qual duração?`,
                context: 'Alinhar duração real evita que o aluno corte exercícios por conta própria',
                type: 'single_choice' as const,
                options: [
                    `${target}min — encurtar o programa`,
                    `${avg}min — ajustar para a duração real`,
                    'Sem preferência — manter configuração atual',
                ],
            }
        },
    },

    // ── P5 — First program (no history) ──
    {
        id: 'first_program',
        priority: 5,
        condition: (_profile, context) => {
            return (
                !context.previous_programs ||
                context.previous_programs.length === 0
            )
        },
        build: (_profile, context) => ({
            id: 'first_program',
            question: `${context.student_name} não tem programa anterior no Kinevo. Há alguma preferência ou aversão a exercícios que devemos considerar?`,
            context: 'Sem histórico para inferir preferências — input do treinador é essencial',
            type: 'text' as const,
            placeholder: 'Ex: gosta de exercícios com halteres, não gosta de leg press, prefere treinos curtos...',
        }),
    },

    // ── P6 — Weight loss goal → cardio inclusion ──
    {
        id: 'cardio_inclusion',
        priority: 6,
        condition: (profile) => {
            return profile.goal === 'weight_loss'
        },
        build: (_profile, context) => ({
            id: 'cardio_inclusion',
            question: `O objetivo de ${context.student_name} é perda de peso. Incluir recomendação de cardio no programa?`,
            context: 'Cardio complementar pode ser integrado ou o aluno já faz por conta',
            type: 'single_choice' as const,
            options: [
                'Sim, incluir sugestão de cardio',
                'Não, já faz cardio por conta',
                'Não, foco apenas no treino de força',
            ],
        }),
    },

    // ── P7 — Muscle emphasis ──
    // Skip if questionnaire already provided emphasis data
    {
        id: 'muscle_emphasis',
        priority: 7,
        condition: (_profile, _context, _tradeoff, questionnaire) => {
            if (questionnaire && questionnaire.emphasized_groups.length > 0) {
                return false // Questionnaire already provided emphasis
            }
            return true // Always eligible otherwise, but only appears if slot available
        },
        build: (_profile, context) => ({
            id: 'muscle_emphasis',
            question: `${context.student_name} tem algum grupo muscular que deseja dar mais ênfase?`,
            context: 'Permite personalizar a distribuição de volume entre os grupos musculares',
            type: 'multi_choice' as const,
            options: [
                'Glúteo (mais volume)',
                'Peito (mais volume)',
                'Costas (mais volume)',
                'Ombros (mais volume)',
                'Braços — Bíceps e Tríceps (mais volume)',
                'Posterior de Coxa (mais volume)',
                'Sem ênfase específica — distribuição equilibrada',
            ],
            allows_text: true,
            placeholder: 'Alguma observação adicional sobre a ênfase...',
        }),
    },
]

// ============================================================================
// Divergence Questions (built dynamically from questionnaire data)
// ============================================================================

function buildDivergenceQuestions(
    questionnaire: QuestionnaireData,
    context: EnrichedStudentContext,
): ConditionalQuestion[] {
    const questions: ConditionalQuestion[] = []

    for (const divergence of questionnaire.divergences) {
        if (divergence.field === 'training_level') {
            questions.push({
                id: 'divergence_level',
                priority: 0.5,
                condition: () => true,
                build: () => ({
                    id: 'divergence_level',
                    question: `${context.student_name} reportou ${divergence.student_value} de experiência, mas o perfil está como ${divergence.profile_value}. Qual nível usar?`,
                    context: divergence.recommendation,
                    type: 'single_choice' as const,
                    options: [
                        `Manter ${divergence.profile_value} (perfil do treinador)`,
                        `Ajustar para ${divergence.student_value} (resposta do aluno)`,
                    ],
                }),
            })
        }

        if (divergence.field === 'frequency') {
            questions.push({
                id: 'divergence_frequency',
                priority: 0.5,
                condition: () => true,
                build: () => ({
                    id: 'divergence_frequency',
                    question: `${context.student_name} diz que consegue treinar ${divergence.student_value}, mas o perfil tem ${divergence.profile_value}. Qual frequência usar?`,
                    context: divergence.recommendation,
                    type: 'single_choice' as const,
                    options: [
                        `Manter ${divergence.profile_value} (perfil do treinador)`,
                        `Ajustar para ${divergence.student_value} (resposta do aluno)`,
                    ],
                }),
            })
        }

        if (divergence.field === 'goal') {
            questions.push({
                id: 'divergence_goal',
                priority: 0.5,
                condition: () => true,
                build: () => ({
                    id: 'divergence_goal',
                    question: `${context.student_name} quer "${divergence.student_value}", mas o perfil está como "${divergence.profile_value}". Qual objetivo priorizar?`,
                    context: divergence.recommendation,
                    type: 'single_choice' as const,
                    options: [
                        `Manter ${divergence.profile_value} (perfil do treinador)`,
                        `Ajustar para ${divergence.student_value} (resposta do aluno)`,
                    ],
                }),
            })
        }

        if (divergence.field === 'equipment') {
            questions.push({
                id: 'divergence_equipment',
                priority: 0.5,
                condition: () => true,
                build: () => ({
                    id: 'divergence_equipment',
                    question: `${context.student_name} reportou treinar em "${divergence.student_value}", mas o perfil tem "${divergence.profile_value}". Qual ambiente usar?`,
                    context: divergence.recommendation,
                    type: 'single_choice' as const,
                    options: [
                        `Manter ${divergence.profile_value} (perfil do treinador)`,
                        `Ajustar para ${divergence.student_value} (resposta do aluno)`,
                    ],
                }),
            })
        }
    }

    return questions
}

// ============================================================================
// Selection Function
// ============================================================================

const MAX_QUESTIONS = 3

export function selectConditionalQuestions(
    profile: StudentPrescriptionProfile,
    context: EnrichedStudentContext,
    tradeoff?: VolumeTradeoffInfo,
    questionnaire?: QuestionnaireData | null,
): PrescriptionAgentQuestion[] {
    // Build the full pool: static questions + dynamic divergence questions
    const pool = [...QUESTION_POOL]

    if (questionnaire && questionnaire.divergences.length > 0) {
        pool.push(...buildDivergenceQuestions(questionnaire, context))
    }

    const triggered = pool
        .filter((q) => q.condition(profile, context, tradeoff, questionnaire))
        .sort((a, b) => a.priority - b.priority)

    return triggered
        .slice(0, MAX_QUESTIONS)
        .map((q) => q.build(profile, context, tradeoff, questionnaire))
}

// ============================================================================
// Helpers
// ============================================================================

function computeAdherence(context: EnrichedStudentContext): number {
    const completed = context.session_patterns?.completed_sessions_4w ?? 0
    const total = context.session_patterns?.total_sessions_4w ?? 1
    if (total === 0) return 100
    return Math.round((completed / total) * 100)
}
