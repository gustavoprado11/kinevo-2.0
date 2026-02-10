/**
 * Extracts a YouTube video ID from various URL formats:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * - https://www.youtube.com/shorts/VIDEO_ID
 * - Just the raw VIDEO_ID (11 chars)
 */
export function extractYoutubeId(url: string | null | undefined): string | null {
    if (!url) return null;

    const trimmed = url.trim();

    // Already a bare ID (11 alphanumeric + dash/underscore chars)
    if (/^[\w-]{11}$/.test(trimmed)) {
        return trimmed;
    }

    const patterns = [
        /(?:youtube\.com\/watch\?.*v=)([\w-]{11})/,
        /(?:youtu\.be\/)([\w-]{11})/,
        /(?:youtube\.com\/embed\/)([\w-]{11})/,
        /(?:youtube\.com\/shorts\/)([\w-]{11})/,
    ];

    for (const pattern of patterns) {
        const match = trimmed.match(pattern);
        if (match?.[1]) return match[1];
    }

    return null;
}
