'use server'

import { createClient } from '@/lib/supabase/server'

interface DailyActivityItem {
    id: string
    sessionId: string
    studentName: string
    studentId: string
    workoutName: string
    completedAt: string
    duration: string
    rpe: number | null
    feedback: string | null
}

export async function getDailyActivity(): Promise<{ success: boolean; data?: DailyActivityItem[]; error?: string }> {
    const supabase = await createClient()

    try {
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return { success: false, error: 'Usuário não autenticado' }
        }

        // Get trainer ID
        const { data: trainer } = await supabase
            .from('trainers')
            .select('id')
            .eq('auth_user_id', user.id)
            .single()

        if (!trainer) {
            return { success: false, error: 'Treinador não encontrado' }
        }

        // Use Brazil timezone so "today" matches the trainer's local date
        const TZ = 'America/Sao_Paulo'
        const now = new Date()
        const brDateStr = now.toLocaleDateString('en-CA', { timeZone: TZ }) // YYYY-MM-DD
        const todayIso = startOfDayInTZ(brDateStr, TZ).toISOString()

        const { data: sessions, error } = await supabase
            .from('workout_sessions')
            .select(`
                id,
                completed_at,
                duration_seconds,
                rpe,
                feedback,
                assigned_workouts:assigned_workout_id!inner (
                    name,
                    assigned_program_id
                ),
                students:student_id!inner (
                    id,
                    name
                )
            `)
            .eq('status', 'completed')
            .gte('completed_at', todayIso)
            .eq('trainer_id', trainer.id) // Use direct trainer_id column for performance/RLS match
            .order('completed_at', { ascending: false })

        if (error) {
            console.error('Error fetching daily activity object:', JSON.stringify(error, null, 2))
            throw error
        }

        const activity: DailyActivityItem[] = sessions.map((session: any) => ({
            id: session.id,
            sessionId: session.id,
            studentName: session.students.name,
            studentId: session.students.id,
            workoutName: session.assigned_workouts.name,
            completedAt: session.completed_at,
            duration: formatDuration(session.duration_seconds),
            rpe: session.rpe,
            feedback: session.feedback || null
        }))

        return { success: true, data: activity }

    } catch (error: any) {
        console.error('Error in getDailyActivity:', error)
        return { success: false, error: error.message }
    }
}

/** Returns the UTC instant that corresponds to 00:00 of `dateStr` (YYYY-MM-DD) in `tz`. */
function startOfDayInTZ(dateStr: string, tz: string): Date {
    const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false,
    })
    const noon = new Date(`${dateStr}T12:00:00Z`)
    const parts = Object.fromEntries(fmt.formatToParts(noon).map(p => [p.type, p.value]))
    const tzHour = parseInt(parts.hour)
    const offsetMs = (tzHour - 12) * 60 * 60 * 1000
    return new Date(new Date(`${dateStr}T00:00:00Z`).getTime() - offsetMs)
}

function formatDuration(seconds: number | null): string {
    if (!seconds) return '-'
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60

    if (hours > 0) {
        return `${hours}h ${remainingMinutes}min`
    }
    return `${minutes}min`
}
