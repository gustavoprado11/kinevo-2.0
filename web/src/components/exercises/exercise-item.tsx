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
            <div className="group rounded-xl border border-border bg-card p-4 shadow-sm transition-all duration-200 hover:border-violet-300/50 hover:shadow-md">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <h3 className="truncate text-base font-semibold text-foreground group-hover:text-violet-500">
                                {exercise.name}
                            </h3>
                            {/* Badges */}
                            {isSystem && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                    Sistema
                                </span>
                            )}
                            {isOwner && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-violet-500/10 text-violet-400 border border-violet-500/20">
                                    Meu exercício
                                </span>
                            )}
                        </div>

                        <div className="flex flex-wrap gap-2 mt-2">
                            {/* Video Indicator */}
                            {exercise.video_url && (
                                <button
                                    onClick={handleVideoClick}
                                    className="flex items-center gap-1 rounded border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-xs font-medium text-violet-400 transition-colors hover:bg-violet-500/20"
                                >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Vídeo
                                </button>
                            )}

                            {/* Muscle Groups */}
                            {muscleGroups.map((group) => (
                                <span
                                    key={group.id}
                                    className="rounded border border-border bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground"
                                >
                                    {group.name}
                                </span>
                            ))}

                            {/* Equipment */}
                            {exercise.equipment && (
                                <span className="flex items-center gap-1 rounded border border-border bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                                    <svg className="w-3 h-3 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                    </svg>
                                    {exercise.equipment}
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
