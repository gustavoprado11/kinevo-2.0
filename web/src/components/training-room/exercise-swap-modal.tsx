'use client'

import { useState, useEffect, useCallback } from 'react'
import { ArrowRightLeft, Search, X, Loader2, RefreshCw } from 'lucide-react'
import { getSubstituteExercises, searchExercisesForSwap } from '@/actions/training-room/get-substitute-exercises'
import type { SubstituteOption } from '@/actions/training-room/get-substitute-exercises'

interface ExerciseSwapModalProps {
    isOpen: boolean
    onClose: () => void
    onSelect: (option: SubstituteOption) => void
    exerciseName: string
    exerciseId: string
    substituteExerciseIds: string[]
}

export function ExerciseSwapModal({
    isOpen,
    onClose,
    onSelect,
    exerciseName,
    exerciseId,
    substituteExerciseIds,
}: ExerciseSwapModalProps) {
    const [options, setOptions] = useState<SubstituteOption[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState<SubstituteOption[]>([])
    const [isSearching, setIsSearching] = useState(false)

    // Fetch suggestions when modal opens
    useEffect(() => {
        if (!isOpen) return
        setIsLoading(true)
        setSearchQuery('')
        setSearchResults([])
        getSubstituteExercises(substituteExerciseIds, exerciseId).then((res) => {
            setOptions(res.data)
            setIsLoading(false)
        })
    }, [isOpen, exerciseId, substituteExerciseIds])

    // Debounced search
    useEffect(() => {
        if (searchQuery.trim().length < 2) {
            setSearchResults([])
            return
        }
        const timer = setTimeout(async () => {
            setIsSearching(true)
            const excludeIds = [exerciseId, ...substituteExerciseIds]
            const res = await searchExercisesForSwap(searchQuery, excludeIds)
            setSearchResults(res.data)
            setIsSearching(false)
        }, 300)
        return () => clearTimeout(timer)
    }, [searchQuery, exerciseId, substituteExerciseIds])

    const handleSelect = useCallback(
        (option: SubstituteOption) => {
            onSelect(option)
            onClose()
        },
        [onSelect, onClose],
    )

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-modal flex items-end sm:items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />

            {/* Modal */}
            <div className="relative w-full max-w-lg max-h-[80vh] bg-white dark:bg-surface-card rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-k-border-subtle shadow-xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-6 pb-4">
                    <div className="flex items-center gap-2">
                        <ArrowRightLeft size={18} className="text-violet-600 dark:text-violet-400" />
                        <h3 className="text-lg font-bold text-slate-900 dark:text-foreground">
                            Substituir Exercício
                        </h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 dark:bg-glass-bg hover:bg-slate-200 dark:hover:bg-glass-bg-hover transition-colors"
                    >
                        <X size={16} className="text-slate-500" />
                    </button>
                </div>

                <p className="px-6 text-sm text-slate-500 dark:text-muted-foreground mb-4">
                    Atual: {exerciseName}
                </p>

                {/* Search */}
                <div className="px-6 mb-4">
                    <div className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-k-border-subtle bg-slate-50 dark:bg-transparent px-3">
                        <Search size={16} className="text-slate-400 shrink-0" />
                        <input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Buscar exercício para troca..."
                            className="flex-1 bg-transparent py-3 text-sm text-slate-900 dark:text-foreground placeholder:text-slate-400 focus:outline-none"
                        />
                        {searchQuery.length > 0 && (
                            <button onClick={() => setSearchQuery('')} className="p-1">
                                <X size={14} className="text-slate-400" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-6 pb-6">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-10">
                            <Loader2 size={24} className="text-violet-500 animate-spin" />
                            <p className="text-slate-400 mt-3 text-sm">Carregando substituições...</p>
                        </div>
                    ) : (
                        <>
                            {/* Quick suggestions */}
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                                Sugestões rápidas
                            </p>
                            {options.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-8">
                                    <RefreshCw size={20} className="text-slate-400" />
                                    <p className="text-slate-400 mt-3 text-sm text-center">
                                        Nenhuma sugestão disponível para este exercício.
                                    </p>
                                </div>
                            ) : (
                                <div className="mb-5">
                                    {options.map((option) => (
                                        <button
                                            key={option.id}
                                            onClick={() => handleSelect(option)}
                                            className="flex w-full items-start justify-between py-3.5 border-b border-slate-100 dark:border-k-border-subtle text-left hover:bg-slate-50 dark:hover:bg-glass-bg -mx-2 px-2 rounded-lg transition-colors"
                                        >
                                            <div className="flex-1 mr-3">
                                                <p className="text-sm font-semibold text-slate-900 dark:text-foreground">
                                                    {option.name}
                                                </p>
                                                <p className="text-xs text-slate-500 dark:text-muted-foreground mt-0.5">
                                                    {option.muscle_groups.join(', ') || 'Grupo muscular não informado'}
                                                </p>
                                            </div>
                                            <span
                                                className={`shrink-0 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase ${
                                                    option.source === 'manual'
                                                        ? 'bg-violet-50 dark:bg-violet-500/10 border-violet-100 dark:border-violet-500/20 text-violet-600 dark:text-violet-400'
                                                        : 'bg-slate-50 dark:bg-glass-bg border-slate-200 dark:border-k-border-subtle text-slate-500 dark:text-muted-foreground'
                                                }`}
                                            >
                                                {option.source === 'manual' ? 'Treinador' : 'Automática'}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Search results */}
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                                Busca manual
                            </p>
                            {isSearching ? (
                                <div className="flex flex-col items-center justify-center py-6">
                                    <Loader2 size={18} className="text-violet-500 animate-spin" />
                                    <p className="text-slate-500 mt-2 text-sm">Buscando...</p>
                                </div>
                            ) : searchQuery.trim().length < 2 ? (
                                <p className="text-slate-400 text-sm italic">
                                    Digite ao menos 2 letras para buscar exercícios similares.
                                </p>
                            ) : searchResults.length === 0 ? (
                                <p className="text-slate-400 text-sm italic">
                                    Nenhum exercício encontrado para essa busca.
                                </p>
                            ) : (
                                <div>
                                    {searchResults.map((option) => (
                                        <button
                                            key={`search-${option.id}`}
                                            onClick={() => handleSelect(option)}
                                            className="flex w-full items-start justify-between py-3.5 border-b border-slate-100 dark:border-k-border-subtle text-left hover:bg-slate-50 dark:hover:bg-glass-bg -mx-2 px-2 rounded-lg transition-colors"
                                        >
                                            <div className="flex-1 mr-3">
                                                <p className="text-sm font-semibold text-slate-900 dark:text-foreground">
                                                    {option.name}
                                                </p>
                                                <p className="text-xs text-slate-500 dark:text-muted-foreground mt-0.5">
                                                    {option.muscle_groups.join(', ') || 'Grupo muscular não informado'}
                                                </p>
                                            </div>
                                            <span className="shrink-0 px-2 py-0.5 rounded-full border bg-slate-50 dark:bg-glass-bg border-slate-200 dark:border-k-border-subtle text-[10px] font-bold uppercase text-slate-500 dark:text-muted-foreground">
                                                Busca
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
