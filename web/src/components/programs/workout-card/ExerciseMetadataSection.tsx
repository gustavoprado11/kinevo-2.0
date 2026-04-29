'use client'

import { memo, useState, useRef } from 'react'
import { MessageSquare, Pencil } from 'lucide-react'

import type { WorkoutItem } from '../program-builder-client'
import { EXERCISE_FUNCTION_LABELS, EXERCISE_FUNCTION_OPTIONS, type ExerciseFunction } from '@kinevo/shared/types/prescription'

interface ExerciseMetadataSectionProps {
    item: WorkoutItem
    readonly?: boolean
    onUpdate: (updates: Partial<WorkoutItem>) => void
}

export const ExerciseMetadataSection = memo(function ExerciseMetadataSection({
    item,
    readonly,
    onUpdate,
}: ExerciseMetadataSectionProps) {
    return (
        <div className="space-y-2">
            <ExerciseFunctionSelect
                value={item.exercise_function}
                onChange={(v) => onUpdate({ exercise_function: v })}
                readonly={readonly}
            />
            <TechnicalNote
                value={item.notes || ''}
                onChange={(v) => onUpdate({ notes: v })}
                readonly={readonly}
            />
        </div>
    )
})

export function ExerciseFunctionSelect({
    value,
    onChange,
    readonly,
}: {
    value?: string | null
    onChange: (v: ExerciseFunction | null) => void
    readonly?: boolean
}) {
    const label = value && EXERCISE_FUNCTION_OPTIONS.includes(value as ExerciseFunction)
        ? EXERCISE_FUNCTION_LABELS[value as ExerciseFunction]
        : null

    if (readonly) {
        if (!label) return null
        return (
            <div className="flex items-center gap-2 mt-2">
                <span className="text-[10px] font-bold text-[#8E8E93] dark:text-k-text-tertiary">Função</span>
                <span className="text-[#1D1D1F] dark:text-k-text-primary text-xs font-medium">{label}</span>
            </div>
        )
    }

    return (
        <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-[#8E8E93] dark:text-k-text-tertiary shrink-0">Função</span>
            <select
                value={value || ''}
                onChange={(e) => onChange((e.target.value || null) as ExerciseFunction | null)}
                className="h-8 rounded-lg bg-[#F9F9FB] dark:bg-surface-inset border border-[#E8E8ED] dark:border-k-border-subtle px-2.5 text-[#1D1D1F] dark:text-k-text-primary text-xs font-medium focus:outline-none focus:border-[#007AFF]/50 dark:focus:border-violet-500/50 cursor-pointer"
            >
                <option value="">—</option>
                {EXERCISE_FUNCTION_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>{EXERCISE_FUNCTION_LABELS[opt]}</option>
                ))}
            </select>
        </div>
    )
}

export function TechnicalNote({ value, onChange, readonly }: { value: string; onChange: (v: string) => void; readonly?: boolean }) {
    const [editing, setEditing] = useState(false)
    const [local, setLocal] = useState(value)
    const inputRef = useRef<HTMLInputElement>(null)

    if (readonly) {
        if (!value) return null
        return (
            <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-[#007AFF]/5 dark:bg-violet-500/5 border border-[#007AFF]/10 dark:border-violet-500/10 border-l-2 border-l-[#007AFF]/40 dark:border-l-violet-500/40">
                <MessageSquare size={14} className="text-[#007AFF]/70 dark:text-violet-400/70 shrink-0" />
                <span className="text-k-text-secondary text-xs flex-1">{value}</span>
            </div>
        )
    }

    const commit = () => {
        setEditing(false)
        onChange(local)
    }

    const startEditing = () => {
        setLocal(value)
        setEditing(true)
        setTimeout(() => {
            inputRef.current?.focus()
            inputRef.current?.select()
        }, 30)
    }

    if (editing) {
        return (
            <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-[#F9F9FB] dark:bg-surface-inset border border-[#007AFF]/30 dark:border-violet-500/30">
                <MessageSquare size={14} className="text-[#007AFF] dark:text-violet-400 shrink-0" />
                <input
                    ref={inputRef}
                    value={local}
                    onChange={e => setLocal(e.target.value)}
                    onBlur={commit}
                    onKeyDown={e => {
                        if (e.key === 'Enter') commit()
                        if (e.key === 'Escape') { setLocal(value); setEditing(false) }
                    }}
                    placeholder="Ex: Manter lombar neutra, descer até 90°..."
                    className="bg-transparent text-[#1D1D1F] dark:text-k-text-secondary text-xs outline-none flex-1 placeholder:text-[#AEAEB2] dark:placeholder:text-k-text-quaternary"
                />
            </div>
        )
    }

    if (value) {
        return (
            <div
                onClick={startEditing}
                className="flex items-center gap-2 py-2 px-3 rounded-lg bg-[#007AFF]/5 dark:bg-violet-500/5 border border-[#007AFF]/10 dark:border-violet-500/10 border-l-2 border-l-[#007AFF]/40 dark:border-l-violet-500/40 cursor-pointer hover:bg-[#007AFF]/10 dark:hover:bg-violet-500/10 transition-colors group/note"
            >
                <MessageSquare size={14} className="text-[#007AFF]/70 dark:text-violet-400/70 shrink-0" />
                <span className="text-k-text-secondary text-xs flex-1">{value}</span>
                <Pencil size={12} className="text-k-text-quaternary opacity-0 group-hover/note:opacity-100 transition-opacity shrink-0" />
            </div>
        )
    }

    return (
        <div
            onClick={startEditing}
            className="flex items-center gap-2 py-2 px-3 rounded-lg border border-dashed border-[#E8E8ED] dark:border-k-border-subtle cursor-pointer text-[#AEAEB2] dark:text-k-text-quaternary hover:text-[#6E6E73] dark:hover:text-k-text-tertiary hover:bg-[#F9F9FB] dark:hover:bg-surface-inset transition-colors group/note"
        >
            <MessageSquare size={14} className="shrink-0 group-hover/note:text-[#007AFF]/50 dark:group-hover/note:text-violet-400/50" />
            <span className="text-xs">Adicionar nota técnica...</span>
        </div>
    )
}
