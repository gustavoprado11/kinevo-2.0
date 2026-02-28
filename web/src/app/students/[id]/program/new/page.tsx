import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getTrainerWithSubscription } from '@/lib/auth/get-trainer'
import { ProgramBuilderClient } from '@/components/programs/program-builder-client'
import { mapAiOutputToBuilderData } from '@/lib/prescription/builder-mapper'
import type { BuilderProgramData } from '@/lib/prescription/builder-mapper'
import type { Exercise } from '@/types/exercise'
import type { PrescriptionOutputSnapshot } from '@kinevo/shared/types/prescription'

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

    // Get student data for context
    const { data: student } = await supabase
        .from('students')
        .select('id, name')
        .eq('id', studentId)
        .single()

    if (!student) {
        redirect('/students')
    }

    // Get student's current active program (for confirmation dialog)
    const { data: activeProgram } = await supabase
        .from('assigned_programs')
        .select('name')
        .eq('student_id', studentId)
        .eq('status', 'active')
        .maybeSingle()

    // Get exercises for the library
    const { data: exercises } = await supabase
        .from('exercises')
        .select(`
            id,
            name,
            equipment,
            owner_id,
            original_system_id,
            video_url,
            exercise_muscle_groups (
                muscle_groups (
                    id,
                    name,
                    owner_id,
                    created_at
                )
            )
        `)
        .order('name')

    // Map to Exercise type
    const mappedExercises: Exercise[] = (exercises || []).map(e => ({
        id: e.id,
        name: e.name,
        muscle_groups: e.exercise_muscle_groups?.map((emg: any) => emg.muscle_groups) || [],
        equipment: e.equipment,
        owner_id: e.owner_id,
        original_system_id: e.original_system_id,
        video_url: e.video_url || null,
        thumbnail_url: null,
        instructions: null,
        is_archived: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    }))

    // ── AI Prescription: load generation data if generationId is present ──
    let programData: BuilderProgramData | null = null

    if (generationId) {
        // @ts-ignore — prescription_generations table from migration 035
        const { data: generation } = await supabase
            .from('prescription_generations')
            .select('id, output_snapshot, status, student_id')
            .eq('id', generationId)
            .single()

        if (generation && (generation as any).output_snapshot && (generation as any).student_id === studentId) {
            const outputSnapshot = (generation as any).output_snapshot as PrescriptionOutputSnapshot
            programData = mapAiOutputToBuilderData(outputSnapshot)
        }
    }

    return (
        <ProgramBuilderClient
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
        />
    )
}
