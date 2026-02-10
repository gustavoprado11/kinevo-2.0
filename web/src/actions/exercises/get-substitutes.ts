'use server'

import { createClient } from '@/lib/supabase/server'

export type SubstituteSource = 'manual' | 'auto'

export interface ExerciseSubstitute {
    id: string
    name: string
    imageUrl?: string | null
    similarityScore?: number | null
    equipment: string | null
    muscleGroups: string[]
    source: SubstituteSource
}

export interface GetExerciseSubstitutesResult {
    success: boolean
    data: ExerciseSubstitute[]
    message?: string
}

function uniqIds(ids: Array<string | null | undefined>): string[] {
    return Array.from(new Set(ids.filter((id): id is string => Boolean(id))))
}

export async function getExerciseSubstitutes(
    originalExerciseId: string,
    assignedItemId: string
): Promise<GetExerciseSubstitutesResult> {
    const supabase = await createClient()

    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
        return { success: false, data: [], message: 'Sessão inválida.' }
    }

    const maxResults = 2

    try {
        // 1) Manual substitutes from assigned item (fallback to template item id if needed)
        let manualIds: string[] = []

        const { data: assignedItem } = await supabase
            .from('assigned_workout_items')
            .select('substitute_exercise_ids')
            .eq('id', assignedItemId)
            .maybeSingle()

        if (assignedItem?.substitute_exercise_ids?.length) {
            manualIds = uniqIds(assignedItem.substitute_exercise_ids).filter((id) => id !== originalExerciseId)
        } else {
            const { data: templateItem } = await supabase
                .from('workout_item_templates')
                .select('substitute_exercise_ids')
                .eq('id', assignedItemId)
                .maybeSingle()

            manualIds = uniqIds(templateItem?.substitute_exercise_ids || []).filter((id) => id !== originalExerciseId)
        }

        const fetchExercises = async (ids: string[], source: SubstituteSource): Promise<ExerciseSubstitute[]> => {
            if (ids.length === 0) return []

            const { data, error } = await supabase
                .from('exercises')
                .select(`
                    id,
                    name,
                    image_url,
                    equipment,
                    exercise_muscle_groups (
                        muscle_groups ( name )
                    )
                `)
                .in('id', ids)

            if (error || !data) return []

            const byId = new Map(
                data.map((exercise) => [
                    exercise.id,
                    {
                        id: exercise.id,
                        name: exercise.name,
                        imageUrl: exercise.image_url,
                        equipment: exercise.equipment,
                        muscleGroups:
                            exercise.exercise_muscle_groups
                                ?.map((emg: any) => emg.muscle_groups?.name)
                                .filter(Boolean) || [],
                        source,
                    } satisfies ExerciseSubstitute,
                ])
            )

            const orderedExercises: ExerciseSubstitute[] = []

            for (const id of ids) {
                const exercise = byId.get(id)
                if (exercise) orderedExercises.push(exercise)
            }

            return orderedExercises
        }

        const manualExercises = (await fetchExercises(manualIds, 'manual')).slice(0, maxResults)
        if (manualExercises.length >= maxResults) {
            return { success: true, data: manualExercises }
        }

        // 2) Automatic substitutes via smart RPC (same muscles + trigram similarity)
        const slotsNeeded = maxResults - manualExercises.length
        const manualSet = new Set(manualExercises.map((exercise) => exercise.id))

        const { data: autoRows, error: autoError } = await supabase.rpc('get_smart_substitutes', {
            target_exercise_id: originalExerciseId,
            match_limit: slotsNeeded,
        })

        if (autoError) {
            console.error('[getExerciseSubstitutes] Smart RPC error:', autoError)
            return { success: true, data: manualExercises, message: 'Não foi possível carregar sugestões automáticas.' }
        }

        const autoExercises: ExerciseSubstitute[] = ((autoRows || []) as Array<{
            id: string
            name: string
            image_url: string | null
            similarity_score: number
        }>)
            .filter((row) => row.id !== originalExerciseId && !manualSet.has(row.id))
            .map((row) => ({
                id: row.id,
                name: row.name,
                imageUrl: row.image_url,
                similarityScore: row.similarity_score,
                equipment: null,
                muscleGroups: [],
                source: 'auto' as const,
            }))

        return {
            success: true,
            data: [...manualExercises, ...autoExercises].slice(0, maxResults),
        }
    } catch (error) {
        console.error('[getExerciseSubstitutes] Unexpected error:', error)
        return { success: false, data: [], message: 'Não foi possível carregar substituições.' }
    }
}
