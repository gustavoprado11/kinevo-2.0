'use client'

import { useMemo } from 'react'
import { Copy, Plus, Trash2 } from 'lucide-react'

import type { MethodKey, SetType, WorkoutSet } from '@kinevo/shared/types/prescription'
import { SET_TYPE_OPTIONS } from '@kinevo/shared/types/prescription'
import {
    applyPreset,
    inferMethodKeyFromScheme,
} from '@kinevo/shared/lib/prescription/set-scheme'
import { SYSTEM_PRESETS } from '@kinevo/shared/lib/prescription/set-scheme-presets'

import { SetSchemePresetChips } from './SetSchemePresetChips'

interface SetSchemeTableProps {
    value: WorkoutSet[]
    methodKey: MethodKey | null
    onChange: (next: WorkoutSet[], nextMethodKey: MethodKey) => void
    onExitAdvanced: () => void
    readonly?: boolean
}

const SET_TYPE_LABELS: Record<SetType, string> = {
    warmup: 'Aquecimento',
    normal: 'Normal',
    top: 'Top',
    backoff: 'Backoff',
    drop: 'Drop',
    failure: 'Falha',
    cluster: 'Cluster',
    amrap: 'AMRAP',
}

const newEmptySet = (setNumber: number): WorkoutSet => ({
    set_number: setNumber,
    set_type: 'normal',
    reps: '10',
    rest_seconds: 60,
    weight_target_kg: null,
    weight_target_pct1rm: null,
    rir: null,
    tempo: null,
    notes: null,
})

const renumber = (sets: WorkoutSet[]): WorkoutSet[] =>
    sets.map((s, i) => ({ ...s, set_number: i + 1 }))

const methodLabel = (key: MethodKey | null): string => {
    if (!key || key === 'standard') return 'Customizado'
    if (key === 'custom') return 'Customizado'
    return SYSTEM_PRESETS[key]?.name ?? 'Customizado'
}

export function SetSchemeTable({
    value,
    methodKey,
    onChange,
    onExitAdvanced,
    readonly,
}: SetSchemeTableProps) {
    const sets = value
    const inferredKey = useMemo(() => inferMethodKeyFromScheme(sets), [sets])
    const displayKey: MethodKey = methodKey ?? inferredKey

    const updateSet = (index: number, patch: Partial<WorkoutSet>) => {
        const next = sets.map((s, i) => (i === index ? { ...s, ...patch } : s))
        // Manual edit always demotes the chip to 'custom' — re-detection via
        // inferMethodKeyFromScheme on save still recovers exact preset matches.
        onChange(renumber(next), 'custom')
    }

    const addSet = () => {
        const last = sets[sets.length - 1]
        const newSet: WorkoutSet = last
            ? { ...last, set_number: sets.length + 1 }
            : newEmptySet(1)
        onChange([...sets, newSet], 'custom')
    }

    const duplicateSet = (index: number) => {
        const original = sets[index]
        const dup: WorkoutSet = { ...original }
        const next = [...sets.slice(0, index + 1), dup, ...sets.slice(index + 1)]
        onChange(renumber(next), 'custom')
    }

    const removeSet = (index: number) => {
        if (sets.length <= 1) return
        const next = sets.filter((_, i) => i !== index)
        onChange(renumber(next), 'custom')
    }

    const applyPresetKey = (key: Exclude<MethodKey, 'standard' | 'custom'>) => {
        const next = applyPreset(key)
        onChange(next, key)
    }

    const handleExit = () => {
        if (typeof window !== 'undefined' && sets.length > 0) {
            const ok = window.confirm(
                'Você perderá as configurações específicas de cada série. Continuar?',
            )
            if (!ok) return
        }
        onExitAdvanced()
    }

    return (
        <div className="mt-3 rounded-lg border border-[#E8E8ED] dark:border-k-border-subtle bg-[#F9F9FB] dark:bg-surface-card-elevated p-3 space-y-3">
            {/* Header: chip + voltar */}
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-k-text-tertiary">
                        Método
                    </span>
                    <span className="text-xs font-semibold text-k-text-primary bg-white dark:bg-surface-card border border-[#E8E8ED] dark:border-k-border-subtle px-2 py-0.5 rounded-full">
                        {methodLabel(displayKey)}
                    </span>
                </div>
                {!readonly && (
                    <button
                        type="button"
                        onClick={handleExit}
                        className="text-xs text-k-text-secondary hover:text-[#FF3B30] dark:hover:text-red-400 transition-colors"
                    >
                        Voltar para modo simples
                    </button>
                )}
            </div>

            {/* Preset chips */}
            {!readonly && (
                <SetSchemePresetChips activeKey={displayKey} onApply={applyPresetKey} />
            )}

            {/* Tabela */}
            <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                    <thead className="text-[10px] uppercase tracking-wider text-k-text-tertiary">
                        <tr>
                            <th className="py-2 pr-2 font-bold">#</th>
                            <th className="py-2 pr-2 font-bold">Tipo</th>
                            <th className="py-2 pr-2 font-bold">Reps</th>
                            <th className="py-2 pr-2 font-bold">Carga</th>
                            <th className="py-2 pr-2 font-bold">RIR</th>
                            <th className="py-2 pr-2 font-bold">Descanso</th>
                            <th className="py-2 pr-2 font-bold">Tempo</th>
                            {!readonly && <th className="py-2 pr-2 w-16" aria-label="Ações" />}
                        </tr>
                    </thead>
                    <tbody>
                        {sets.map((set, index) => (
                            <SetRow
                                key={`set-${index}`}
                                set={set}
                                index={index}
                                readonly={readonly}
                                onUpdate={(patch) => updateSet(index, patch)}
                                onDuplicate={() => duplicateSet(index)}
                                onRemove={() => removeSet(index)}
                                canRemove={sets.length > 1}
                            />
                        ))}
                    </tbody>
                </table>
            </div>

            {!readonly && (
                <button
                    type="button"
                    onClick={addSet}
                    className="flex items-center gap-1.5 text-xs font-medium text-[#007AFF] dark:text-violet-400 hover:underline"
                >
                    <Plus className="w-3.5 h-3.5" />
                    Adicionar série
                </button>
            )}
        </div>
    )
}

interface SetRowProps {
    set: WorkoutSet
    index: number
    readonly?: boolean
    onUpdate: (patch: Partial<WorkoutSet>) => void
    onDuplicate: () => void
    onRemove: () => void
    canRemove: boolean
}

function SetRow({
    set,
    index,
    readonly,
    onUpdate,
    onDuplicate,
    onRemove,
    canRemove,
}: SetRowProps) {
    const usePct = set.weight_target_pct1rm !== null

    const inputClass =
        'w-full bg-transparent text-k-text-primary text-xs px-1.5 py-1 border-b border-transparent focus:border-[#007AFF]/50 dark:focus:border-violet-500/50 focus:outline-none'

    return (
        <tr className="border-t border-[#E8E8ED]/60 dark:border-k-border-subtle/60">
            <td className="py-1.5 pr-2 font-semibold text-k-text-primary">{set.set_number}</td>

            <td className="py-1.5 pr-2">
                {readonly ? (
                    <span className="text-k-text-primary">{SET_TYPE_LABELS[set.set_type]}</span>
                ) : (
                    <select
                        aria-label={`Tipo da série ${index + 1}`}
                        value={set.set_type}
                        onChange={(e) => onUpdate({ set_type: e.target.value as typeof SET_TYPE_OPTIONS[number] })}
                        className={inputClass}
                    >
                        {SET_TYPE_OPTIONS.map((t) => (
                            <option key={t} value={t}>
                                {SET_TYPE_LABELS[t]}
                            </option>
                        ))}
                    </select>
                )}
            </td>

            <td className="py-1.5 pr-2">
                {readonly ? (
                    <span className="text-k-text-primary">{set.reps}</span>
                ) : (
                    <input
                        type="text"
                        aria-label={`Reps da série ${index + 1}`}
                        value={set.reps}
                        onChange={(e) => onUpdate({ reps: e.target.value })}
                        className={inputClass}
                    />
                )}
            </td>

            <td className="py-1.5 pr-2">
                {readonly ? (
                    <span className="text-k-text-primary">
                        {usePct
                            ? `${set.weight_target_pct1rm}% 1RM`
                            : set.weight_target_kg !== null
                                ? `${set.weight_target_kg}kg`
                                : '—'}
                    </span>
                ) : (
                    <div className="flex items-center gap-1">
                        <input
                            type="number"
                            min={0}
                            step={usePct ? 1 : 0.5}
                            aria-label={`Carga da série ${index + 1}`}
                            value={(usePct ? set.weight_target_pct1rm : set.weight_target_kg) ?? ''}
                            onChange={(e) => {
                                const raw = e.target.value
                                const num = raw === '' ? null : Number(raw)
                                onUpdate(
                                    usePct
                                        ? { weight_target_pct1rm: num, weight_target_kg: null }
                                        : { weight_target_kg: num, weight_target_pct1rm: null },
                                )
                            }}
                            className={`${inputClass} max-w-[70px]`}
                        />
                        <button
                            type="button"
                            onClick={() =>
                                onUpdate(
                                    usePct
                                        ? { weight_target_pct1rm: null, weight_target_kg: set.weight_target_pct1rm }
                                        : { weight_target_kg: null, weight_target_pct1rm: set.weight_target_kg },
                                )
                            }
                            className="text-[10px] font-bold text-k-text-tertiary hover:text-[#007AFF] dark:hover:text-violet-400 px-1.5 py-0.5 rounded border border-[#E8E8ED] dark:border-k-border-subtle"
                            title="Alternar entre kg e % de 1RM"
                        >
                            {usePct ? '%1RM' : 'kg'}
                        </button>
                    </div>
                )}
            </td>

            <td className="py-1.5 pr-2">
                {readonly ? (
                    <span className="text-k-text-primary">{set.rir ?? '—'}</span>
                ) : (
                    <input
                        type="number"
                        min={0}
                        step={1}
                        aria-label={`RIR da série ${index + 1}`}
                        value={set.rir ?? ''}
                        onChange={(e) =>
                            onUpdate({ rir: e.target.value === '' ? null : Number(e.target.value) })
                        }
                        className={`${inputClass} max-w-[50px]`}
                    />
                )}
            </td>

            <td className="py-1.5 pr-2">
                {readonly ? (
                    <span className="text-k-text-primary">{set.rest_seconds}s</span>
                ) : (
                    <div className="flex items-center gap-1">
                        <input
                            type="number"
                            min={0}
                            step={15}
                            aria-label={`Descanso da série ${index + 1}`}
                            value={set.rest_seconds}
                            onChange={(e) => onUpdate({ rest_seconds: Number(e.target.value) || 0 })}
                            className={`${inputClass} max-w-[60px]`}
                        />
                        <span className="text-[10px] text-k-text-tertiary">s</span>
                    </div>
                )}
            </td>

            <td className="py-1.5 pr-2">
                {readonly ? (
                    <span className="text-k-text-primary">{set.tempo ?? '—'}</span>
                ) : (
                    <input
                        type="text"
                        aria-label={`Tempo da série ${index + 1}`}
                        value={set.tempo ?? ''}
                        onChange={(e) => onUpdate({ tempo: e.target.value || null })}
                        placeholder="3-1-1-0"
                        className={`${inputClass} max-w-[80px]`}
                    />
                )}
            </td>

            {!readonly && (
                <td className="py-1.5 pr-2">
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={onDuplicate}
                            className="p-1 rounded text-k-text-quaternary hover:text-[#007AFF] dark:hover:text-violet-400 transition-colors"
                            title="Duplicar série"
                            aria-label={`Duplicar série ${index + 1}`}
                        >
                            <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                            type="button"
                            onClick={onRemove}
                            disabled={!canRemove}
                            className="p-1 rounded text-k-text-quaternary hover:text-[#FF3B30] dark:hover:text-red-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            title={canRemove ? 'Remover série' : 'Pelo menos 1 série é obrigatória'}
                            aria-label={`Remover série ${index + 1}`}
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </td>
            )}
        </tr>
    )
}
