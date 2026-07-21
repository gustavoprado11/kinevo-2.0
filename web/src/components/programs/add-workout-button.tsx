'use client'

import { Dumbbell, Zap } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { WorkoutType } from '@kinevo/shared/types/workout-items'

interface AddWorkoutButtonProps {
    onAdd: (type: WorkoutType) => void
}

/** Botão "+" da faixa de tabs dos builders: abre menu com o tipo da sessão
 *  (força ou aeróbio) em vez de criar direto. Mesmo padrão de popover do
 *  WorkoutCardKebab (click-outside + Esc). */
export function AddWorkoutButton({ onAdd }: AddWorkoutButtonProps) {
    const [open, setOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!open) return
        function onDocClick(e: MouseEvent) {
            if (!containerRef.current) return
            if (!containerRef.current.contains(e.target as Node)) setOpen(false)
        }
        function onEsc(e: KeyboardEvent) {
            if (e.key === 'Escape') setOpen(false)
        }
        document.addEventListener('mousedown', onDocClick)
        document.addEventListener('keydown', onEsc)
        return () => {
            document.removeEventListener('mousedown', onDocClick)
            document.removeEventListener('keydown', onEsc)
        }
    }, [open])

    const pick = (type: WorkoutType) => {
        onAdd(type)
        setOpen(false)
    }

    return (
        <div ref={containerRef} className="relative shrink-0">
            <button
                type="button"
                onClick={() => setOpen(prev => !prev)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-[#AEAEB2] dark:text-k-text-quaternary hover:text-k-text-primary hover:bg-surface-inset transition-all ml-2"
                title="Adicionar Treino"
                aria-haspopup="menu"
                aria-expanded={open}
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                </svg>
            </button>
            {open && (
                <div
                    role="menu"
                    className="absolute left-0 top-9 z-dropdown w-48 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-apple-elevated overflow-hidden py-1"
                >
                    <button
                        type="button"
                        role="menuitem"
                        onClick={() => pick('strength')}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg)] transition-colors"
                    >
                        <Dumbbell className="size-3.5 shrink-0" />
                        <span>Treino de força</span>
                    </button>
                    <button
                        type="button"
                        role="menuitem"
                        onClick={() => pick('cardio')}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg)] transition-colors"
                    >
                        <Zap className="size-3.5 shrink-0 text-cyan-500" />
                        <span>Treino aeróbio</span>
                    </button>
                </div>
            )}
        </div>
    )
}
