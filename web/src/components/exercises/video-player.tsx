'use client'

import { useMemo, useState } from 'react'
import { normalizeYouTubeEmbedUrl, isDirectVideoUrl } from '@/lib/youtube'

interface VideoPlayerProps {
    url: string | null
    title?: string
    className?: string
}

export function VideoPlayer({ url, title, className = '' }: VideoPlayerProps) {
    const embedUrl = useMemo(() => normalizeYouTubeEmbedUrl(url), [url])
    const isDirect = useMemo(() => isDirectVideoUrl(url), [url])
    const [videoError, setVideoError] = useState(false)

    if (!embedUrl && !isDirect) {
        return (
            <div className={`aspect-video rounded-lg bg-muted flex items-center justify-center ${className}`}>
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <svg className="w-8 h-8 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <span className="text-sm">Vídeo indisponível ou link inválido</span>
                </div>
            </div>
        )
    }

    if (isDirect) {
        if (videoError) {
            return (
                <div className={`aspect-video rounded-lg bg-black flex items-center justify-center ${className}`}>
                    <div className="flex flex-col items-center gap-3 text-white/60 px-4 text-center">
                        <svg className="w-8 h-8 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        <span className="text-sm">Formato não suportado pelo navegador</span>
                        <a
                            href={url!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-violet-400 hover:text-violet-300 underline underline-offset-2"
                        >
                            Baixar vídeo
                        </a>
                    </div>
                </div>
            )
        }

        // Hint video/mp4 for .mov URLs so Chrome/Firefox attempt MP4 decoding
        const mimeHint = /\.mov(\?.*)?$/i.test(url!) ? 'video/mp4' : undefined

        return (
            <div className={`overflow-hidden rounded-lg bg-black aspect-video relative ${className}`}>
                <video
                    title={title || 'Vídeo do exercício'}
                    controls
                    playsInline
                    onError={() => setVideoError(true)}
                    className="absolute inset-0 w-full h-full object-contain"
                >
                    <source src={url!} type={mimeHint} />
                </video>
            </div>
        )
    }

    return (
        <div className={`overflow-hidden rounded-lg bg-black aspect-video relative ${className}`}>
            <iframe
                src={embedUrl!}
                title={title || 'Vídeo do exercício'}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 w-full h-full"
            />
        </div>
    )
}
