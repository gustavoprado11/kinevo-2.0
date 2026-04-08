/**
 * Client-side video utilities for detecting HEVC and converting
 * incompatible videos to browser-friendly MP4/WebM before upload.
 *
 * Why client-side? Vercel Serverless Functions don't have FFmpeg
 * and have a 50MB bundle limit, making server-side transcoding
 * impractical. The Canvas + MediaRecorder approach uses native
 * browser APIs with zero external dependencies.
 */

/**
 * Checks if a file is likely an HEVC/H.265 video from iPhone.
 *
 * iPhones with iOS 11+ record in HEVC by default. These .mov files
 * won't play in Chrome or Firefox — only Safari supports HEVC natively.
 */
export function isLikelyHEVC(file: File): boolean {
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext !== 'mov') return false
    return file.type === 'video/quicktime' || file.type === ''
}

/**
 * Tests if the current browser can play a video file by loading it
 * in a hidden <video> element and checking if metadata loads.
 *
 * Returns true if playable, false if the browser can't decode it.
 */
export function canBrowserPlayVideo(file: File): Promise<boolean> {
    return new Promise((resolve) => {
        const video = document.createElement('video')
        const url = URL.createObjectURL(file)
        let resolved = false

        const cleanup = () => {
            if (!resolved) {
                resolved = true
                video.removeAttribute('src')
                video.load()
                URL.revokeObjectURL(url)
            }
        }

        video.onloadedmetadata = () => {
            cleanup()
            resolve(true)
        }

        video.onerror = () => {
            cleanup()
            resolve(false)
        }

        setTimeout(() => {
            if (!resolved) {
                cleanup()
                resolve(false)
            }
        }, 5000)

        video.preload = 'metadata'
        video.src = url
    })
}

/**
 * Re-encodes a video file to WebM (VP8/VP9) using Canvas + MediaRecorder.
 *
 * This is a browser-native approach that works without any external
 * libraries. It plays the video in a hidden <video>, draws each frame
 * to a <canvas>, and records the canvas output with MediaRecorder.
 *
 * Limitations:
 * - Quality depends on browser's MediaRecorder implementation
 * - Only works in browsers that support MediaRecorder (Chrome, Firefox, Edge)
 * - Re-encoding takes roughly 1x the video duration
 * - Audio is included via captureStream()
 *
 * @param file The original video file (e.g. HEVC .mov from iPhone)
 * @param onProgress Callback with progress 0-100
 * @returns A new File object in WebM format, or null if conversion fails
 */
export async function convertVideoToWebM(
    file: File,
    onProgress?: (percent: number) => void,
): Promise<File | null> {
    // Check if MediaRecorder is available
    if (typeof MediaRecorder === 'undefined') {
        console.warn('[convertVideo] MediaRecorder not available')
        return null
    }

    // Check supported MIME types for recording
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
            ? 'video/webm;codecs=vp8,opus'
            : MediaRecorder.isTypeSupported('video/webm')
                ? 'video/webm'
                : null

    if (!mimeType) {
        console.warn('[convertVideo] No supported WebM MIME type for MediaRecorder')
        return null
    }

    return new Promise((resolve) => {
        const video = document.createElement('video')
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        const url = URL.createObjectURL(file)
        const chunks: Blob[] = []

        let animFrameId: number | null = null
        let recorder: MediaRecorder | null = null

        const cleanup = () => {
            if (animFrameId) cancelAnimationFrame(animFrameId)
            if (recorder && recorder.state !== 'inactive') {
                try { recorder.stop() } catch { /* ignore */ }
            }
            video.removeAttribute('src')
            video.load()
            URL.revokeObjectURL(url)
        }

        // Timeout: max 3 minutes for conversion
        const timeout = setTimeout(() => {
            console.warn('[convertVideo] Conversion timed out')
            cleanup()
            resolve(null)
        }, 180_000)

        video.onloadedmetadata = () => {
            canvas.width = video.videoWidth
            canvas.height = video.videoHeight

            // Create stream from canvas + video audio
            const canvasStream = canvas.captureStream(30) // 30fps
            try {
                const audioTracks = (video as any).captureStream?.()?.getAudioTracks?.() || []
                audioTracks.forEach((track: MediaStreamTrack) => canvasStream.addTrack(track))
            } catch {
                // Audio capture not supported in all browsers — proceed without audio
            }

            recorder = new MediaRecorder(canvasStream, {
                mimeType,
                videoBitsPerSecond: 2_500_000, // 2.5 Mbps — good quality for exercise demos
            })

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunks.push(e.data)
            }

            recorder.onstop = () => {
                clearTimeout(timeout)
                const blob = new Blob(chunks, { type: 'video/webm' })
                const baseName = file.name.replace(/\.\w+$/, '')
                const converted = new File([blob], `${baseName}.webm`, { type: 'video/webm' })
                cleanup()
                resolve(converted)
            }

            recorder.onerror = () => {
                clearTimeout(timeout)
                cleanup()
                resolve(null)
            }

            // Start recording + playback
            recorder.start(100) // Collect data every 100ms
            video.play()

            // Draw video frames to canvas
            const drawFrame = () => {
                if (video.paused || video.ended) return
                ctx?.drawImage(video, 0, 0, canvas.width, canvas.height)

                // Report progress
                if (onProgress && video.duration) {
                    const percent = Math.min(99, Math.round((video.currentTime / video.duration) * 100))
                    onProgress(percent)
                }

                animFrameId = requestAnimationFrame(drawFrame)
            }
            drawFrame()
        }

        video.onended = () => {
            // Draw final frame
            ctx?.drawImage(video, 0, 0, canvas.width, canvas.height)
            onProgress?.(100)

            // Small delay to ensure last frame is captured
            setTimeout(() => {
                if (recorder && recorder.state === 'recording') {
                    recorder.stop()
                }
            }, 200)
        }

        video.onerror = () => {
            clearTimeout(timeout)
            cleanup()
            resolve(null)
        }

        // Configure video for silent autoplay (required for captureStream)
        video.muted = true
        video.playsInline = true
        video.preload = 'auto'
        video.src = url
    })
}
