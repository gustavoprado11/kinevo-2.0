/**
 * Extracts a YouTube video ID from various URL formats.
 * Port of web/src/lib/youtube.ts → returns videoId only (for react-native-youtube-iframe).
 */
export function extractYouTubeId(videoUrl: string | null | undefined): string | null {
    if (!videoUrl) return null;

    try {
        const urlObj = new URL(videoUrl);
        let videoId = "";

        if (urlObj.hostname.includes("youtube.com")) {
            if (urlObj.pathname.startsWith("/shorts/")) {
                videoId = urlObj.pathname.split("/shorts/")[1]?.split("/")[0] || "";
            } else if (urlObj.pathname.startsWith("/embed/")) {
                videoId = urlObj.pathname.split("/embed/")[1]?.split("/")[0] || "";
            } else if (urlObj.pathname === "/watch") {
                videoId = urlObj.searchParams.get("v") || "";
            }
        } else if (urlObj.hostname === "youtu.be") {
            videoId = urlObj.pathname.slice(1).split("/")[0];
        }

        return videoId || null;
    } catch {
        return null;
    }
}

/**
 * Checks if a URL points to a direct video file (MP4, MOV, WebM).
 */
export function isDirectVideoUrl(url: string | null | undefined): boolean {
    if (!url) return false;
    try {
        const u = new URL(url);
        return /\.(mp4|mov|webm)(\?.*)?$/i.test(u.pathname);
    } catch {
        return false;
    }
}
