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
    viewMode?: 'grid' | 'list'
}

export function ExerciseItem({ exercise, currentTrainerId, onEdit, onDelete, viewMode = 'grid' }: ExerciseItemProps) {
    const [isVideoOpen, setIsVideoOpen] = useState(false)
    const isOwner = exercise.owner_id === currentTrainerId
    const muscleGroups = exercise.muscle_groups || []

    const handleVideoClick = (e: React.MouseEvent) => {
        e.stopPropagation()
        setIsVideoOpen(true)
    }

    // --- List View ---
    if (viewMode === 'list') {
        return (
            <>
                <div className="group flex items-center gap-4 px-4 py-3 border-b border-[#E8E8ED] dark:border-transparent last:border-b-0 hover:bg-[#F5F5F7] dark:hover:border-k-border-subtle dark:hover:bg-glass-bg transition-all">
                    <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-[#1D1D1F] dark:text-k-text-secondary dark:group-hover:text-k-text-primary transition-colors truncate block">
                            {exercise.name}
                        </span>
                    </div>

                    {muscleGroups.length > 0 && (
                        <div className="hidden md:flex items-center gap-1.5 shrink-0">
                            {muscleGroups.slice(0, 2).map(g => (
                                <span key={g.id} className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#F5F5F7] dark:bg-glass-bg text-[#6E6E73] dark:text-k-text-quaternary border border-[#E8E8ED] dark:border-k-border-subtle">
                                    {g.name}
                                </span>
                            ))}
                            {muscleGroups.length > 2 && (
                                <span className="text-[10px] text-[#AEAEB2] dark:text-k-text-quaternary font-medium">+{muscleGroups.length - 2}</span>
                            )}
                        </div>
                    )}

                    {exercise.equipment && (
                        <span className="hidden lg:block text-xs text-[#86868B] dark:text-k-text-quaternary shrink-0">{exercise.equipment}</span>
                    )}

                    {exercise.video_url ? (
                        <button onClick={handleVideoClick} className="shrink-0 text-[#34C759] dark:text-violet-400/60 hover:text-[#2DB84D] dark:hover:text-violet-400 transition-colors" title="Ver vídeo">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </button>
                    ) : (
                        <div className="w-4 shrink-0" />
                    )}

                    <ExerciseActionsMenu
                        exercise={exercise}
                        currentTrainerId={currentTrainerId}
                        onEdit={onEdit}
                        onDelete={onDelete}
                    />
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

    // --- Grid View (compact) ---
    return (
        <>
            <div className="group rounded-xl border border-[#E8E8ED] dark:border-k-border-primary bg-white dark:bg-surface-card shadow-apple-card dark:shadow-none transition-all duration-200 hover:shadow-[0_2px_8px_rgba(0,0,0,0.12)] hover:border-[#D2D2D7] dark:hover:border-violet-500/30 overflow-hidden flex flex-col h-full">
                <div className="p-4 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                        <h3 className="truncate text-sm font-medium text-[#1D1D1F] dark:text-k-text-primary tracking-tight dark:group-hover:text-violet-400 transition-colors">
                            {exercise.name}
                        </h3>
                        {isOwner && (
                            <span className="inline-flex items-center mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#F5F5F7] dark:bg-violet-500/10 text-[#6E6E73] dark:text-violet-400 border border-[#E8E8ED] dark:border-violet-500/20">
                                Meu exercício
                            </span>
                        )}
                    </div>

                    <ExerciseActionsMenu
                        exercise={exercise}
                        currentTrainerId={currentTrainerId}
                        onEdit={onEdit}
                        onDelete={onDelete}
                    />
                </div>

                <div className="mt-auto bg-[#F5F5F7] dark:bg-surface-inset p-3 rounded-b-xl border-t border-[#E8E8ED] dark:border-k-border-subtle flex items-center gap-3">
                    {exercise.video_url ? (
                        <button
                            onClick={handleVideoClick}
                            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium text-[#34C759] dark:text-violet-300 hover:text-[#2DB84D] dark:hover:text-k-text-primary dark:hover:bg-glass-bg transition-colors"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Vídeo
                        </button>
                    ) : null}

                    {muscleGroups.length > 0 && (
                        <div className={`flex items-center gap-1.5 text-xs font-medium text-[#86868B] dark:text-muted-foreground/60 ${exercise.video_url ? 'border-l border-[#E8E8ED] dark:border-k-border-subtle pl-3' : ''} truncate`}>
                            <span className="truncate">{muscleGroups.map(g => g.name).join(', ')}</span>
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
