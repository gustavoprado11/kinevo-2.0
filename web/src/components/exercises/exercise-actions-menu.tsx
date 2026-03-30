'use client'

import { useState, useRef, useEffect } from 'react'
import { ExerciseWithDetails } from './exercise-item'

interface ExerciseActionsMenuProps {
    exercise: ExerciseWithDetails
    currentTrainerId: string
    onEdit: (exercise: ExerciseWithDetails) => void
    onDelete: (exercise: ExerciseWithDetails) => void
    onCustomVideo?: (exercise: ExerciseWithDetails) => void
}

export function ExerciseActionsMenu({ exercise, currentTrainerId, onEdit, onDelete, onCustomVideo }: ExerciseActionsMenuProps) {
    const [isOpen, setIsOpen] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)

    const isOwner = exercise.owner_id === currentTrainerId
    // System exercises have owner_id === null

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // For system exercises, we allow "Edit" (which triggers override) but not "Delete"
    // For owner exercises, we allow both

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="rounded-full p-1.5 text-[#AEAEB2] dark:text-muted-foreground transition-colors hover:bg-[#F5F5F7] dark:hover:bg-muted/50 hover:text-[#6E6E73] dark:hover:text-foreground"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-muted rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-xl border border-[#D2D2D7] dark:border-border overflow-hidden z-dropdown py-1">
                    <button
                        onClick={() => {
                            setIsOpen(false)
                            onEdit(exercise)
                        }}
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-[#1D1D1F] dark:text-popover-foreground transition-colors hover:bg-[#F5F5F7] dark:hover:bg-muted"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Editar
                    </button>

                    {onCustomVideo && (
                        <button
                            onClick={() => {
                                setIsOpen(false)
                                onCustomVideo(exercise)
                            }}
                            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-[#1D1D1F] dark:text-popover-foreground transition-colors hover:bg-[#F5F5F7] dark:hover:bg-muted"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            Meu vídeo
                        </button>
                    )}

                    {isOwner && (
                        <button
                            onClick={() => {
                                setIsOpen(false)
                                onDelete(exercise)
                            }}
                            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-[#FF3B30] dark:text-popover-foreground transition-colors hover:bg-[#FF3B30]/5 dark:hover:bg-muted"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                            </svg>
                            Arquivar
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}
