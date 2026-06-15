// Contexto factual do aluno para o rascunho de mensagem do loop de retenção.
//
// Busca focada (não é o full report): só o que ancora uma mensagem de
// reconexão — frequência recente, dias desde o último treino, RPE médio e os
// últimos check-ins. Roda no servidor com o service-role client e SEMPRE
// confirma que o aluno pertence ao treinador antes de devolver dados [S].

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@kinevo/shared/types/database'

type AdminClient = SupabaseClient<Database>

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

export interface DraftCheckin {
    date: string | null
    /** 'pre_workout' | 'post_workout' */
    context: string | null
    formTitle: string
    /** Respostas cruas do check-in (campo [S]). */
    answers: unknown
}

export interface DraftContext {
    studentName: string
    sessionsLast30d: number
    lastSessionAt: string | null
    daysSinceLast: number | null
    avgRpe: number | null
    checkins: DraftCheckin[]
    /** false quando não há sessões nem check-ins → mensagem genérica + confidence 'low'. */
    hasData: boolean
}

/**
 * Monta o contexto do aluno para o gerador de rascunho. Retorna `null` quando o
 * aluno não existe ou não pertence ao treinador (o chamador devolve 403/404).
 */
export async function buildDraftContext(
    admin: AdminClient,
    trainerId: string,
    studentId: string,
): Promise<DraftContext | null> {
    // Ownership: o admin client bypassa RLS, então confirmamos o vínculo.
    const { data: student } = await admin
        .from('students')
        .select('id, name')
        .eq('id', studentId)
        .eq('coach_id', trainerId)
        .maybeSingle()

    if (!student) return null

    const since = new Date(Date.now() - THIRTY_DAYS_MS).toISOString()

    const [sessionsRes, checkinsRes] = await Promise.all([
        admin
            .from('workout_sessions')
            .select('completed_at, rpe')
            .eq('student_id', studentId)
            .eq('trainer_id', trainerId)
            .eq('status', 'completed')
            .gte('completed_at', since)
            .order('completed_at', { ascending: false }),
        admin
            .from('form_submissions')
            .select('trigger_context, submitted_at, answers_json, form_templates(title)')
            .eq('student_id', studentId)
            .in('trigger_context', ['pre_workout', 'post_workout'])
            .in('status', ['submitted', 'reviewed'])
            .order('submitted_at', { ascending: false })
            .limit(3),
    ])

    const sessions = sessionsRes.data ?? []
    const rpeValues = sessions
        .map(s => s.rpe)
        .filter((r): r is number => typeof r === 'number')

    const lastSessionAt = sessions[0]?.completed_at ?? null
    const daysSinceLast = lastSessionAt
        ? Math.floor((Date.now() - new Date(lastSessionAt).getTime()) / DAY_MS)
        : null
    const avgRpe = rpeValues.length > 0
        ? Math.round((rpeValues.reduce((a, b) => a + b, 0) / rpeValues.length) * 10) / 10
        : null

    const checkins: DraftCheckin[] = (checkinsRes.data ?? []).map(row => {
        const tpl = row.form_templates as unknown as { title: string } | null
        return {
            date: row.submitted_at,
            context: row.trigger_context,
            formTitle: tpl?.title ?? 'Check-in',
            answers: row.answers_json,
        }
    })

    return {
        studentName: student.name,
        sessionsLast30d: sessions.length,
        lastSessionAt,
        daysSinceLast,
        avgRpe,
        checkins,
        hasData: sessions.length > 0 || checkins.length > 0,
    }
}
