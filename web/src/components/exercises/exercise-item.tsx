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
                <div className="group flex items-center gap-4 px-4 py-3 rounded-xl border border-transparent hover:border-k-border-subtle hover:bg-glass-bg transition-all">
                    <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-k-text-secondary group-hover:text-white transition-colors truncate block">
                            {exercise.name}
                        </span>
                    </div>

                    {muscleGroups.length > 0 && (
                        <div className="hidden md:flex items-center gap-1.5 shrink-0">
                            {muscleGroups.slice(0, 2).map(g => (
                                <span key={g.id} className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-glass-bg text-k-text-quaternary border border-k-border-subtle">
                                    {g.name}
                                </span>
                            ))}
                            {muscleGroups.length > 2 && (
                                <span className="text-[10px] text-k-text-quaternary font-medium">+{muscleGroups.length - 2}</span>
                            )}
                        </div>
                    )}

                    {exercise.equipment && (
                        <span className="hidden lg:block text-xs text-k-text-quaternary shrink-0">{exercise.equipment}</span>
                    )}

                    {exercise.video_url ? (
                        <button onClick={handleVideoClick} className="shrink-0 text-violet-400/60 hover:text-violet-400 transition-colors" title="Ver vídeo">
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
            <div className="group rounded-2xl border border-k-border-primary bg-surface-card transition-all duration-200 hover:border-violet-500/30 overflow-hidden flex flex-col h-full">
                <div className="p-4 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                        <h3 className="truncate text-sm font-semibold text-white tracking-tight group-hover:text-violet-400 transition-colors">
                            {exercise.name}
                        </h3>
                        {isOwner && (
                            <span className="inline-flex items-center mt-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-violet-500/10 text-violet-400 border border-violet-500/20">
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

                <div className="mt-auto bg-surface-inset p-3 rounded-b-2xl border-t border-k-border-subtle flex items-center gap-3">
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
                        <span className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium text-muted-foreground/40">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                            Sem vídeo
                        </span>
                    )}

                    {muscleGroups.length > 0 && (
                        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground/60 border-l border-k-border-subtle pl-3 truncate">
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
