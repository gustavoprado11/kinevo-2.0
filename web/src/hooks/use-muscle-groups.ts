import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MuscleGroup } from '@/types/exercise'

export function useMuscleGroups(trainerId?: string) {
    const [muscleGroups, setMuscleGroups] = useState<MuscleGroup[]>([])
    const [loading, setLoading] = useState(true)

    const fetchMuscleGroups = useCallback(async () => {
        const supabase = createClient()
        // Query: System groups (owner_id is null) OR My groups (owner_id = trainerId)

        let query = supabase
            .from('muscle_groups')
            .select('*')
            .order('name')

        // If we want to filter by owner in the query, we can, but RLS should handle permissions.
        // However, for UX 'My Groups' vs 'System', we might want to know.
        // Standard behavior: select * returns what I have access to.

        const { data, error } = await query

        if (!error && data) {
            setMuscleGroups(data)
        }
        setLoading(false)
    }, [])

    useEffect(() => {
        fetchMuscleGroups()
    }, [fetchMuscleGroups])

    const createMuscleGroup = async (name: string): Promise<MuscleGroup | null> => {
        if (!trainerId) {
            console.error('Trainer ID required to create muscle group')
            return null
        }

        const supabase = createClient()

        // Check duplicates (optimistic case-insensitive check)
        const exists = muscleGroups.find(m => m.name.toLowerCase() === name.toLowerCase())
        if (exists) return exists

        const { data, error } = await supabase
            .from('muscle_groups')
            .insert({
                name,
                owner_id: trainerId
            })
            .select()
            .single()

        if (error) {
            console.error('Error creating muscle group:', error)
            return null
        }

        if (data) {
            setMuscleGroups(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
            return data
        }
        return null
    }

    const updateMuscleGroup = async (id: string, newName: string): Promise<boolean> => {
        if (!trainerId) return false

        // Check duplicates
        const exists = muscleGroups.some(g => g.id !== id && g.name.toLowerCase() === newName.toLowerCase())
        if (exists) return false

        const supabase = createClient()
        const { error } = await supabase
            .from('muscle_groups')
            .update({ name: newName })
            .eq('id', id)
            .eq('owner_id', trainerId) // Security

        if (error) {
            console.error('Error updating muscle group:', error)
            return false
        }

        setMuscleGroups(prev => prev.map(g => g.id === id ? { ...g, name: newName } : g).sort((a, b) => a.name.localeCompare(b.name)))
        return true
    }

    const deleteMuscleGroup = async (id: string): Promise<boolean> => {
        if (!trainerId) return false

        const supabase = createClient()
        const { error } = await supabase
            .from('muscle_groups')
            .delete()
            .eq('id', id)
            .eq('owner_id', trainerId) // Security

        if (error) {
            console.error('Error deleting muscle group:', error)
            return false
        }

        setMuscleGroups(prev => prev.filter(g => g.id !== id))
        return true
    }

    const checkUsageCount = async (id: string): Promise<number> => {
        const supabase = createClient()
        const { count, error } = await supabase
            .from('exercise_muscle_groups')
            .select('*', { count: 'exact', head: true })
            .eq('muscle_group_id', id)

        if (error) {
            console.error('Error checking usage:', error)
            return 0
        }
        return count || 0
    }

    return {
        muscleGroups,
        loading,
        createMuscleGroup,
        updateMuscleGroup,
        deleteMuscleGroup,
        checkUsageCount,
        refresh: fetchMuscleGroups
    }
}
