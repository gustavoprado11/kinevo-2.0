'use client'

import { X } from 'lucide-react'
import { normalizeYouTubeEmbedUrl } from '@/lib/youtube'

interface ExerciseVideoModalProps {
    isOpen: boolean
    onClose: () => void
    videoUrl: string | null | undefined
    exerciseName?: string
}

export function ExerciseVideoModal({
    isOpen,
    onClose,
    videoUrl,
    exerciseName,
}: ExerciseVideoModalProps) {
    if (!isOpen) return null

    const embedUrl = normalizeYouTubeEmbedUrl(videoUrl)

    return (
        <div className="fixed inset-0 z-modal flex items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/85" onClick={onClose} />

            {/* Close button */}
            <button
                onClick={onClose}
                className="absolute top-6 right-6 z-sticky flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
                <X size={20} className="text-white" />
            </button>

            {/* Player container */}
            <div className="relative w-full max-w-3xl mx-4">
                {exerciseName && (
                    <p className="text-white/80 text-sm font-medium mb-3 text-center">
                        {exerciseName}
                    </p>
                )}
                <div className="relative w-full rounded-xl overflow-hidden bg-black" style={{ aspectRatio: '16/9' }}>
                    {embedUrl ? (
                        <iframe
                            src={embedUrl}
                            title={exerciseName || 'Demonstração do exercício'}
                            className="absolute inset-0 w-full h-full"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                        />
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <p className="text-slate-500 text-sm">Vídeo não disponível</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
