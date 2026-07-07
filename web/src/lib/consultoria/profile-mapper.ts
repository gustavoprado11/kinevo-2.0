// Deriva o student_prescription_profiles a partir da Avaliação Inicial
// (system_key 'initial_assessment', migration 065) — o passo que faltava para
// o loop "IA rascunha" rodar sem o treinador preencher o perfil à mão.
//
// NOTA: isto NÃO substitui o questionnaire-mapper do motor de prescrição
// (lib/prescription/ é protegido e mapeia outro template). Aqui mapeamos só o
// necessário para o pipeline validar o input (validateInput exige available_days
// 1-6 e session_duration 20-180); o restante do contexto clínico chega ao prompt
// via buildFormNarratives(selectedFormIds) com a submission inteira.

import { type AnswersMap, answerString, answerValues, answerYesNo } from './answers'

export type ProfileTrainingLevel = 'beginner' | 'intermediate' | 'advanced'
export type ProfileGoal = 'hypertrophy' | 'weight_loss' | 'performance' | 'health'

export interface DerivedMedicalRestriction {
    description: string
    restricted_exercise_ids: string[]
    restricted_muscle_groups: string[]
    severity: 'mild' | 'moderate' | 'severe'
}

export interface DerivedProfile {
    training_level: ProfileTrainingLevel
    goal: ProfileGoal
    /** Dias da semana 0=Dom … 6=Sáb (formato do perfil/validateInput). */
    available_days: number[]
    session_duration_minutes: number
    medical_restrictions: DerivedMedicalRestriction[]
}

// Valores da pergunta available_days (065) → inteiro 0=Dom … 6=Sáb.
const WEEKDAY_TO_INT: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
}

// Valores da pergunta primary_goal (065) → enum do perfil (034).
const GOAL_MAP: Record<string, ProfileGoal> = {
    weight_loss: 'weight_loss',
    hypertrophy: 'hypertrophy',
    sports_performance: 'performance',
    quality_of_life: 'health',
}

function deriveTrainingLevel(answers: AnswersMap): ProfileTrainingLevel {
    const v = answerString(answers, 'training_level')?.toLowerCase() ?? ''
    if (v.includes('adv')) return 'advanced'
    if (v.includes('inter')) return 'intermediate'
    return 'beginner'
}

function deriveGoal(answers: AnswersMap): ProfileGoal {
    const v = answerString(answers, 'primary_goal')
    return (v && GOAL_MAP[v]) || 'health'
}

function deriveAvailableDays(answers: AnswersMap): number[] {
    const days = answerValues(answers, 'available_days')
        .map(d => WEEKDAY_TO_INT[d])
        .filter((d): d is number => typeof d === 'number')
    const unique = Array.from(new Set(days)).sort((a, b) => a - b)

    // validateInput exige 1..6 dias. 7 dias marcados → derruba domingo (descanso).
    if (unique.length === 7) return unique.filter(d => d !== 0)
    // Defensivo (pergunta é required, mas submissions antigas podem divergir).
    if (unique.length === 0) return [1, 3, 5]
    return unique
}

function deriveMedicalRestrictions(answers: AnswersMap): DerivedMedicalRestriction[] {
    const restrictions: DerivedMedicalRestriction[] = []

    if (answerYesNo(answers, 'has_medical_restriction') === true) {
        restrictions.push({
            description:
                answerString(answers, 'medical_restriction_description') ??
                'Restrição médica declarada na anamnese (sem descrição)',
            restricted_exercise_ids: [],
            restricted_muscle_groups: [],
            severity: 'moderate',
        })
    }

    if (answerYesNo(answers, 'has_chronic_pain') === true) {
        const sites: string[] = []
        if (answerYesNo(answers, 'has_lower_back_pain') === true) sites.push('lombar')
        if (answerYesNo(answers, 'has_thoracic_pain') === true) sites.push('torácica')
        if (answerYesNo(answers, 'has_cervical_pain') === true) sites.push('cervical')
        const description = answerString(answers, 'pain_description')
        restrictions.push({
            description: [
                `Dor crônica${sites.length > 0 ? ` (${sites.join(', ')})` : ''}`,
                description,
            ].filter((p): p is string => !!p).join(' — '),
            restricted_exercise_ids: [],
            restricted_muscle_groups: [],
            severity: 'moderate',
        })
    }

    if (answerYesNo(answers, 'recent_surgery') === true) {
        restrictions.push({
            description: 'Cirurgia nos últimos 6 meses (anamnese)',
            restricted_exercise_ids: [],
            restricted_muscle_groups: [],
            severity: 'severe',
        })
    }

    return restrictions
}

/** Deriva os campos do perfil de prescrição a partir das respostas da anamnese. */
export function deriveProfileFromAnamnese(answers: AnswersMap): DerivedProfile {
    return {
        training_level: deriveTrainingLevel(answers),
        goal: deriveGoal(answers),
        available_days: deriveAvailableDays(answers),
        session_duration_minutes: 60,
        medical_restrictions: deriveMedicalRestrictions(answers),
    }
}
