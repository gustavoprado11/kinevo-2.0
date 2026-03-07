// ============================================================================
// Kinevo Prescription Engine — Questionnaire Mapper
// ============================================================================
// Maps student questionnaire answers to structured data for the prescription
// pipeline. Detects divergences between student answers and trainer profile.

import type {
    StudentPrescriptionProfile,
    MedicalRestriction,
    PrescriptionExerciseRef,
} from '@kinevo/shared/types/prescription'

import { matchCondition } from './condition-mappings'

// ============================================================================
// Types
// ============================================================================

export interface QuestionnaireData {
    // Validated suggestions (confront with trainer profile)
    suggested_level: 'beginner' | 'intermediate' | 'advanced'
    suggested_frequency: number
    suggested_duration: number
    goal_from_student: string
    suggested_equipment: string | null

    // Pipeline enrichment
    emphasized_groups: string[]
    motivation: string
    training_style_preferences: string[]
    activity_level: string

    // Injuries
    has_injury: boolean
    injury_description: string | null
    painful_activities: string[]
    medical_followup: string | null
    /** Medical restrictions derived from questionnaire (already deduped) */
    derived_restrictions: MedicalRestriction[]

    // Exercise preferences (matched IDs)
    favorite_exercise_ids: string[]
    disliked_exercise_ids: string[]
    favorite_exercises_text: string | null
    disliked_exercises_text: string | null

    // Qualitative context (free text for AI)
    previous_experience: string | null
    additional_info: string | null

    // Divergences between questionnaire and trainer profile
    divergences: Divergence[]
}

export interface Divergence {
    field: string
    profile_value: string
    student_value: string
    recommendation: string
}

// ============================================================================
// Mapping Tables
// ============================================================================

const EXPERIENCE_TO_LEVEL: Record<string, 'beginner' | 'intermediate' | 'advanced'> = {
    'menos_3m': 'beginner',
    '3_6m': 'beginner',
    '6m_2a': 'intermediate',
    'mais_2a': 'advanced',
}

const DURATION_MIDPOINTS: Record<string, number> = {
    '30_40': 35,
    '40_50': 45,
    '50_60': 55,
    '60_75': 67,
    '75_90': 82,
}

const GOAL_MAP: Record<string, string> = {
    'hypertrophy': 'hypertrophy',
    'weight_loss': 'weight_loss',
    'health': 'health',
    'rehab': 'health',
    'performance': 'performance',
}

const EMPHASIS_MAP: Record<string, string[]> = {
    'gluteo': ['Glúteo'],
    'peito': ['Peito'],
    'costas': ['Costas'],
    'ombros': ['Ombros'],
    'bracos': ['Bíceps', 'Tríceps'],
    'pernas': ['Quadríceps', 'Posterior de Coxa'],
}

/** Maps painful_activities values to cautious movement patterns */
const PAIN_TO_PATTERNS: Record<string, string[]> = {
    'agachar': ['squat', 'lunge'],
    'escadas': ['squat', 'lunge'],
    'acima_cabeca': ['push_v'],
    'empurrar': ['push_h'],
    'puxar': ['pull_h', 'pull_v'],
}

// ============================================================================
// Main Mapper
// ============================================================================

export function mapQuestionnaireToProfile(
    answers: Record<string, any>,
    currentProfile: StudentPrescriptionProfile,
    exercises: PrescriptionExerciseRef[],
): QuestionnaireData {
    // Extract answer values (mobile sends { type, value } or { type, values })
    const val = (id: string): string => {
        const a = answers[id]
        if (!a) return ''
        if (typeof a === 'string') return a
        return a.value ?? ''
    }

    const vals = (id: string): string[] => {
        const a = answers[id]
        if (!a) return []
        if (Array.isArray(a)) return a
        return a.values ?? []
    }

    const text = (id: string): string | null => {
        const a = answers[id]
        if (!a) return null
        if (typeof a === 'string') return a.trim() || null
        const v = a.value ?? ''
        return v.trim() || null
    }

    // 1. Level
    const suggestedLevel = EXPERIENCE_TO_LEVEL[val('training_experience')] || 'intermediate'

    // 2. Frequency
    const suggestedFrequency = parseInt(val('realistic_frequency'), 10) || 4

    // 3. Duration
    const suggestedDuration = DURATION_MIDPOINTS[val('session_duration')] || 60

    // 4. Goal
    const goalFromStudent = GOAL_MAP[val('primary_goal')] || 'hypertrophy'

    // 5. Equipment
    const suggestedEquipment = val('training_environment') || null

    // 6. Emphasis
    const emphasisValues = vals('muscle_emphasis')
        .filter(v => v !== 'equilibrado')
    const emphasizedGroups = emphasisValues
        .flatMap(v => EMPHASIS_MAP[v] || [])
    const uniqueEmphasis = [...new Set(emphasizedGroups)]

    // 7. Motivation
    const motivation = val('motivation')

    // 8. Training style
    const trainingStylePreferences = vals('training_style')

    // 9. Activity level
    const activityLevel = val('activity_level')

    // 10. Injuries
    const hasInjury = val('has_injury') === 'sim'
    const injuryDescription = hasInjury ? text('injury_description') : null
    const painfulActivities = hasInjury ? vals('painful_activities').filter(v => v !== 'nenhuma') : []
    const medicalFollowup = hasInjury ? val('medical_followup') || null : null

    // 11. Derive medical restrictions from injury data
    const derivedRestrictions = deriveRestrictions(
        hasInjury,
        injuryDescription,
        painfulActivities,
        medicalFollowup,
        currentProfile.medical_restrictions,
    )

    // 12. Exercise preferences (substring match)
    const favoriteText = text('favorite_exercises')
    const dislikedText = text('disliked_exercises')
    const favoriteIds = favoriteText ? matchExercisesByName(favoriteText, exercises) : []
    const dislikedIds = dislikedText ? matchExercisesByName(dislikedText, exercises) : []

    // 13. Qualitative context
    const previousExperience = text('previous_experience')
    const additionalInfo = text('additional_info')

    // 14. Divergences
    const divergences = detectDivergences(
        currentProfile,
        suggestedLevel,
        suggestedFrequency,
        goalFromStudent,
        suggestedEquipment,
    )

    return {
        suggested_level: suggestedLevel,
        suggested_frequency: suggestedFrequency,
        suggested_duration: suggestedDuration,
        goal_from_student: goalFromStudent,
        suggested_equipment: suggestedEquipment,
        emphasized_groups: uniqueEmphasis,
        motivation,
        training_style_preferences: trainingStylePreferences,
        activity_level: activityLevel,
        has_injury: hasInjury,
        injury_description: injuryDescription,
        painful_activities: painfulActivities,
        medical_followup: medicalFollowup,
        derived_restrictions: derivedRestrictions,
        favorite_exercise_ids: favoriteIds,
        disliked_exercise_ids: dislikedIds,
        favorite_exercises_text: favoriteText,
        disliked_exercises_text: dislikedText,
        previous_experience: previousExperience,
        additional_info: additionalInfo,
        divergences,
    }
}

// ============================================================================
// Exercise Matching (substring, case-insensitive)
// ============================================================================

function matchExercisesByName(
    text: string,
    exercises: PrescriptionExerciseRef[],
): string[] {
    const terms = text
        .toLowerCase()
        .split(/[,;\n]/)
        .map(t => t.trim())
        .filter(t => t.length >= 3) // ignore very short terms

    if (terms.length === 0) return []

    return exercises
        .filter(ex => terms.some(term => ex.name.toLowerCase().includes(term)))
        .map(ex => ex.id)
}

// ============================================================================
// Medical Restrictions Derivation + Dedup
// ============================================================================

function deriveRestrictions(
    hasInjury: boolean,
    injuryDescription: string | null,
    painfulActivities: string[],
    medicalFollowup: string | null,
    existingRestrictions: MedicalRestriction[],
): MedicalRestriction[] {
    if (!hasInjury) return []

    const derived: MedicalRestriction[] = []

    // Try to match injury description against known conditions
    if (injuryDescription) {
        const match = matchCondition(injuryDescription)
        if (match) {
            const severity = resolveSeverity(medicalFollowup, match.confidence)
            derived.push({
                description: match.condition.label,
                restricted_exercise_ids: [],
                restricted_muscle_groups: match.condition.cautious_muscle_groups,
                severity,
            })
        } else {
            // No known condition matched — create generic restriction
            const severity = resolveSeverity(medicalFollowup, 'medium')
            derived.push({
                description: injuryDescription,
                restricted_exercise_ids: [],
                restricted_muscle_groups: [],
                severity,
            })
        }
    }

    // Map painful activities to cautious movement patterns
    // (stored as additional context, not separate restrictions)
    if (painfulActivities.length > 0) {
        const cautiousPatterns = painfulActivities
            .flatMap(p => PAIN_TO_PATTERNS[p] || [])
        if (cautiousPatterns.length > 0 && !injuryDescription) {
            // Only create if no injury description (avoid duplication)
            derived.push({
                description: `Dor/desconforto reportado em: ${painfulActivities.join(', ')}`,
                restricted_exercise_ids: [],
                restricted_muscle_groups: [],
                severity: 'mild',
            })
        }
    }

    // Deduplicate against existing restrictions
    return deduplicateRestrictions(existingRestrictions, derived)
}

function resolveSeverity(
    medicalFollowup: string | null,
    matchConfidence: 'high' | 'medium',
): 'mild' | 'moderate' | 'severe' {
    // Active medical followup → moderate (professional oversight)
    if (medicalFollowup === 'ativo') return 'moderate'
    // No followup + lesion → moderate (higher caution)
    if (medicalFollowup === 'nao') return 'moderate'
    // Previous followup → mild (condition managed)
    if (medicalFollowup === 'anterior') return 'mild'
    // Default by confidence
    return matchConfidence === 'high' ? 'moderate' : 'mild'
}

/**
 * Deduplicates questionnaire-derived restrictions against existing profile restrictions.
 * Skips if same condition label (case-insensitive) already exists.
 */
function deduplicateRestrictions(
    existing: MedicalRestriction[],
    fromQuestionnaire: MedicalRestriction[],
): MedicalRestriction[] {
    const existingDescs = new Set(
        existing.map(r => r.description.toLowerCase().trim()),
    )

    return fromQuestionnaire.filter(r => {
        const desc = r.description.toLowerCase().trim()
        // Skip if exact description match
        if (existingDescs.has(desc)) return false
        // Skip if any existing description contains or is contained by this one
        for (const existingDesc of existingDescs) {
            if (existingDesc.includes(desc) || desc.includes(existingDesc)) return false
        }
        return true
    })
}

// ============================================================================
// Divergence Detection
// ============================================================================

function detectDivergences(
    profile: StudentPrescriptionProfile,
    suggestedLevel: string,
    suggestedFrequency: number,
    goalFromStudent: string,
    suggestedEquipment: string | null,
): Divergence[] {
    const divergences: Divergence[] = []

    const LEVEL_LABELS: Record<string, string> = {
        beginner: 'Iniciante',
        intermediate: 'Intermediário',
        advanced: 'Avançado',
    }

    const GOAL_LABELS: Record<string, string> = {
        hypertrophy: 'Hipertrofia',
        weight_loss: 'Perda de peso',
        health: 'Saúde',
        performance: 'Performance',
    }

    const EQUIPMENT_LABELS: Record<string, string> = {
        academia_completa: 'Academia completa',
        home_gym_completo: 'Home gym completo',
        home_gym_basico: 'Home gym básico',
        ao_ar_livre: 'Ao ar livre',
        apenas_peso_corporal: 'Apenas peso corporal',
    }

    if (suggestedLevel !== profile.training_level) {
        divergences.push({
            field: 'training_level',
            profile_value: LEVEL_LABELS[profile.training_level] || profile.training_level,
            student_value: LEVEL_LABELS[suggestedLevel] || suggestedLevel,
            recommendation: `Aluno reporta experiência de ${LEVEL_LABELS[suggestedLevel]}, mas perfil está como ${LEVEL_LABELS[profile.training_level]}`,
        })
    }

    const profileFrequency = profile.available_days?.length || 0
    if (suggestedFrequency !== profileFrequency) {
        divergences.push({
            field: 'frequency',
            profile_value: `${profileFrequency} dias`,
            student_value: `${suggestedFrequency} dias`,
            recommendation: `Aluno diz que consegue treinar ${suggestedFrequency} dias/semana, perfil tem ${profileFrequency} dias`,
        })
    }

    if (goalFromStudent !== profile.goal) {
        divergences.push({
            field: 'goal',
            profile_value: GOAL_LABELS[profile.goal] || profile.goal,
            student_value: GOAL_LABELS[goalFromStudent] || goalFromStudent,
            recommendation: `Aluno quer "${GOAL_LABELS[goalFromStudent] || goalFromStudent}" mas perfil está como "${GOAL_LABELS[profile.goal] || profile.goal}"`,
        })
    }

    const profileEquipment = profile.available_equipment?.[0] || null
    if (suggestedEquipment && profileEquipment && suggestedEquipment !== profileEquipment) {
        divergences.push({
            field: 'equipment',
            profile_value: EQUIPMENT_LABELS[profileEquipment] || profileEquipment,
            student_value: EQUIPMENT_LABELS[suggestedEquipment] || suggestedEquipment,
            recommendation: `Aluno reporta "${EQUIPMENT_LABELS[suggestedEquipment] || suggestedEquipment}" mas perfil tem "${EQUIPMENT_LABELS[profileEquipment] || profileEquipment}"`,
        })
    }

    return divergences
}
