'use server'

import { createClient } from '@/lib/supabase/server'

export interface SubstituteOption {
    id: string
    name: string
    equipment?: string | null
    video_url?: string | null
    muscle_groups: string[]
    source: 'manual' | 'auto'
}

/**
 * Fetches substitute exercise options for a given exercise.
 * Returns trainer-approved (manual) subs first, then auto-suggestions from
 * the same muscle groups.
 */
export async function getSubstituteExercises(
    substituteExerciseIds: string[],
    exerciseId: string,
): Promise<{ data: SubstituteOption[]; error: string | null }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { data: [], error: 'Não autorizado' }

    const manualIds = (substituteExerciseIds || []).filter(Boolean)

    // Fetch manual (trainer-approved) substitutes
    let manualOptions: SubstituteOption[] = []
    if (manualIds.length > 0) {
        const { data: exercises } = await supabase
            .from('exercises')
            .select(`
                id, name, equipment, video_url,
                exercise_muscle_groups ( muscle_groups ( name ) )
            `)
            .in('id', manualIds)

        if (exercises) {
            const byId = new Map(exercises.map((e: any) => [e.id, e]))
            manualOptions = manualIds
                .map((id) => byId.get(id))
                .filter(Boolean)
                .map((e: any) => ({
                    id: e.id,
                    name: e.name,
                    equipment: e.equipment,
                    video_url: e.video_url,
                    muscle_groups: (e.exercise_muscle_groups || [])
                        .map((emg: any) => emg.muscle_groups?.name)
                        .filter(Boolean),
                    source: 'manual' as const,
                }))
        }
    }

    // Fetch auto-suggestions via smart RPC or same-muscle fallback
    let autoOptions: SubstituteOption[] = []
    const manualIdSet = new Set(manualIds)

    const { data: smartRows, error: smartError } = await (supabase.rpc as any)(
        'get_smart_exercise_substitutes',
        { p_exercise_id: exerciseId },
    )

    let autoIds: string[] = []
    if (!smartError && Array.isArray(smartRows)) {
        autoIds = smartRows
            .map((row: any) => row.id)
            .filter((id: string) => id !== exerciseId && !manualIdSet.has(id))
            .slice(0, 3)
    } else {
        // Fallback: find exercises sharing the same muscle groups
        const { data: groups } = await supabase
            .from('exercise_muscle_groups')
            .select('muscle_group_id')
            .eq('exercise_id', exerciseId)

        const groupIds = [...new Set((groups || []).map((g: any) => g.muscle_group_id).filter(Boolean))]

        if (groupIds.length > 0) {
            const { data: shared } = await supabase
                .from('exercise_muscle_groups')
                .select('exercise_id')
                .in('muscle_group_id', groupIds)

            const sharedIds = [...new Set((shared || []).map((s: any) => s.exercise_id).filter(Boolean))]
            autoIds = sharedIds
                .filter((id: string) => id !== exerciseId && !manualIdSet.has(id))
                .slice(0, 3)
        }
    }

    if (autoIds.length > 0) {
        const { data: exercises } = await supabase
            .from('exercises')
            .select(`
                id, name, equipment, video_url,
                exercise_muscle_groups ( muscle_groups ( name ) )
            `)
            .in('id', autoIds)

        if (exercises) {
            autoOptions = exercises.map((e: any) => ({
                id: e.id,
                name: e.name,
                equipment: e.equipment,
                video_url: e.video_url,
                muscle_groups: (e.exercise_muscle_groups || [])
                    .map((emg: any) => emg.muscle_groups?.name)
                    .filter(Boolean),
                source: 'auto' as const,
            }))
        }
    }

    return { data: [...manualOptions, ...autoOptions], error: null }
}

/**
 * Searches exercises by name for manual swap.
 */
export async function searchExercisesForSwap(
    query: string,
    excludeIds: string[],
): Promise<{ data: SubstituteOption[]; error: string | null }> {
    if (!query || query.trim().length < 2) return { data: [], error: null }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: [], error: 'Não autorizado' }

    const { data: exercises } = await supabase
        .from('exercises')
        .select(`
            id, name, equipment, video_url,
            exercise_muscle_groups ( muscle_groups ( name ) )
        `)
        .ilike('name', `%${query.trim()}%`)
        .not('id', 'in', `(${excludeIds.join(',')})`)
        .limit(10)

    if (!exercises) return { data: [], error: null }

    return {
        data: exercises.map((e: any) => ({
            id: e.id,
            name: e.name,
            equipment: e.equipment,
            video_url: e.video_url,
            muscle_groups: (e.exercise_muscle_groups || [])
                .map((emg: any) => emg.muscle_groups?.name)
                .filter(Boolean),
            source: 'auto' as const,
        })),
        error: null,
    }
}
