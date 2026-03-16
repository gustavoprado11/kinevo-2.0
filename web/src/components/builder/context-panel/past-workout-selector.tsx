import { ChevronDown, Loader2 } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import type { PastWorkoutSummary } from '@/app/students/[id]/actions/get-past-workouts'

interface PastWorkoutSelectorProps {
    workouts: PastWorkoutSummary[]
    selectedId: string | null
    onSelect: (id: string) => void
    isLoading: boolean
}

export function PastWorkoutSelector({ workouts, selectedId, onSelect, isLoading }: PastWorkoutSelectorProps) {
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
            <div className="flex items-center justify-center gap-2 px-4 py-3">
                <Loader2 size={14} className="animate-spin text-[#AEAEB2] dark:text-k-text-quaternary" />
                <span className="text-xs text-[#6E6E73] dark:text-k-text-tertiary">Carregando treinos...</span>
            </div>
        )
    }

    if (workouts.length === 0) {
        return (
            <div className="px-4 py-3">
                <p className="text-xs text-[#AEAEB2] dark:text-k-text-quaternary text-center">
                    Nenhum treino anterior encontrado
                </p>
            </div>
        )
    }

    const selected = workouts.find(w => w.workoutId === selectedId)

    // Group by program
    const grouped = new Map<string, { programName: string; status: string; startedAt: string | null; workouts: PastWorkoutSummary[] }>()
    for (const w of workouts) {
        if (!grouped.has(w.programId)) {
            grouped.set(w.programId, { programName: w.programName, status: w.programStatus, startedAt: w.startedAt, workouts: [] })
        }
        grouped.get(w.programId)!.workouts.push(w)
    }

    return (
        <div ref={ref} className="relative px-3 py-2">
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-[#E8E8ED] dark:border-k-border-subtle bg-white dark:bg-surface-card text-left hover:border-[#007AFF]/30 dark:hover:border-violet-500/30 transition-all"
            >
                <div className="min-w-0">
                    {selected ? (
                        <>
                            <span className="block text-xs font-semibold text-[#1D1D1F] dark:text-k-text-primary truncate">{selected.workoutName}</span>
                            <span className="block text-[10px] text-[#86868B] dark:text-k-text-quaternary truncate">{selected.programName}</span>
                        </>
                    ) : (
                        <span className="text-xs text-[#AEAEB2] dark:text-k-text-quaternary">Selecionar treino...</span>
                    )}
                </div>
                <ChevronDown size={14} className={`text-[#AEAEB2] dark:text-k-text-quaternary shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <div className="absolute left-3 right-3 top-full mt-1 z-dropdown rounded-xl border border-[#E8E8ED] dark:border-k-border-primary bg-white dark:bg-surface-card shadow-lg dark:shadow-2xl overflow-hidden max-h-[300px] overflow-y-auto">
                    {[...grouped.entries()].map(([programId, group]) => (
                        <div key={programId}>
                            <div className="px-3 py-2 bg-[#F5F5F7] dark:bg-surface-elevated border-b border-[#E8E8ED] dark:border-k-border-subtle">
                                <span className="text-[10px] font-bold text-[#86868B] dark:text-k-text-quaternary uppercase tracking-wider">
                                    {group.programName}
                                </span>
                                {group.startedAt && (
                                    <span className="text-[10px] text-[#AEAEB2] dark:text-k-text-quaternary ml-2">
                                        {new Date(group.startedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                                    </span>
                                )}
                                {group.status === 'active' && (
                                    <span className="ml-2 inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                )}
                            </div>
                            {group.workouts.map(w => (
                                <button
                                    key={w.workoutId}
                                    onClick={() => { onSelect(w.workoutId); setOpen(false) }}
                                    className={`w-full text-left px-3 py-2.5 text-xs transition-colors ${
                                        w.workoutId === selectedId
                                            ? 'bg-[#007AFF]/5 dark:bg-violet-500/10 text-[#007AFF] dark:text-violet-400 font-semibold'
                                            : 'text-[#1D1D1F] dark:text-k-text-primary hover:bg-[#F5F5F7] dark:hover:bg-glass-bg'
                                    }`}
                                >
                                    {w.workoutName}
                                </button>
                            ))}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
