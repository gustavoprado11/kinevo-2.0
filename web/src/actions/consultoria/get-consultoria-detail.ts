'use server'

// Consultoria IA — detalhe para o painel de validação (o que o validador vê:
// triagem + racional da IA + resumo do programa). Leitura pura, RLS do treinador.

import { createClient } from '@/lib/supabase/server'
import { resolveTrainer } from './consultoria-core'
import type { TriageFlag, TriageLevel } from '@/lib/consultoria/triage'
import type { PrescriptionOutputSnapshot, PrescriptionReasoning } from '@kinevo/shared/types/prescription'

export interface ConsultoriaProgramItem {
    label: string
    itemType: string
    sets: number | null
    reps: string | null
    notes: string | null
}

export interface ConsultoriaProgramWorkout {
    name: string
    scheduledDays: number[]
    items: ConsultoriaProgramItem[]
}

export interface ConsultoriaDetail {
    id: string
    status: string
    studentId: string
    studentName: string
    triageLevel: TriageLevel | null
    triageFlags: TriageFlag[]
    anamneseSubmittedAt: string | null
    reviewStartedAt: string | null
    rejectionReason: string | null
    errorMessage: string | null
    reasoning: PrescriptionReasoning | null
    program: {
        id: string
        name: string
        durationWeeks: number | null
        workouts: ConsultoriaProgramWorkout[]
    } | null
}

interface DetailResult {
    success: boolean
    error?: string
    detail?: ConsultoriaDetail
}

export async function getConsultoriaDetail(requestId: string): Promise<DetailResult> {
    try {
        const supabase = await createClient()
        const trainer = await resolveTrainer(supabase)
        if (!trainer) return { success: false, error: 'Não autorizado' }

        const { data: request } = await supabase
            .from('consultoria_requests')
            .select(`
                id, status, student_id, triage_level, triage_flags,
                review_started_at, rejection_reason, error_message,
                anamnese_submission_id, generation_id, program_id,
                students ( name )
            `)
            .eq('id', requestId)
            .eq('trainer_id', trainer.id)
            .single()

        if (!request) return { success: false, error: 'Consultoria não encontrada.' }

        // Anamnese: só o carimbo de quando foi respondida.
        let anamneseSubmittedAt: string | null = null
        if (request.anamnese_submission_id) {
            const { data: submission } = await supabase
                .from('form_submissions')
                .select('submitted_at')
                .eq('id', request.anamnese_submission_id)
                .maybeSingle()
            anamneseSubmittedAt = submission?.submitted_at ?? null
        }

        // Racional da IA (gravado no output_snapshot pela geração).
        let reasoning: PrescriptionReasoning | null = null
        if (request.generation_id) {
            const { data: generation } = await supabase
                .from('prescription_generations')
                .select('output_snapshot')
                .eq('id', request.generation_id)
                .maybeSingle()
            const snapshot = generation?.output_snapshot as unknown as PrescriptionOutputSnapshot | null
            reasoning = snapshot?.reasoning ?? null
        }

        // Resumo do programa (estado ATUAL do draft — reflete edições do builder).
        let program: ConsultoriaDetail['program'] = null
        if (request.program_id) {
            const { data: programRow } = await supabase
                .from('assigned_programs')
                .select('id, name, duration_weeks')
                .eq('id', request.program_id)
                .maybeSingle()

            if (programRow) {
                const { data: workoutRows } = await supabase
                    .from('assigned_workouts')
                    .select('id, name, order_index, scheduled_days')
                    .eq('assigned_program_id', programRow.id)
                    .order('order_index')

                const workoutIds = (workoutRows ?? []).map(w => w.id)
                const { data: itemRows } = workoutIds.length > 0
                    ? await supabase
                        .from('assigned_workout_items')
                        .select('assigned_workout_id, parent_item_id, item_type, exercise_name, sets, reps, notes, order_index')
                        .in('assigned_workout_id', workoutIds)
                        .order('order_index')
                    : { data: [] as never[] }

                const workouts: ConsultoriaProgramWorkout[] = (workoutRows ?? []).map(w => ({
                    name: w.name,
                    scheduledDays: w.scheduled_days ?? [],
                    items: (itemRows ?? [])
                        .filter(item => item.assigned_workout_id === w.id && !item.parent_item_id)
                        .map(item => ({
                            label: item.exercise_name
                                ?? (item.item_type === 'warmup' ? 'Aquecimento'
                                    : item.item_type === 'cardio' ? 'Cardio'
                                        : item.item_type === 'note' ? 'Nota'
                                            : item.item_type === 'superset' ? 'Superset'
                                                : 'Exercício'),
                            itemType: item.item_type ?? 'exercise',
                            sets: item.sets,
                            reps: item.reps,
                            notes: item.notes,
                        })),
                }))

                program = {
                    id: programRow.id,
                    name: programRow.name,
                    durationWeeks: programRow.duration_weeks,
                    workouts,
                }
            }
        }

        const studentRelation = request.students as { name: string | null } | null

        return {
            success: true,
            detail: {
                id: request.id,
                status: request.status,
                studentId: request.student_id,
                studentName: studentRelation?.name ?? 'Aluno',
                triageLevel: (request.triage_level as TriageLevel | null) ?? null,
                triageFlags: Array.isArray(request.triage_flags)
                    ? (request.triage_flags as unknown as TriageFlag[])
                    : [],
                anamneseSubmittedAt,
                reviewStartedAt: request.review_started_at,
                rejectionReason: request.rejection_reason,
                errorMessage: request.error_message,
                reasoning,
                program,
            },
        }
    } catch (err) {
        console.error('[getConsultoriaDetail] error:', err)
        return { success: false, error: 'Erro ao carregar a consultoria.' }
    }
}
