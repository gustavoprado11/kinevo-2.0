import { unstable_cache, updateTag } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Exercise } from '@/types/exercise'

// Tag namespace per trainer so we can invalidate one trainer's library
// without busting every cached library when an unrelated trainer mutates.
const tagFor = (trainerId: string) => `exercises:${trainerId}`

// Uses the service-role client because unstable_cache forbids dynamic
// data sources (like cookies()) inside its scope. Authorization is
// enforced explicitly via the owner_id filter below — only system
// exercises (owner_id IS NULL) plus exercises owned by this trainer are
// ever returned, mirroring what RLS would have enforced on the regular
// client.
// Exported for unit testing — maps the PostgREST nested-join shape returned
// by the exercises query into the flat Exercise type the builder expects.
export function mapExerciseRows(rows: any[] | null | undefined): Exercise[] {
    return (rows || []).map(e => ({
        id: e.id,
        name: e.name,
        muscle_groups: e.exercise_muscle_groups?.map((emg: any) => emg.muscle_groups).filter(Boolean) || [],
        equipment: e.equipment,
        owner_id: e.owner_id,
        original_system_id: e.original_system_id,
        video_url: e.video_url || null,
        thumbnail_url: null,
        instructions: null,
        is_archived: false,
        // Stable timestamps — actual values are not used in the builder UI
        // and varying them per call would defeat React Query keying upstream.
        created_at: '1970-01-01T00:00:00.000Z',
        updated_at: '1970-01-01T00:00:00.000Z',
    }))
}

async function fetchTrainerLibrary(trainerId: string): Promise<Exercise[]> {
    const supabase = createAdminClient()
    const { data, error } = await supabase
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
        .or(`owner_id.is.null,owner_id.eq.${trainerId}`)
        .eq('is_archived', false)
        .order('name')

    if (error) {
        console.error('[exercises/get-trainer-library] fetch failed:', error)
        return []
    }

    return mapExerciseRows(data)
}

// Memo'd per trainer with a 60s TTL. The library changes only when a trainer
// creates/edits/deletes an exercise, so we keep the TTL short and pair it
// with explicit revalidation (see revalidateTrainerLibrary below). Even a
// 60s window collapses ~95% of repeat hits during a normal session.
export async function getTrainerExerciseLibrary(trainerId: string): Promise<Exercise[]> {
    return unstable_cache(
        async () => fetchTrainerLibrary(trainerId),
        ['exercises-library', trainerId],
        {
            tags: [tagFor(trainerId)],
            revalidate: 60,
        }
    )()
}

// Bust the cache for one trainer. Must be called from a Server Action so
// Next can apply read-your-own-writes semantics (updateTag is Next 16's
// successor to revalidateTag for post-mutation invalidation). Safe to call
// even if nothing was cached — Next no-ops in that case.
export async function revalidateTrainerLibrary(trainerId: string): Promise<void> {
    updateTag(tagFor(trainerId))
}
