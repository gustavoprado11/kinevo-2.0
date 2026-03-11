'use server'

import { createClient } from '@/lib/supabase/server'

// ── Types ──

export interface SessionSetLog {
    setNumber: number
    weight: number
    weightUnit: string
    reps: number
    rpe: number | null
}

export interface CardioResult {
    mode?: string
    equipment?: string
    durationMinutes?: number
    distanceKm?: number
    intensity?: string
    intervals?: { work_seconds: number; rest_seconds: number; rounds: number }
    actualDurationSeconds?: number
}

export interface SessionItem {
    id: string
    itemType: 'exercise' | 'warmup' | 'cardio' | 'note' | 'superset'
    orderIndex: number
    exerciseName?: string
    exerciseFunction?: string
    itemConfig?: Record<string, any>
    notes?: string
    parentItemId?: string | null
    setsPrescribed?: number
    repsPrescribed?: string
    restSeconds?: number
    setLogs: SessionSetLog[]
    cardioResult?: CardioResult | null
    children?: SessionItem[]
}

export interface SessionCheckin {
    id: string
    triggerContext: string
    answersJson: Record<string, any>
    schemaJson: any
    submittedAt: string
    formTitle: string
}

export interface SessionStats {
    durationSeconds: number
    totalSetsPrescribed: number
    completedSets: number
    totalTonnage: number
    exerciseCount: number
}

export interface SessionDetailsData {
    id: string
    started_at: string
    completed_at: string
    duration_seconds: number
    rpe: number | null
    feedback: string | null
    assigned_workouts: { name: string }
    items: SessionItem[]
    stats: SessionStats
    preCheckin: SessionCheckin | null
    postCheckin: SessionCheckin | null
    // Legacy compat: session-detail-sheet may still use these
    exercises: Array<{ exercise_id: string; name: string; muscle_group: string | null; sets: any[] }>
}

interface GetSessionDetailsResult {
    success: boolean
    data?: SessionDetailsData
    error?: string
}

export async function getSessionDetails(sessionId: string): Promise<GetSessionDetailsResult> {
    const supabase = await createClient()

    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { success: false, error: 'Não autorizado' }

        // 1. Session base info
        const { data: session, error: sessionError } = await supabase
            .from('workout_sessions')
            .select(`
                id,
                started_at,
                completed_at,
                duration_seconds,
                rpe,
                feedback,
                pre_workout_submission_id,
                post_workout_submission_id,
                assigned_workout_id,
                assigned_workouts ( name )
            `)
            .eq('id', sessionId)
            .single()

        if (sessionError) throw sessionError

        // 2. Fetch set_logs for this session
        const { data: logs, error: logsError } = await supabase
            .from('set_logs')
            .select(`
                id,
                assigned_workout_item_id,
                set_number,
                weight,
                weight_unit,
                reps_completed,
                rpe,
                completed_at,
                notes,
                executed_exercise_id,
                exercise_id,
                executed_exercise:exercises!set_logs_executed_exercise_id_fkey ( name ),
                legacy_exercise:exercises!set_logs_exercise_id_fkey ( name )
            `)
            .eq('workout_session_id', sessionId)
            .order('set_number', { ascending: true })

        if (logsError) throw logsError

        // Index logs by assigned_workout_item_id
        const logsByItem = new Map<string, typeof logs>()
        for (const log of (logs || [])) {
            const itemId = log.assigned_workout_item_id
            if (!itemId) continue
            if (!logsByItem.has(itemId)) logsByItem.set(itemId, [])
            logsByItem.get(itemId)!.push(log)
        }

        // 3. Fetch assigned_workout_items (full workout structure)
        let items: SessionItem[] = []
        let stats: SessionStats = {
            durationSeconds: session.duration_seconds || 0,
            totalSetsPrescribed: 0,
            completedSets: 0,
            totalTonnage: 0,
            exerciseCount: 0,
        }

        if (session.assigned_workout_id) {
            const { data: workoutItems, error: itemsError } = await supabase
                .from('assigned_workout_items')
                .select(`
                    id,
                    item_type,
                    order_index,
                    exercise_id,
                    exercise_name,
                    sets,
                    reps,
                    rest_seconds,
                    notes,
                    exercise_function,
                    item_config,
                    parent_item_id,
                    exercises ( name )
                `)
                .eq('assigned_workout_id', session.assigned_workout_id)
                .order('order_index', { ascending: true })

            if (itemsError) throw itemsError

            // Build items in order, handling supersets
            const topLevelItems = (workoutItems || []).filter(i => !i.parent_item_id)
            const childItems = (workoutItems || []).filter(i => i.parent_item_id)

            for (const item of topLevelItems) {
                const sessionItem = buildSessionItem(item, logsByItem)

                if (item.item_type === 'superset') {
                    // Attach children
                    const children = childItems
                        .filter(c => c.parent_item_id === item.id)
                        .sort((a, b) => a.order_index - b.order_index)
                        .map(c => buildSessionItem(c, logsByItem))
                    sessionItem.children = children

                    // Aggregate stats from children
                    for (const child of children) {
                        if (child.itemType === 'exercise') {
                            stats.exerciseCount++
                            stats.totalSetsPrescribed += child.setsPrescribed || 0
                            stats.completedSets += child.setLogs.length
                            stats.totalTonnage += child.setLogs.reduce((acc, s) => acc + (s.weight * s.reps), 0)
                        }
                    }
                } else if (item.item_type === 'exercise') {
                    stats.exerciseCount++
                    stats.totalSetsPrescribed += sessionItem.setsPrescribed || 0
                    stats.completedSets += sessionItem.setLogs.length
                    stats.totalTonnage += sessionItem.setLogs.reduce((acc, s) => acc + (s.weight * s.reps), 0)
                }

                items.push(sessionItem)
            }
        }

        // Fallback: if no assigned_workout_id or no items, build from set_logs only
        if (items.length === 0 && (logs || []).length > 0) {
            const exercisesMap = new Map<string, { exercise_id: string; name: string; sets: any[] }>()

            for (const log of (logs || [])) {
                const exerciseId = log.executed_exercise_id || log.exercise_id
                if (!exerciseId) continue
                const exName = (log.executed_exercise as any)?.name || (log.legacy_exercise as any)?.name || 'Exercício desconhecido'

                if (!exercisesMap.has(exerciseId)) {
                    exercisesMap.set(exerciseId, { exercise_id: exerciseId, name: exName, sets: [] })
                }
                exercisesMap.get(exerciseId)!.sets.push({
                    setNumber: log.set_number,
                    weight: log.weight || 0,
                    weightUnit: log.weight_unit || 'kg',
                    reps: log.reps_completed || 0,
                    rpe: log.rpe,
                })
            }

            let idx = 0
            for (const [exId, ex] of exercisesMap) {
                ex.sets.sort((a: any, b: any) => a.setNumber - b.setNumber)
                items.push({
                    id: exId,
                    itemType: 'exercise',
                    orderIndex: idx++,
                    exerciseName: ex.name,
                    setLogs: ex.sets,
                    setsPrescribed: ex.sets.length,
                })
                stats.exerciseCount++
                stats.completedSets += ex.sets.length
                stats.totalSetsPrescribed += ex.sets.length
                stats.totalTonnage += ex.sets.reduce((acc: number, s: any) => acc + (s.weight * s.reps), 0)
            }
        }

        // 4. Checkin submissions
        let preCheckin: SessionCheckin | null = null
        let postCheckin: SessionCheckin | null = null

        const submissionIds = [session.pre_workout_submission_id, session.post_workout_submission_id].filter(Boolean)
        if (submissionIds.length > 0) {
            const { data: submissions, error: submissionsError } = await supabase
                .from('form_submissions')
                .select('id, trigger_context, answers_json, schema_snapshot_json, submitted_at, form_templates!form_template_id(title)')
                .in('id', submissionIds)

            if (submissionsError) {
                console.error('Error fetching checkin submissions:', submissionsError.message)
            }

            if (submissions && submissions.length > 0) {
                for (const sub of submissions) {
                    const shaped: SessionCheckin = {
                        id: sub.id,
                        triggerContext: sub.trigger_context || 'manual',
                        answersJson: sub.answers_json as any,
                        schemaJson: sub.schema_snapshot_json,
                        submittedAt: sub.submitted_at || '',
                        formTitle: (sub.form_templates as any)?.title || 'Check-in',
                    }
                    if (sub.id === session.pre_workout_submission_id) preCheckin = shaped
                    if (sub.id === session.post_workout_submission_id) postCheckin = shaped
                }
            }
        }

        // 5. Build legacy exercises array for backward compat
        const legacyExercises = items
            .flatMap(item => {
                if (item.itemType === 'superset' && item.children) {
                    return item.children.filter(c => c.itemType === 'exercise')
                }
                return item.itemType === 'exercise' ? [item] : []
            })
            .map(item => ({
                exercise_id: item.id,
                name: item.exerciseName || 'Exercício',
                muscle_group: null,
                sets: item.setLogs.map(s => ({
                    set_number: s.setNumber,
                    weight: s.weight,
                    reps: s.reps,
                    rpe: s.rpe,
                })),
            }))

        return {
            success: true,
            data: {
                id: session.id,
                started_at: session.started_at,
                completed_at: session.completed_at,
                duration_seconds: session.duration_seconds,
                rpe: session.rpe,
                feedback: session.feedback,
                assigned_workouts: session.assigned_workouts as any || { name: 'Treino' },
                items,
                stats,
                preCheckin,
                postCheckin,
                exercises: legacyExercises,
            }
        }

    } catch (error: any) {
        console.error('Error fetching session details:', error)
        return {
            success: false,
            error: 'Erro ao carregar detalhes do treino.'
        }
    }
}

// ── Helpers ──

function buildSessionItem(
    item: any,
    logsByItem: Map<string, any[]>
): SessionItem {
    const itemType = item.item_type as SessionItem['itemType']
    const exerciseName = (item.exercises as any)?.name || item.exercise_name || undefined

    const result: SessionItem = {
        id: item.id,
        itemType,
        orderIndex: item.order_index,
        exerciseName,
        exerciseFunction: item.exercise_function || undefined,
        itemConfig: item.item_config || undefined,
        notes: item.notes || undefined,
        parentItemId: item.parent_item_id || null,
        setsPrescribed: item.sets || undefined,
        repsPrescribed: item.reps || undefined,
        restSeconds: item.rest_seconds || undefined,
        setLogs: [],
        cardioResult: null,
    }

    const itemLogs = logsByItem.get(item.id) || []

    if (itemType === 'exercise') {
        result.setLogs = itemLogs.map(log => ({
            setNumber: log.set_number,
            weight: log.weight || 0,
            weightUnit: log.weight_unit || 'kg',
            reps: log.reps_completed || 0,
            rpe: log.rpe || null,
        }))
        result.setLogs.sort((a, b) => a.setNumber - b.setNumber)
    }

    if (itemType === 'cardio') {
        // Try to parse cardio result from set_log.notes
        const cardioLog = itemLogs[0]
        if (cardioLog?.notes) {
            try {
                const parsed = JSON.parse(cardioLog.notes)
                result.cardioResult = {
                    mode: parsed.mode,
                    equipment: parsed.equipment,
                    durationMinutes: parsed.duration_minutes,
                    distanceKm: parsed.distance_km,
                    intensity: parsed.intensity,
                    intervals: parsed.intervals,
                    actualDurationSeconds: parsed.actual_duration_seconds,
                }
            } catch {
                // Parse failed — use item_config as prescription only
                result.cardioResult = null
            }
        }
    }

    return result
}
