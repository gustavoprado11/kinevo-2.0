'use client'

import { X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { VideoPlayer } from './video-player'

interface FloatingExercisePlayerProps {
    isOpen: boolean
    onClose: () => void
    videoUrl: string | null
    title: string
}

export function FloatingExercisePlayer({ isOpen, onClose, videoUrl, title }: FloatingExercisePlayerProps) {
    return (
        <AnimatePresence>
            {isOpen && videoUrl && (
                <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.95 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    className="fixed bottom-6 right-6 w-96 z-[60] bg-surface-card/80 backdrop-blur-xl border border-k-border-primary rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden"
                >
                    {/* Header */}
                    <div className="h-8 flex items-center justify-between px-4 bg-glass-bg border-b border-k-border-subtle">
                        <span className="text-[11px] font-bold uppercase tracking-widest text-k-text-tertiary truncate pr-4">
                            {title}
                        </span>
                        <button
                            onClick={onClose}
                            className="text-k-text-quaternary hover:text-k-text-primary hover:bg-glass-bg-active p-1 rounded-full transition-colors"
                        >
                            <X size={14} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-1">
                        <VideoPlayer url={videoUrl} title={title} className="rounded-xl overflow-hidden" />
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
