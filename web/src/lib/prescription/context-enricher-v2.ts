// ============================================================================
// Kinevo Prescription Engine — Enriched context v2 (smart-v2 pipeline)
// ============================================================================
// Extends EnrichedStudentContext with the fields required by spec 06 §5.5:
// performance summary, adherence bucket, trainer observations, active
// injuries, is_new_student signal, and a human-readable anamnese summary.
//
// This module is additive — it calls into the existing v1 enricher for
// programs/load-progression/session-patterns and derives the extra fields.

import type { createClient } from '@/lib/supabase/server'
import type {
    StudentPrescriptionProfile,
    MedicalRestriction,
} from '@kinevo/shared/types/prescription'
import type { QuestionnaireData } from './questionnaire-mapper'

import {
    enrichStudentContext,
    type EnrichedStudentContext,
    type LoadProgressionEntry,
} from './context-enricher'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

// ============================================================================
// Types
// ============================================================================

export interface PerformanceSummary {
    /** Exercises with no load progression for ≥3 weeks. */
    stagnated_exercises: Array<{
        name: string
        group: string
        weeks_stalled: number
    }>
    /** Exercises currently progressing. */
    progressing_well: Array<{ name: string }>
    /**
     * Rolling 4-week window of ISO week-start dates that had at least one
     * completed session. Useful to show consistency visually to the LLM.
     */
    last_session_dates: string[]
}

export type AdherenceBucket = 'excelente' | 'boa' | 'regular' | 'baixa'

export interface AdherenceSummary {
    rate_last_4_weeks: number // 0-100
    bucket: AdherenceBucket
}

export interface TrainerObservation {
    note: string
    created_at: string
}

export interface ActiveInjury {
    label: string
    started_at: string | null
    notes: string | null
}

export interface EnrichedStudentContextV2 extends EnrichedStudentContext {
    anamnese_summary: string
    performance_summary: PerformanceSummary
    adherence: AdherenceSummary
    trainer_observations: TrainerObservation[]
    active_injuries: ActiveInjury[]
    equipment_preference: string | null
    is_new_student: boolean
}

// ============================================================================
// Public API
// ============================================================================

export async function enrichStudentContextV2(
    supabase: SupabaseClient,
    studentId: string,
    profile: StudentPrescriptionProfile,
    questionnaireData?: QuestionnaireData | null,
): Promise<EnrichedStudentContextV2> {
    const base = await enrichStudentContext(supabase, studentId)

    const [trainerObservations, lastSessionDates] = await Promise.all([
        fetchTrainerObservations(supabase, studentId),
        fetchLastSessionDates(supabase, studentId),
    ])

    const performance_summary = derivePerformanceSummary(base.load_progression, lastSessionDates)
    const adherence = deriveAdherence(base.session_patterns.total_sessions_4w, base.session_patterns.completed_sessions_4w)
    const active_injuries = deriveActiveInjuries(profile.medical_restrictions)
    const equipment_preference = profile.available_equipment?.[0] ?? null
    const is_new_student =
        base.session_patterns.completed_sessions_4w === 0 &&
        base.previous_programs.length === 0
    const anamnese_summary = buildAnamneseSummary(profile, questionnaireData ?? null)

    return {
        ...base,
        anamnese_summary,
        performance_summary,
        adherence,
        trainer_observations: trainerObservations,
        active_injuries,
        equipment_preference,
        is_new_student,
    }
}

// ============================================================================
// Derivations
// ============================================================================

export function derivePerformanceSummary(
    progression: LoadProgressionEntry[],
    lastSessionDates: string[],
): PerformanceSummary {
    const stagnated_exercises = progression
        .filter(p => p.trend === 'stalled' && p.weeks_at_current >= 3)
        .map(p => ({
            name: p.exercise_name,
            // load_progression doesn't carry muscle_group; fall back to a
            // label; trainer prompt doesn't need fine granularity here.
            group: 'desconhecido',
            weeks_stalled: p.weeks_at_current,
        }))

    const progressing_well = progression
        .filter(p => p.trend === 'progressing')
        .map(p => ({ name: p.exercise_name }))

    return { stagnated_exercises, progressing_well, last_session_dates: lastSessionDates }
}

export function deriveAdherence(total: number, completed: number): AdherenceSummary {
    if (total <= 0) return { rate_last_4_weeks: 0, bucket: 'baixa' }
    const rate = Math.round((completed / total) * 100)
    let bucket: AdherenceBucket = 'baixa'
    if (rate >= 90) bucket = 'excelente'
    else if (rate >= 70) bucket = 'boa'
    else if (rate >= 50) bucket = 'regular'
    return { rate_last_4_weeks: rate, bucket }
}

export function deriveActiveInjuries(
    restrictions: MedicalRestriction[] | null | undefined,
): ActiveInjury[] {
    if (!restrictions || restrictions.length === 0) return []
    return restrictions.map(r => ({
        label: r.description || (r as any).type || 'restrição registrada',
        started_at: (r as any).started_at ?? null,
        notes: (r as any).notes ?? null,
    }))
}

export function buildAnamneseSummary(
    profile: StudentPrescriptionProfile,
    q: QuestionnaireData | null,
): string {
    const parts: string[] = []
    parts.push(
        `Nível ${profile.training_level}, objetivo ${profile.goal}, ` +
        `${profile.available_days.length} dias/semana (${profile.session_duration_minutes} min).`,
    )
    if (profile.available_equipment?.length) {
        parts.push(`Equipamento: ${profile.available_equipment.join(', ')}.`)
    }
    if (profile.favorite_exercise_ids?.length) {
        parts.push(`Favoritos: ${profile.favorite_exercise_ids.length} exercício(s) marcado(s).`)
    }
    if (profile.disliked_exercise_ids?.length) {
        parts.push(`Não gosta: ${profile.disliked_exercise_ids.length} exercício(s).`)
    }
    if (profile.medical_restrictions?.length) {
        parts.push(
            `Restrições: ${profile.medical_restrictions.map(r => r.description || (r as any).type).filter(Boolean).join('; ')}.`,
        )
    }
    if (profile.cycle_observation) {
        parts.push(`Observação de ciclo: ${profile.cycle_observation}.`)
    }
    if (q) {
        if (q.derived_restrictions?.length) {
            parts.push(`Restrições derivadas do questionário: ${q.derived_restrictions.map(r => r.description).join('; ')}.`)
        }
        if (q.emphasized_groups?.length) {
            parts.push(`Grupos enfatizados pelo aluno: ${q.emphasized_groups.join(', ')}.`)
        }
        if (q.divergences?.length) {
            parts.push(`Divergências entre questionário e perfil: ${q.divergences.length} ponto(s).`)
        }
    }
    return parts.join(' ')
}

// ============================================================================
// Supabase fetchers
// ============================================================================

async function fetchTrainerObservations(
    supabase: SupabaseClient,
    studentId: string,
): Promise<TrainerObservation[]> {
    const results: TrainerObservation[] = []
    try {
        const { data: student } = await supabase
            .from('students')
            .select('trainer_notes')
            .eq('id', studentId)
            .maybeSingle()
        const notes = (student as any)?.trainer_notes
        if (typeof notes === 'string' && notes.trim().length > 0) {
            results.push({ note: notes.trim(), created_at: '' })
        }
    } catch {
        // trainer_notes column may not exist on older environments — tolerate.
    }

    try {
        const { data: insights } = await supabase
            .from('assistant_insights')
            .select('body, created_at')
            .eq('student_id', studentId)
            .eq('category', 'pinned_note')
            .eq('source', 'trainer')
            .order('created_at', { ascending: false })
            .limit(5)
        for (const row of (insights as any[] | null) ?? []) {
            const body = typeof row?.body === 'string' ? row.body.trim() : ''
            if (body) {
                results.push({ note: body, created_at: row.created_at ?? '' })
            }
        }
    } catch {
        // pinned_note category may not be enabled yet on older environments.
    }

    return results.slice(0, 5)
}

async function fetchLastSessionDates(
    supabase: SupabaseClient,
    studentId: string,
): Promise<string[]> {
    const fourWeeksAgo = new Date()
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28)

    const { data } = await supabase
        .from('workout_sessions')
        .select('started_at')
        .eq('student_id', studentId)
        .eq('status', 'completed')
        .gte('started_at', fourWeeksAgo.toISOString())
        .order('started_at', { ascending: false })

    const rows = (data as Array<{ started_at: string | null }> | null) ?? []

    // Reduce to ISO week-start strings to keep the prompt compact.
    const weeks = new Set<string>()
    for (const row of rows) {
        if (!row.started_at) continue
        const d = new Date(row.started_at)
        const monday = new Date(d)
        monday.setHours(0, 0, 0, 0)
        monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
        weeks.add(monday.toISOString().slice(0, 10))
    }
    return [...weeks].sort().reverse()
}
