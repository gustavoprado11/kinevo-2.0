'use client'

import { useState, useRef, useEffect } from 'react'
import { ExerciseWithDetails } from './exercise-item'

interface ExerciseActionsMenuProps {
    exercise: ExerciseWithDetails
    currentTrainerId: string
    onEdit: (exercise: ExerciseWithDetails) => void
    onDelete: (exercise: ExerciseWithDetails) => void
}

export function ExerciseActionsMenu({ exercise, currentTrainerId, onEdit, onDelete }: ExerciseActionsMenuProps) {
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
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-40 bg-muted rounded-xl shadow-xl border border-border overflow-hidden z-10 py-1">
                    <button
                        onClick={() => {
                            setIsOpen(false)
                            onEdit(exercise)
                        }}
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-popover-foreground transition-colors hover:bg-muted"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Editar
                    </button>

                    {isOwner && (
                        <button
                            onClick={() => {
                                setIsOpen(false)
                                onDelete(exercise)
                            }}
                            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-popover-foreground transition-colors hover:bg-muted"
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
