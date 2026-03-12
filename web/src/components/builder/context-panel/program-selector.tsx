'use client'

import { ChevronDown, Loader2 } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import type { CompareProgramSummary } from '@/actions/programs/get-program-for-compare'

interface ProgramSelectorProps {
    programs: CompareProgramSummary[]
    selectedId: string | null
    onSelect: (programId: string) => void
    isLoading: boolean
}

export function ProgramSelector({ programs, selectedId, onSelect, isLoading }: ProgramSelectorProps) {
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
        }
        document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [])

    if (isLoading) {
        return (
            <div className="flex items-center justify-center gap-2 px-2 py-1">
                <Loader2 size={14} className="animate-spin text-[#AEAEB2] dark:text-k-text-quaternary" />
                <span className="text-xs text-[#6E6E73] dark:text-k-text-tertiary">Carregando...</span>
            </div>
        )
    }

    if (programs.length === 0) {
        return (
            <div className="px-2 py-1">
                <p className="text-[10px] text-[#AEAEB2] dark:text-k-text-quaternary">
                    Nenhum programa anterior
                </p>
            </div>
        )
    }

    const selected = programs.find(p => p.programId === selectedId)

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen(!open)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-[#E8E8ED] dark:border-k-border-subtle bg-white dark:bg-surface-card text-left hover:border-[#007AFF]/30 dark:hover:border-violet-500/30 transition-all"
            >
                <span className="text-[11px] font-medium text-[#1D1D1F] dark:text-k-text-primary truncate max-w-[180px]">
                    {selected ? selected.programName : 'Selecionar programa...'}
                </span>
                <ChevronDown size={12} className={`text-[#AEAEB2] dark:text-k-text-quaternary shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <div className="absolute right-0 top-full mt-1 z-dropdown rounded-xl border border-[#E8E8ED] dark:border-k-border-primary bg-white dark:bg-surface-card shadow-lg dark:shadow-2xl overflow-hidden max-h-[300px] overflow-y-auto min-w-[280px]">
                    {programs.map(p => (
                        <button
                            key={p.programId}
                            onClick={() => { onSelect(p.programId); setOpen(false) }}
                            className={`w-full text-left px-3 py-2.5 flex items-center justify-between transition-colors ${
                                p.programId === selectedId
                                    ? 'bg-[#007AFF]/5 dark:bg-violet-500/10'
                                    : 'hover:bg-[#F5F5F7] dark:hover:bg-glass-bg'
                            }`}
                        >
                            <div className="min-w-0 flex-1">
                                <span className={`block text-xs truncate ${
                                    p.programId === selectedId
                                        ? 'text-[#007AFF] dark:text-violet-400 font-semibold'
                                        : 'text-[#1D1D1F] dark:text-k-text-primary font-medium'
                                }`}>
                                    {p.programName}
                                </span>
                                <span className="block text-[10px] text-[#86868B] dark:text-k-text-quaternary truncate">
                                    {p.workoutCount} treino{p.workoutCount !== 1 ? 's' : ''}
                                    {p.startedAt && ` · ${new Date(p.startedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`}
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                {p.status === 'active' && (
                                    <span className="flex items-center gap-1 text-[10px] text-emerald-500 dark:text-emerald-400 font-medium">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                        Ativo
                                    </span>
                                )}
                                {p.status === 'completed' && (
                                    <span className="text-[10px] text-[#86868B] dark:text-k-text-quaternary font-medium">
                                        Concluído
                                    </span>
                                )}
                                {p.status === 'paused' && (
                                    <span className="text-[10px] text-amber-500 dark:text-amber-400 font-medium">
                                        Pausado
                                    </span>
                                )}
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
