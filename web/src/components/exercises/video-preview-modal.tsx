'use client'

import { VideoPlayer } from './video-player'

interface VideoPreviewModalProps {
    isOpen: boolean
    onClose: () => void
    videoUrl: string | null
    title: string
}

export function VideoPreviewModal({ isOpen, onClose, videoUrl, title }: VideoPreviewModalProps) {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-gray-900 rounded-2xl shadow-2xl w-full max-w-3xl border border-gray-800 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-900/50">
                    <h3 className="text-lg font-semibold text-white truncate pr-4">
                        {title}
                    </h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="bg-black p-4">
                    <VideoPlayer url={videoUrl} title={title} />
                </div>
            </div>
        </div>
    )
}
