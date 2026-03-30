import { describe, it, expect } from 'vitest';
import { extractYouTubeId, isDirectVideoUrl } from '../youtube';

describe('extractYouTubeId', () => {
    it('extracts ID from watch?v= URL', () => {
        expect(extractYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    it('extracts ID from youtu.be short URL', () => {
        expect(extractYouTubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    it('extracts ID from shorts URL', () => {
        expect(extractYouTubeId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    it('extracts ID from embed URL', () => {
        expect(extractYouTubeId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    it('returns null for non-YouTube URLs', () => {
        expect(extractYouTubeId('https://vimeo.com/123456')).toBeNull();
        expect(extractYouTubeId('https://example.com/video.mp4')).toBeNull();
    });

    it('returns null for null/undefined/empty', () => {
        expect(extractYouTubeId(null)).toBeNull();
        expect(extractYouTubeId(undefined)).toBeNull();
        expect(extractYouTubeId('')).toBeNull();
    });

    it('returns null for invalid URLs', () => {
        expect(extractYouTubeId('not-a-url')).toBeNull();
    });

    it('returns null for YouTube URLs without video ID', () => {
        expect(extractYouTubeId('https://www.youtube.com/')).toBeNull();
        expect(extractYouTubeId('https://www.youtube.com/channel/UCxyz')).toBeNull();
    });
});

describe('isDirectVideoUrl', () => {
    it('returns true for .mp4 URLs', () => {
        expect(isDirectVideoUrl('https://example.com/video.mp4')).toBe(true);
    });

    it('returns true for .mov URLs', () => {
        expect(isDirectVideoUrl('https://example.com/video.mov')).toBe(true);
    });

    it('returns true for .webm URLs', () => {
        expect(isDirectVideoUrl('https://example.com/video.webm')).toBe(true);
    });

    it('returns true for URLs with query params', () => {
        expect(isDirectVideoUrl('https://abc.supabase.co/storage/v1/object/public/file.mp4?token=xyz')).toBe(true);
    });

    it('returns false for YouTube URLs', () => {
        expect(isDirectVideoUrl('https://www.youtube.com/watch?v=abc123')).toBe(false);
    });

    it('returns false for null/undefined/empty', () => {
        expect(isDirectVideoUrl(null)).toBe(false);
        expect(isDirectVideoUrl(undefined)).toBe(false);
        expect(isDirectVideoUrl('')).toBe(false);
    });

    it('returns false for non-video URLs', () => {
        expect(isDirectVideoUrl('https://example.com/image.png')).toBe(false);
    });
});
