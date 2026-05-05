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
            .select('id, name')
            .eq('id', studentId)
            .single(),
        supabase
            .from('assigned_programs')
            .select('name')
            .eq('student_id', studentId)
            .eq('status', 'active')
            .maybeSingle(),
        getTrainerExerciseLibrary(trainer.id),
    ])

    if (!student) {
        redirect('/students')
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
            key={generationId ?? 'blank'}
            trainer={trainer}
            program={programData}
            exercises={mappedExercises}
            studentContext={{
                id: student.id,
                name: student.name,
                activeProgramName: activeProgram?.name || null,
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
