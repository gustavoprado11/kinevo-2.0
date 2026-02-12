'use client'

import { Exercise } from '@/types/exercise'

export interface ExerciseWithDetails extends Exercise {
    owner_id: string | null
    image_url: string | null
    original_system_id?: string | null
    video_url: string | null
}

import { useState } from 'react'
import { ExerciseActionsMenu } from './exercise-actions-menu'
import { VideoPreviewModal } from './video-preview-modal'

interface ExerciseItemProps {
    exercise: ExerciseWithDetails
    currentTrainerId: string
    onEdit: (exercise: ExerciseWithDetails) => void
    onDelete: (exercise: ExerciseWithDetails) => void
}

export function ExerciseItem({ exercise, currentTrainerId, onEdit, onDelete }: ExerciseItemProps) {
    const [isVideoOpen, setIsVideoOpen] = useState(false)
    const isOwner = exercise.owner_id === currentTrainerId
    const isSystem = !exercise.owner_id

    // Use muscle_groups array if available
    const muscleGroups = exercise.muscle_groups || []

    const handleVideoClick = (e: React.MouseEvent) => {
        e.stopPropagation()
        setIsVideoOpen(true)
    }

    return (
        <>
            <div className="group rounded-2xl border border-k-border-primary bg-surface-card shadow-md transition-all duration-300 hover:border-violet-500/30 hover:shadow-xl hover:shadow-violet-500/5 hover:-translate-y-1 overflow-hidden flex flex-col h-full">
                <div className="p-5 flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                            <h3 className="truncate text-base font-semibold text-k-text-primary dark:text-white tracking-tight group-hover:text-violet-400 transition-colors">
                                {exercise.name}
                            </h3>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {isSystem && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                    Sistema
                                </span>
                            )}
                            {isOwner && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-violet-500/10 text-violet-400 border border-violet-500/20">
                                    Meu exercício
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Actions */}
                    <ExerciseActionsMenu
                        exercise={exercise}
                        currentTrainerId={currentTrainerId}
                        onEdit={onEdit}
                        onDelete={onDelete}
                    />
                </div>

                {/* Card Footer */}
                <div className="mt-auto bg-surface-inset p-3 rounded-b-2xl border-t border-k-border-subtle flex items-center gap-3">
                    {/* Video Indicator */}
                    {exercise.video_url ? (
                        <button
                            onClick={handleVideoClick}
                            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium text-violet-300 hover:text-k-text-primary hover:bg-glass-bg transition-colors"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Vídeo
                        </button>
                    ) : (
                        <span className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium text-muted-foreground/40 cursor-not-allowed">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                            Sem vídeo
                        </span>
                    )}

                    {/* Muscle Groups */}
                    {muscleGroups.length > 0 && (
                        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground/60 border-l border-k-border-subtle pl-3">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16m-7 6h7" />
                            </svg>
                            <span className="truncate max-w-[120px]">
                                {muscleGroups.map(g => g.name).join(', ')}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            <VideoPreviewModal
                isOpen={isVideoOpen}
                onClose={() => setIsVideoOpen(false)}
                videoUrl={exercise.video_url || null}
                title={exercise.name}
            />
        </>
    )
}
