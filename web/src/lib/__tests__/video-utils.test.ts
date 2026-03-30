import { describe, it, expect } from 'vitest'
import { isDirectVideoUrl, normalizeYouTubeEmbedUrl } from '../youtube'

describe('isDirectVideoUrl', () => {
    it('returns true for .mp4 URLs', () => {
        expect(isDirectVideoUrl('https://example.com/video.mp4')).toBe(true)
    })

    it('returns true for .mov URLs', () => {
        expect(isDirectVideoUrl('https://example.com/video.mov')).toBe(true)
    })

    it('returns true for .webm URLs', () => {
        expect(isDirectVideoUrl('https://example.com/video.webm')).toBe(true)
    })

    it('returns true for Supabase Storage URLs with query params', () => {
        expect(isDirectVideoUrl('https://abc.supabase.co/storage/v1/object/public/trainer-videos/uid/ex/file.mp4?token=xyz')).toBe(true)
    })

    it('returns true regardless of case', () => {
        expect(isDirectVideoUrl('https://example.com/video.MP4')).toBe(true)
        expect(isDirectVideoUrl('https://example.com/video.WebM')).toBe(true)
    })

    it('returns false for YouTube URLs', () => {
        expect(isDirectVideoUrl('https://www.youtube.com/watch?v=abc123')).toBe(false)
    })

    it('returns false for Vimeo URLs', () => {
        expect(isDirectVideoUrl('https://vimeo.com/123456')).toBe(false)
    })

    it('returns false for null/undefined/empty', () => {
        expect(isDirectVideoUrl(null)).toBe(false)
        expect(isDirectVideoUrl(undefined)).toBe(false)
        expect(isDirectVideoUrl('')).toBe(false)
    })

    it('returns false for URLs without video extension', () => {
        expect(isDirectVideoUrl('https://example.com/page')).toBe(false)
        expect(isDirectVideoUrl('https://example.com/image.png')).toBe(false)
    })

    it('returns false for invalid URLs', () => {
        expect(isDirectVideoUrl('not-a-url')).toBe(false)
    })
})

describe('normalizeYouTubeEmbedUrl', () => {
    it('converts watch?v= URL to embed URL', () => {
        expect(normalizeYouTubeEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ'))
            .toBe('https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1')
    })

    it('converts youtu.be short URL to embed URL', () => {
        expect(normalizeYouTubeEmbedUrl('https://youtu.be/dQw4w9WgXcQ'))
            .toBe('https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1')
    })

    it('converts shorts URL to embed URL', () => {
        expect(normalizeYouTubeEmbedUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ'))
            .toBe('https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1')
    })

    it('normalizes existing embed URL', () => {
        expect(normalizeYouTubeEmbedUrl('https://www.youtube.com/embed/dQw4w9WgXcQ'))
            .toBe('https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1')
    })

    it('returns null for non-YouTube URLs', () => {
        expect(normalizeYouTubeEmbedUrl('https://vimeo.com/123456')).toBeNull()
        expect(normalizeYouTubeEmbedUrl('https://example.com/video.mp4')).toBeNull()
    })

    it('returns null for null/undefined/empty', () => {
        expect(normalizeYouTubeEmbedUrl(null)).toBeNull()
        expect(normalizeYouTubeEmbedUrl(undefined)).toBeNull()
        expect(normalizeYouTubeEmbedUrl('')).toBeNull()
    })

    it('returns null for invalid URLs', () => {
        expect(normalizeYouTubeEmbedUrl('not-a-url')).toBeNull()
    })

    it('returns null for YouTube URLs without video ID', () => {
        expect(normalizeYouTubeEmbedUrl('https://www.youtube.com/')).toBeNull()
        expect(normalizeYouTubeEmbedUrl('https://www.youtube.com/channel/UCxyz')).toBeNull()
    })
})
