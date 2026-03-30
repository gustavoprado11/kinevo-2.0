import { createClient } from '@/lib/supabase/server'
import { getTrainerWithSubscription } from '@/lib/auth/get-trainer'
import { ExercisesClient, type ExerciseWithDetails } from '@/components/exercises'

export default async function ExercisesPage() {
    const { trainer } = await getTrainerWithSubscription()

    const supabase = await createClient()

    // Fetch exercises using RLS (returns system + trainer owned)
    const { data: exercises } = await supabase
        .from('exercises')
        .select(`
            id,
            name,
            equipment,
            owner_id,
            original_system_id,
            video_url,
            image_url,
            is_archived,
            created_at,
            updated_at,
            exercise_muscle_groups (
                muscle_groups (
                    id,
                    name,
                    owner_id,
                    created_at
                )
            )
        `)
        .eq('is_archived', false)
        .order('name', { ascending: true })

    // Fetch trainer's custom videos (single query, build map)
    const { data: trainerVideos } = await supabase
        .from('trainer_exercise_videos')
        .select('exercise_id, video_url, video_type')
        .eq('trainer_id', trainer.id)

    const trainerVideosMap: Record<string, { video_url: string; video_type: 'upload' | 'external_url' }> = {}
    for (const tv of trainerVideos || []) {
        trainerVideosMap[tv.exercise_id] = { video_url: tv.video_url, video_type: tv.video_type as 'upload' | 'external_url' }
    }

    // Map to ensure types (optional but good for safety)
    const mappedExercises: ExerciseWithDetails[] = (exercises || []).map(e => ({
        id: e.id,
        name: e.name,
        // Flatten junction
        muscle_groups: e.exercise_muscle_groups?.map((emg: any) => emg.muscle_groups) || [],
        equipment: e.equipment,
        owner_id: e.owner_id,
        image_url: e.image_url || null,
        original_system_id: e.original_system_id,
        video_url: e.video_url || null,
        thumbnail_url: null,
        instructions: null,
        is_archived: e.is_archived,
        created_at: e.created_at,
        updated_at: e.updated_at
    }))

    return (
        <ExercisesClient
            initialExercises={mappedExercises}
            currentTrainerId={trainer.id}
            trainerName={trainer.name}
            trainerEmail={trainer.email}
            trainerAvatarUrl={trainer.avatar_url}
            trainerTheme={trainer.theme ?? undefined}
            initialTrainerVideosMap={trainerVideosMap}
        />
    )
}
