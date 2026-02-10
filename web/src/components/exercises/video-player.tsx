'use client'

import { useMemo } from 'react'
import { normalizeYouTubeEmbedUrl } from '@/lib/youtube'

interface VideoPlayerProps {
    url: string | null
    title?: string
    className?: string
}

export function VideoPlayer({ url, title, className = '' }: VideoPlayerProps) {
    const embedUrl = useMemo(() => normalizeYouTubeEmbedUrl(url), [url])

    if (!embedUrl) {
        return (
            <div className={`bg-gray-800 rounded-lg flex items-center justify-center aspect-video ${className}`}>
                <div className="text-gray-500 flex flex-col items-center gap-2">
                    <svg className="w-8 h-8 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <span className="text-sm">Vídeo indisponível ou link inválido</span>
                </div>
            </div>
        )
    }

    return (
        <div className={`overflow-hidden rounded-lg bg-black aspect-video relative ${className}`}>
            <iframe
                src={embedUrl}
                title={title || 'Vídeo do exercício'}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 w-full h-full"
            />
        </div>
    )
}
