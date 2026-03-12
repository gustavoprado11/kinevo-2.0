'use client'

import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { Search, X, Plus, Dumbbell } from 'lucide-react'
import type { Exercise } from '@/types/exercise'

interface InlineExerciseSearchProps {
    exercises: Exercise[]
    onAdd: (exercise: Exercise) => void
    /** Compact mode for non-empty workout footer */
    compact?: boolean
}

const MAX_RESULTS = 5
const MIN_QUERY_LENGTH = 2

export function InlineExerciseSearch({ exercises, onAdd, compact = false }: InlineExerciseSearchProps) {
    const [query, setQuery] = useState('')
    const [isFocused, setIsFocused] = useState(false)
    const [highlightIndex, setHighlightIndex] = useState(-1)
    const inputRef = useRef<HTMLInputElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    const results = useMemo(() => {
        if (query.length < MIN_QUERY_LENGTH) return []
        const q = query.toLowerCase()
        return exercises
            .filter(ex => {
                const nameMatch = ex.name.toLowerCase().includes(q)
                const muscleMatch = ex.muscle_groups?.some(mg =>
                    mg.name?.toLowerCase().includes(q)
                )
                return nameMatch || muscleMatch
            })
            .slice(0, MAX_RESULTS)
    }, [exercises, query])

    const showDropdown = isFocused && query.length >= MIN_QUERY_LENGTH

    // Reset highlight when results change
    useEffect(() => {
        setHighlightIndex(-1)
    }, [results])

    // Click outside to close
    useEffect(() => {
        if (!showDropdown) return
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsFocused(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [showDropdown])

    const handleAdd = useCallback((exercise: Exercise) => {
        onAdd(exercise)
        setQuery('')
        setHighlightIndex(-1)
        // Keep focus for rapid sequential adds
        inputRef.current?.focus()
    }, [onAdd])

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!showDropdown || results.length === 0) {
            if (e.key === 'Escape') {
                setQuery('')
                inputRef.current?.blur()
            }
            return
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault()
                setHighlightIndex(prev => (prev + 1) % results.length)
                break
            case 'ArrowUp':
                e.preventDefault()
                setHighlightIndex(prev => (prev <= 0 ? results.length - 1 : prev - 1))
                break
            case 'Enter':
                e.preventDefault()
                if (highlightIndex >= 0 && highlightIndex < results.length) {
                    handleAdd(results[highlightIndex])
                }
                break
            case 'Escape':
                e.preventDefault()
                setQuery('')
                setIsFocused(false)
                break
        }
    }

    const primaryMuscle = (ex: Exercise) =>
        ex.muscle_groups?.[0]?.name || null

    const dropdownId = 'exercise-search-listbox'

    return (
        <div ref={containerRef} className={`relative ${compact ? '' : 'max-w-md mx-auto mb-5'}`}>
            {/* Search Input */}
            <div
                className={`flex items-center gap-2 px-3.5 py-2.5 transition-all duration-200 ${
                    showDropdown
                        ? 'rounded-t-xl rounded-b-none border border-[#007AFF]/30 dark:border-violet-500/40 bg-white dark:bg-surface-card ring-2 ring-[#007AFF]/10 dark:ring-violet-500/10'
                        : isFocused
                            ? 'rounded-xl border border-[#007AFF]/30 dark:border-violet-500/40 bg-white dark:bg-surface-card ring-2 ring-[#007AFF]/10 dark:ring-violet-500/10'
                            : 'rounded-xl border border-transparent bg-[#F5F5F7]/60 dark:bg-glass-bg hover:bg-[#F5F5F7] dark:hover:bg-glass-bg-hover'
                }`}
            >
                <Search className={`w-4 h-4 flex-shrink-0 transition-colors ${
                    isFocused ? 'text-[#007AFF] dark:text-violet-400' : 'text-[#AEAEB2] dark:text-k-text-quaternary'
                }`} />
                <input
                    ref={inputRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                    onKeyDown={handleKeyDown}
                    placeholder={compact ? 'Adicionar mais exercícios...' : 'Pesquisar exercício para adicionar...'}
                    className="flex-1 bg-transparent border-none outline-none text-sm text-[#1D1D1F] dark:text-k-text-primary placeholder:text-[#AEAEB2] dark:placeholder:text-k-text-quaternary"
                    role="combobox"
                    aria-expanded={showDropdown}
                    aria-controls={showDropdown ? dropdownId : undefined}
                    aria-activedescendant={highlightIndex >= 0 ? `exercise-option-${highlightIndex}` : undefined}
                    autoComplete="off"
                />
                {query && (
                    <button
                        onClick={() => { setQuery(''); inputRef.current?.focus() }}
                        className="p-0.5 rounded text-[#AEAEB2] dark:text-k-text-quaternary hover:text-[#6E6E73] dark:hover:text-k-text-tertiary transition-colors"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>

            {/* Dropdown Results */}
            {showDropdown && (
                <div
                    id={dropdownId}
                    role="listbox"
                    className="absolute top-full left-0 right-0 z-dropdown bg-white dark:bg-surface-card border border-[#007AFF]/15 dark:border-violet-500/20 border-t-[#E8E8ED] dark:border-t-k-border-subtle rounded-b-xl shadow-lg dark:shadow-xl overflow-hidden"
                >
                    {results.length > 0 ? (
                        <div className="p-1">
                            {results.map((exercise, idx) => (
                                <button
                                    key={exercise.id}
                                    id={`exercise-option-${idx}`}
                                    role="option"
                                    aria-selected={highlightIndex === idx}
                                    onClick={() => handleAdd(exercise)}
                                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors ${
                                        highlightIndex === idx
                                            ? 'bg-[#007AFF]/[0.06] dark:bg-violet-500/10'
                                            : 'hover:bg-[#F5F5F7] dark:hover:bg-glass-bg'
                                    }`}
                                >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <Dumbbell className="w-4 h-4 text-[#AEAEB2] dark:text-k-text-quaternary flex-shrink-0" />
                                        <div className="text-left min-w-0">
                                            <div className="text-sm font-medium text-[#1D1D1F] dark:text-k-text-primary truncate">{exercise.name}</div>
                                            {primaryMuscle(exercise) && (
                                                <div className="text-[11px] text-[#86868B] dark:text-k-text-quaternary">{primaryMuscle(exercise)}</div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-[#007AFF] dark:text-violet-400 bg-[#007AFF]/[0.06] dark:bg-violet-500/10 rounded-md flex-shrink-0 ml-3">
                                        <Plus className="w-3 h-3" />
                                        Adicionar
                                    </div>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="px-4 py-4 text-center text-sm text-[#86868B] dark:text-k-text-tertiary">
                            Nenhum exercício encontrado
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
