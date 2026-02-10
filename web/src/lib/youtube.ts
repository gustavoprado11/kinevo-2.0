/**
 * Normalizes a YouTube URL to an embed URL.
 * Supports:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/shorts/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * 
 * @param videoUrl The raw video URL
 * @returns The embed URL or null if invalid
 */
export function normalizeYouTubeEmbedUrl(videoUrl: string | null | undefined): string | null {
    if (!videoUrl) return null

    try {
        const urlObj = new URL(videoUrl)
        let videoId = ''

        if (urlObj.hostname.includes('youtube.com')) {
            if (urlObj.pathname.startsWith('/shorts/')) {
                videoId = urlObj.pathname.split('/shorts/')[1]?.split('/')[0] || ''
            } else if (urlObj.pathname.startsWith('/embed/')) {
                videoId = urlObj.pathname.split('/embed/')[1]?.split('/')[0] || ''
            } else if (urlObj.pathname === '/watch') {
                videoId = urlObj.searchParams.get('v') || ''
            }
        } else if (urlObj.hostname === 'youtu.be') {
            videoId = urlObj.pathname.slice(1).split('/')[0]
        }

        if (videoId) {
            return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`
        }

        return null
    } catch {
        return null
    }
}
