import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getTrainerWithSubscription } from '@/lib/auth/get-trainer'
import { ProgramBuilderClient } from '@/components/programs/program-builder-client'
import { mapAiOutputToBuilderData } from '@/lib/prescription/builder-mapper'
import type { BuilderProgramData } from '@/lib/prescription/builder-mapper'
import type { PrescriptionOutputSnapshot, PrescriptionReasoningExtended } from '@kinevo/shared/types/prescription'
import { getFormTemplatesForTriggers } from '@/actions/programs/get-form-templates-for-triggers'
import { fetchPrescriptionDataDirect, type PrescriptionData } from '@/actions/prescription/get-prescription-data'
import { getTrainerExerciseLibrary } from '@/lib/exercises/get-trainer-library'
import { mapAssignedProgramToWorkouts } from '@/components/programs/map-assigned-program'
import {
    KINEVO_DEFAULT_PREFERENCES,
    type PrescriptionPreferences,
} from '@/types/prescription-preferences'

interface PageProps {
    params: Promise<{
        id: string
    }>
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function NewStudentProgramPage({ params, searchParams }: PageProps) {
    const { id: studentId } = await params
    const resolvedSearchParams = await searchParams
    const isScheduled = resolvedSearchParams.scheduled === 'true'
    // "Começar do programa atual": 'current' resolve o ATIVO; um uuid copia um
    // programa específico do aluno (ex.: "Criar próximo" de programa ENCERRADO,
    // que já não é mais active). RLS + filtro por student_id protegem o acesso.
    const fromParam = typeof resolvedSearchParams.from === 'string' ? resolvedSearchParams.from : null
    const generationId = typeof resolvedSearchParams.generationId === 'string'
        ? resolvedSearchParams.generationId
        : undefined

    const { trainer } = await getTrainerWithSubscription()
    const supabase = await createClient()

    // Fetch student, active program, and the (cached) exercise library in
    // parallel. The library was previously the dominant cost on this route
    // (~500-2000 rows × muscle group joins) and now resolves from Next's
    // request-level cache for ~95% of hits — see lib/exercises/get-trainer-library.
    const [
        { data: student },
        { data: activeProgram },
        mappedExercises,
    ] = await Promise.all([
        supabase
            .from('students')
            .select('id, name, max_heart_rate_bpm')
            .eq('id', studentId)
            .single(),
        supabase
            .from('assigned_programs')
            .select('id, name, duration_weeks, assigned_workouts(count)')
            .eq('student_id', studentId)
            .eq('status', 'active')
            .maybeSingle(),
        getTrainerExerciseLibrary(trainer.id),
    ])

    if (!student) {
        redirect('/students')
    }

    // ── "Começar do programa atual": hidrata o builder com uma CÓPIA sem
    // perdas do programa ativo (métodos/set schemes, supersets, cardio/fases,
    // agenda, notas) — ids regenerados, vira um programa NOVO ao salvar.
    let copiedWorkouts: ReturnType<typeof mapAssignedProgramToWorkouts> | null = null
    let copiedMeta: { name: string; description: string | null; durationWeeks: number | null } | null = null
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const sourceProgramId = fromParam === 'current'
        ? activeProgram?.id ?? null
        : (fromParam && UUID_RE.test(fromParam) ? fromParam : null)
    if (sourceProgramId) {
        const { data: fullProgram } = await supabase
            .from('assigned_programs')
            .select(`
                id, name, description, duration_weeks,
                assigned_workouts (
                    id, name, order_index, scheduled_days, workout_type,
                    assigned_workout_items (
                        id, item_type, order_index, parent_item_id, exercise_id,
                        exercise_name, exercise_muscle_group, exercise_equipment,
                        substitute_exercise_ids, sets, reps, rest_seconds, notes,
                        item_config, method_key, rounds, exercise_function,
                        assigned_workout_item_sets (
                            set_number, set_type, reps, rest_seconds,
                            weight_target_kg, weight_target_pct1rm, rir, tempo,
                            notes, round_number
                        )
                    )
                )
            `)
            .eq('id', sourceProgramId)
            .eq('student_id', studentId)
            .maybeSingle()
        if (fullProgram) {
            copiedWorkouts = mapAssignedProgramToWorkouts(fullProgram as never, mappedExercises, { regenerateIds: true })
            copiedMeta = {
                name: `${(fullProgram as { name: string }).name} — novo ciclo`,
                description: (fullProgram as { description: string | null }).description,
                durationWeeks: (fullProgram as { duration_weeks: number | null }).duration_weeks,
            }
        }
    }

    // ── AI Prescription: load generation data if generationId is present ──
    let programData: BuilderProgramData | null = null
    let prescriptionReasoning: PrescriptionReasoningExtended | null = null

    if (generationId) {
        // @ts-ignore — prescription_generations table from migration 035
        const { data: generation } = await supabase
            .from('prescription_generations')
            .select('id, output_snapshot, status, student_id, context_analysis')
            .eq('id', generationId)
            .single()

        if (generation && (generation as any).output_snapshot && (generation as any).student_id === studentId) {
            const outputSnapshot = (generation as any).output_snapshot as PrescriptionOutputSnapshot
            programData = mapAiOutputToBuilderData(outputSnapshot)

            // Extract extended reasoning for the rationale panel
            const reasoning = outputSnapshot.reasoning as PrescriptionReasoningExtended | undefined
            if (reasoning) {
                prescriptionReasoning = {
                    ...reasoning,
                    context_analysis: (generation as any).context_analysis || reasoning.context_analysis,
                }
            }
        }
    }

    // Fetch form templates for trigger configuration
    const triggerResult = await getFormTemplatesForTriggers()

    // Scoped fetch: prescription preferences (graceful fallback if column not yet migrated).
    let prescriptionPreferences: PrescriptionPreferences = KINEVO_DEFAULT_PREFERENCES
    const { data: prefsRow, error: prefsError } = await supabase
        .from('trainers')
        .select('prescription_preferences')
        .eq('id', trainer.id)
        .maybeSingle<{ prescription_preferences: PrescriptionPreferences | null }>()
    if (!prefsError && prefsRow?.prescription_preferences) {
        prescriptionPreferences = prefsRow.prescription_preferences
    }

    // Prescription data for the AI panel — only when the trainer has the feature enabled.
    let prescriptionData: PrescriptionData | null = null
    if (trainer.ai_prescriptions_enabled) {
        try {
            prescriptionData = await fetchPrescriptionDataDirect(supabase, studentId, trainer.id)
        } catch (err) {
            console.error('[program/new] failed to load prescription data:', err)
        }
    }

    return (
        <ProgramBuilderClient
            // Force full remount when a prescription generation is hydrated.
            // ProgramBuilderClient initializes `workouts` from `program` via
            // useState(initializer) — so a prop change alone doesn't repopulate
            // the canvas. Keying on generationId makes React discard the empty
            // instance and remount with the AI-generated workouts.
            key={generationId ?? (copiedWorkouts ? 'from-current' : 'blank')}
            trainer={trainer}
            program={programData}
            exercises={mappedExercises}
            initialWorkouts={copiedWorkouts ?? undefined}
            initialName={copiedMeta?.name}
            initialDescription={copiedMeta?.description ?? undefined}
            initialDurationWeeks={copiedMeta?.durationWeeks}
            copyOffer={!generationId && !copiedWorkouts && activeProgram ? {
                programName: activeProgram.name,
                workoutCount: (activeProgram.assigned_workouts as { count: number }[] | null)?.[0]?.count ?? null,
                durationWeeks: activeProgram.duration_weeks ?? null,
            } : null}
            studentContext={{
                id: student.id,
                name: student.name,
                activeProgramName: activeProgram?.name || null,
                maxHeartRateBpm: student.max_heart_rate_bpm ?? null,
            }}
            initialAssignmentType={isScheduled ? 'scheduled' : 'immediate'}
            prescriptionGenerationId={generationId}
            prescriptionReasoning={prescriptionReasoning}
            formTriggerTemplates={triggerResult.templates || []}
            prescriptionData={prescriptionData}
            prescriptionPreferences={prescriptionPreferences}
        />
    )
}
