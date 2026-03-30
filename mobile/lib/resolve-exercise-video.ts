export interface TrainerExerciseVideo {
    video_url: string;
    video_type: 'upload' | 'external_url';
}

/**
 * Resolves the effective video URL for an exercise.
 * Custom trainer video takes precedence over the default catalog video.
 */
export function resolveExerciseVideoUrl(
    defaultVideoUrl: string | null | undefined,
    trainerVideo: TrainerExerciseVideo | null | undefined,
): string | null {
    if (trainerVideo?.video_url) return trainerVideo.video_url;
    return defaultVideoUrl || null;
}
