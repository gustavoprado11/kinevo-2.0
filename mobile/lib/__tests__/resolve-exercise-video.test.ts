import { describe, it, expect } from 'vitest';
import { resolveExerciseVideoUrl, type TrainerExerciseVideo } from '../resolve-exercise-video';

describe('resolveExerciseVideoUrl', () => {
    const trainerUpload: TrainerExerciseVideo = {
        video_url: 'https://storage.supabase.co/trainer-videos/uid/ex/custom.mp4',
        video_type: 'upload',
    };

    const trainerExternal: TrainerExerciseVideo = {
        video_url: 'https://www.youtube.com/watch?v=custom123',
        video_type: 'external_url',
    };

    const defaultUrl = 'https://www.youtube.com/watch?v=default123';

    it('returns trainer video when both exist (upload)', () => {
        expect(resolveExerciseVideoUrl(defaultUrl, trainerUpload)).toBe(trainerUpload.video_url);
    });

    it('returns trainer video when both exist (external)', () => {
        expect(resolveExerciseVideoUrl(defaultUrl, trainerExternal)).toBe(trainerExternal.video_url);
    });

    it('returns default video when no trainer video', () => {
        expect(resolveExerciseVideoUrl(defaultUrl, null)).toBe(defaultUrl);
        expect(resolveExerciseVideoUrl(defaultUrl, undefined)).toBe(defaultUrl);
    });

    it('returns trainer video when no default video', () => {
        expect(resolveExerciseVideoUrl(null, trainerUpload)).toBe(trainerUpload.video_url);
    });

    it('returns null when neither exists', () => {
        expect(resolveExerciseVideoUrl(null, null)).toBeNull();
        expect(resolveExerciseVideoUrl(undefined, undefined)).toBeNull();
        expect(resolveExerciseVideoUrl('', null)).toBeNull();
    });

    it('ignores trainer video with empty video_url', () => {
        const emptyTrainer: TrainerExerciseVideo = { video_url: '', video_type: 'upload' };
        expect(resolveExerciseVideoUrl(defaultUrl, emptyTrainer)).toBe(defaultUrl);
    });
});
