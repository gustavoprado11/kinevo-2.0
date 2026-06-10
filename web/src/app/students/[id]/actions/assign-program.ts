'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { insertStudentNotification } from '@/lib/student-notifications'
import { sendStudentPush } from '@/lib/push-notifications'

interface AssignProgramParams {
    studentId: string
    templateId: string
    startDate: string
    isScheduled: boolean
    workoutSchedule?: Record<number, number[]> // order_index -> days (0-6)
    /** When present, marks this program as AI-generated and links to the generation audit trail */
    prescriptionGenerationId?: string
}

export async function assignProgram({ studentId, templateId, startDate, isScheduled, workoutSchedule, prescriptionGenerationId }: AssignProgramParams) {
    const supabase = await createClient()

    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Unauthorized')

        // 1. Get trainer ID
        const { data: trainer } = await supabase
            .from('trainers')
            .select('id')
            .eq('auth_user_id', user.id)
            .single()

        if (!trainer) throw new Error('Trainer not found')

        // 2. Get template name for the notification (ownership re-checked in the RPC)
        const { data: template } = await supabase
            .from('program_templates')
            .select('id, name')
            .eq('id', templateId)
            .eq('trainer_id', trainer.id)
            .single()

        if (!template) throw new Error('Template not found')

        // 3. Assign atomically — completar o programa vigente, criar o novo,
        // copiar treinos/itens/séries e aprovar a geração IA acontece numa
        // transação única no banco (migration 184). Falha em qualquer passo
        // desfaz tudo; o aluno nunca fica sem programa válido.
        const { data: programId, error: rpcError } = await supabase.rpc('assign_program_from_template', {
            p_trainer_id: trainer.id,
            p_student_id: studentId,
            p_template_id: templateId,
            p_is_scheduled: isScheduled,
            p_scheduled_start_date: isScheduled ? startDate : undefined,
            p_workout_schedule: workoutSchedule ?? null,
            p_prescription_generation_id: prescriptionGenerationId ?? undefined,
        })

        if (rpcError) throw rpcError

        // 4. Notify student (fire-and-forget)
        if (!isScheduled) {
            const programName = template.name
            insertStudentNotification({
                studentId,
                trainerId: trainer.id,
                type: 'program_assigned',
                title: 'Novo programa de treino!',
                subtitle: `${programName} está disponível no seu app.`,
                payload: { program_id: programId, program_name: programName },
            }).then((inboxItemId) => {
                sendStudentPush({
                    studentId,
                    title: 'Novo programa de treino!',
                    body: `${programName} está disponível no seu app.`,
                    inboxItemId: inboxItemId ?? undefined,
                    data: { type: 'program_assigned', program_id: programId },
                })
            })
        }

        revalidatePath(`/students/${studentId}`)
        return { success: true, programId: programId as string }

    } catch (error) {
        console.error('Error assigning program:', error)
        return { success: false, error: 'Failed to assign program' }
    }
}
