// ============================================================================
// Kinevo Prescription Engine v2 — Output Enricher
// ============================================================================
// Converts the compact LLM output (IDs + numbers only) into a full
// PrescriptionOutputSnapshot that is compatible with the existing v1 pipeline.
//
// Responsibilities:
//   1. Map exercise_id → name, muscle_group, equipment from exerciseMap
//   2. Translate note_key → localized PT-BR exercise notes
//   3. Generate reasoning.structure_rationale from constraints + split
//   4. Generate reasoning.volume_rationale from computed volume vs budget
//   5. Generate reasoning.workout_notes from exercise anchors
//   6. Generate program.description from profile data
//
// The LLM never generates free-form text — all human-readable output
// comes from this module.

import type {
    PrescriptionOutputSnapshot,
    PrescriptionExerciseRef,
    GeneratedWorkout,
    GeneratedWorkoutItem,
    PrescriptionReasoning,
    StudentPrescriptionProfile,
} from '@kinevo/shared/types/prescription'

import type { PrescriptionConstraints } from './constraints-engine'
import type { CompactGenerationOutput, ExerciseNoteKey } from './schemas'
import { computeWeeklyVolumePerMuscle } from './rules-engine'
import { PRIMARY_MUSCLE_GROUPS } from './constants'

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Converts a CompactGenerationOutput into a full PrescriptionOutputSnapshot.
 * This is the bridge between the v2 compact LLM output and the existing
 * v1 data structures used by rules-engine, UI components, and the database.
 */
export function enrichCompactOutput(
    compact: CompactGenerationOutput,
    exerciseMap: Map<string, PrescriptionExerciseRef>,
    constraints: PrescriptionConstraints,
    profile: StudentPrescriptionProfile,
): PrescriptionOutputSnapshot {
    // 1. Enrich workouts with exercise metadata
    const workouts = compact.workouts.map((cw, wi) =>
        enrichWorkout(cw, wi, exerciseMap)
    )

    // 2. Generate reasoning from constraints + enriched workouts
    const reasoning = generateReasoning(
        workouts,
        compact,
        constraints,
        profile,
        exerciseMap,
    )

    // 3. Generate program description
    const description = generateProgramDescription(profile, constraints)

    return {
        program: {
            name: compact.program.name,
            description,
            duration_weeks: compact.program.duration_weeks,
        },
        workouts,
        reasoning,
    }
}

// ============================================================================
// Workout Enrichment
// ============================================================================

function enrichWorkout(
    compact: CompactGenerationOutput['workouts'][number],
    fallbackIndex: number,
    exerciseMap: Map<string, PrescriptionExerciseRef>,
): GeneratedWorkout {
    return {
        name: compact.name,
        order_index: compact.order_index ?? fallbackIndex,
        scheduled_days: compact.scheduled_days,
        items: compact.items.map((item, ii) =>
            enrichWorkoutItem(item, ii, exerciseMap)
        ),
    }
}

function enrichWorkoutItem(
    compact: CompactGenerationOutput['workouts'][number]['items'][number],
    fallbackIndex: number,
    exerciseMap: Map<string, PrescriptionExerciseRef>,
): GeneratedWorkoutItem {
    const itemType = compact.item_type || 'exercise'

    // Warmup/cardio items don't need exercise enrichment
    if (itemType === 'warmup' || itemType === 'cardio') {
        return {
            item_type: itemType,
            order_index: fallbackIndex,
            item_config: compact.item_config ?? {},
            exercise_id: null,
            exercise_name: null,
            exercise_muscle_group: null,
            exercise_equipment: null,
            sets: null,
            reps: null,
            rest_seconds: null,
            notes: null,
            substitute_exercise_ids: [],
            exercise_function: null,
        }
    }

    const exercise = compact.exercise_id ? exerciseMap.get(compact.exercise_id) : undefined

    return {
        item_type: 'exercise',
        exercise_id: compact.exercise_id!,
        exercise_name: exercise?.name ?? 'Exercício desconhecido',
        exercise_muscle_group: exercise?.muscle_group_names[0] ?? '',
        exercise_equipment: exercise?.equipment ?? null,
        sets: compact.sets!,
        reps: compact.reps!,
        rest_seconds: compact.rest_seconds!,
        notes: compact.note_key ? translateNoteKey(compact.note_key, exercise) : null,
        substitute_exercise_ids: compact.substitute_exercise_ids ?? [],
        order_index: fallbackIndex,
        exercise_function: compact.exercise_function,
    }
}

// ============================================================================
// Note Key → PT-BR Translation
// ============================================================================

const NOTE_TRANSLATIONS: Record<NonNullable<ExerciseNoteKey>, string> = {
    compound_anchor: 'Composto principal — âncora de volume do treino',
    replaces_stalled: 'Substitui exercício estagnado do programa anterior',
    favorite_included: 'Incluído por ser exercício favorito do aluno',
    movement_pattern_cover: 'Cobre padrão de movimento necessário para o treino',
    volume_filler: 'Completa budget de volume do grupo muscular',
    unilateral_balance: 'Trabalho unilateral para equilíbrio e estabilidade',
    isolation_complement: 'Isolamento complementar após compostos',
    activation_warmup: 'Ativação leve para preparar o grupo muscular alvo',
    conditioning_finisher: 'Condicionamento ou finalizador da sessão',
    clinical_safe_pick: 'Escolhido por segurança considerando restrições médicas',
    adherence_simple: 'Exercício simples para facilitar aderência',
    emphasis_priority: 'Priorizado pela ênfase muscular definida pelo treinador',
}

function translateNoteKey(
    noteKey: ExerciseNoteKey,
    exercise?: PrescriptionExerciseRef,
): string | null {
    if (!noteKey) return null

    const base = NOTE_TRANSLATIONS[noteKey]
    if (!base) return null

    // For "replaces_stalled", append exercise-specific context if available
    if (noteKey === 'replaces_stalled' && exercise?.prescription_notes) {
        return `${base} — ${exercise.prescription_notes}`
    }

    return base
}

// ============================================================================
// Reasoning Generation (Backend, not LLM)
// ============================================================================

function generateReasoning(
    workouts: GeneratedWorkout[],
    compact: CompactGenerationOutput,
    constraints: PrescriptionConstraints,
    profile: StudentPrescriptionProfile,
    exerciseMap: Map<string, PrescriptionExerciseRef>,
): PrescriptionReasoning {
    return {
        structure_rationale: generateStructureRationale(constraints, profile),
        volume_rationale: generateVolumeRationale(workouts, constraints, exerciseMap),
        workout_notes: generateWorkoutNotes(workouts, exerciseMap),
        attention_flags: compact.meta.flags,
        confidence_score: compact.meta.confidence,
    }
}

/**
 * Generates a telegraphic structure rationale from constraints.
 * Format: "{split} {freq}x. {emphasis info}. {adherence note}."
 */
function generateStructureRationale(
    constraints: PrescriptionConstraints,
    profile: StudentPrescriptionProfile,
): string {
    const parts: string[] = []

    // Split type and frequency
    const splitLabel = SPLIT_LABELS[constraints.split_type] ?? constraints.split_type
    parts.push(`${splitLabel} ${constraints.split_detail.length}x/sem`)

    // Emphasis
    if (constraints.emphasized_groups.length > 0) {
        parts.push(`Ênfase: ${constraints.emphasized_groups.join(', ')}`)
    }

    // Adherence adjustment
    if (constraints.adherence_adjustment === 'reduced') {
        parts.push('Volume reduzido por aderência moderada')
    } else if (constraints.adherence_adjustment === 'minimal') {
        parts.push('Sessões simplificadas — aderência crítica')
    }

    // Session duration
    parts.push(`${profile.session_duration_minutes}min/sessão`)

    return parts.join('. ') + '.'
}

const SPLIT_LABELS: Record<string, string> = {
    full_body: 'Full Body',
    upper_lower: 'Upper/Lower',
    ppl_plus: 'PPL+',
    ppl_complete: 'PPL Completo',
}

/**
 * Generates volume rationale by comparing actual volume to budget.
 * Only lists groups that are outside their budget range (exceptions only).
 */
function generateVolumeRationale(
    workouts: GeneratedWorkout[],
    constraints: PrescriptionConstraints,
    exerciseMap: Map<string, PrescriptionExerciseRef>,
): string {
    const weeklyVolume = computeWeeklyVolumePerMuscle(workouts, exerciseMap)
    const exceptions: string[] = []

    for (const group of PRIMARY_MUSCLE_GROUPS) {
        const actual = weeklyVolume[group] || 0
        const budget = constraints.volume_budget[group]
        if (!budget || actual === 0) continue

        if (actual < budget.min) {
            exceptions.push(`${group}: ${actual}s (mín ${budget.min}) — déficit aceitável`)
        } else if (actual > budget.max) {
            exceptions.push(`${group}: ${actual}s (máx ${budget.max}) — verificar com treinador`)
        }
    }

    if (exceptions.length === 0) {
        return 'Todos os grupos primários dentro do budget de volume.'
    }

    return exceptions.join('. ') + '.'
}

/**
 * Generates per-workout notes from exercise anchors.
 * Format: "{workout_name}: {anchor_exercise_1} + {anchor_exercise_2}. {focus}."
 */
function generateWorkoutNotes(
    workouts: GeneratedWorkout[],
    exerciseMap: Map<string, PrescriptionExerciseRef>,
): string[] {
    return workouts.map(w => {
        // Filter to exercise items only for analysis
        const exerciseItems = w.items.filter(item => (item.item_type || 'exercise') === 'exercise')

        // Find main (compound anchor) exercises
        const anchors = exerciseItems
            .filter(item => item.exercise_function === 'main')
            .map(item => {
                const ref = item.exercise_id ? exerciseMap.get(item.exercise_id) : undefined
                return ref?.name ?? item.exercise_name
            })

        const anchorText = anchors.length > 0
            ? anchors.join(' + ')
            : 'Acessórios focados'

        // Identify primary muscle groups in this workout
        const groups = new Set<string>()
        for (const item of exerciseItems) {
            const ref = item.exercise_id ? exerciseMap.get(item.exercise_id) : undefined
            if (ref) {
                for (const g of ref.muscle_group_names) {
                    groups.add(g)
                }
            }
        }

        const primaryGroups = [...groups]
            .filter(g => PRIMARY_MUSCLE_GROUPS.includes(g))
            .slice(0, 3)

        if (primaryGroups.length > 0) {
            return `${w.name}: ${anchorText}. Foco: ${primaryGroups.join(', ')}.`
        }

        return `${w.name}: ${anchorText}.`
    })
}

/**
 * Generates a short program description from profile data.
 */
function generateProgramDescription(
    profile: StudentPrescriptionProfile,
    constraints: PrescriptionConstraints,
): string {
    const goalLabel = GOAL_LABELS[profile.goal] ?? profile.goal
    const levelLabel = LEVEL_LABELS[profile.training_level] ?? profile.training_level
    const splitLabel = SPLIT_LABELS[constraints.split_type] ?? constraints.split_type

    return `Programa de ${goalLabel} para aluno ${levelLabel}. ` +
        `Estrutura ${splitLabel}, ${constraints.split_detail.length}x por semana, ` +
        `sessões de ${profile.session_duration_minutes} minutos.`
}

const GOAL_LABELS: Record<string, string> = {
    hypertrophy: 'hipertrofia',
    weight_loss: 'emagrecimento',
    performance: 'performance',
    health: 'saúde',
}

const LEVEL_LABELS: Record<string, string> = {
    beginner: 'iniciante',
    intermediate: 'intermediário',
    advanced: 'avançado',
}
