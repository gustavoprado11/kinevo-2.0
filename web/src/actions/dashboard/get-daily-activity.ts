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

        // Get today's range in UTC
        // We want to fetch everything from the start of the day until now (or end of day)
        // Since we don't have the user's timezone easily, let's fetch for the last 24 hours OR just filter by date string match if possible.
        // Better: Let's fetch the last 24h for now to be safe, or just use `current_date` from Postgres if we trust server time.
        // Actually, the requirement says "HOJE".
        // Let's use a simple approach: fetch sessions completed >= today at 00:00:00.
        // We'll use the server's today.

        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const todayIso = today.toISOString()

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
                    name,
                    trainer_id
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
