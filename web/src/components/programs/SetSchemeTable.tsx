'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, Copy, Minus, Plus, Repeat, Trash2, Undo2 } from 'lucide-react'

import type { MethodKey, SetType, WorkoutSet } from '@kinevo/shared/types/prescription'
import { SET_TYPE_OPTIONS } from '@kinevo/shared/types/prescription'
import {
    applyPreset,
} from '@kinevo/shared/lib/prescription/set-scheme'
import {
    SYSTEM_PRESETS,
    isCompoundMethod,
} from '@kinevo/shared/lib/prescription/set-scheme-presets'

import { SetSchemePresetChips } from './SetSchemePresetChips'

interface SetSchemeTableProps {
    value: WorkoutSet[]
    methodKey: MethodKey | null
    /** Rodadas (Fase 4.4). 1 para métodos lineares (default). 2..20 para
     *  compostos. O componente só mostra o stepper de rodadas quando o método
     *  ativo é compound. */
    rounds?: number | null
    onChange: (next: WorkoutSet[], nextMethodKey: MethodKey, nextRounds: number) => void
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

const ROUND_MIN = 1
const ROUND_MAX = 20

const ADVANCED_FIELDS_STORAGE_KEY = 'kinevo_setscheme_advanced_fields'

/** Tailwind classes for the colored left-border per set type (Fase 4.5c §4).
 *  Returns an empty string for `normal` so the row keeps its current look. */
const SET_TYPE_BORDER_CLASS: Record<SetType, string> = {
    normal: '',
    warmup: 'border-l-4 border-l-zinc-400 dark:border-l-zinc-500',
    top: 'border-l-4 border-l-orange-400 dark:border-l-orange-500',
    backoff: 'border-l-4 border-l-sky-400 dark:border-l-sky-500',
    drop: 'border-l-4 border-l-rose-500 dark:border-l-rose-400',
    failure: 'border-l-4 border-l-red-600 dark:border-l-red-500',
    cluster: 'border-l-4 border-l-violet-500 dark:border-l-violet-400',
    amrap: 'border-l-4 border-l-blue-500 dark:border-l-blue-400',
}

/** Read the persisted "show advanced fields" preference. Defaults to false on
 *  first render (SSR-safe) — useEffect rehydrates client-side. */
const readAdvancedFieldsPref = (): boolean => {
    if (typeof window === 'undefined') return false
    try {
        return window.localStorage.getItem(ADVANCED_FIELDS_STORAGE_KEY) === '1'
    } catch {
        return false
    }
}

const writeAdvancedFieldsPref = (value: boolean) => {
    if (typeof window === 'undefined') return
    try {
        window.localStorage.setItem(ADVANCED_FIELDS_STORAGE_KEY, value ? '1' : '0')
    } catch {
        // localStorage may be unavailable (private mode, quota exceeded, etc.)
        // — toggle still works in memory, preference just isn't persisted.
    }
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

const clampRounds = (n: number | null | undefined): number => {
    const v = Number.isFinite(n as number) ? Math.floor(n as number) : 1
    return Math.max(ROUND_MIN, Math.min(ROUND_MAX, v))
}

export function SetSchemeTable({
    value,
    methodKey,
    rounds,
    onChange,
    onExitAdvanced,
    readonly,
}: SetSchemeTableProps) {
    const sets = value
    // Fase 4.5d §7: method_key reflete intenção declarada do trainer, não é
    // mais inferido automaticamente da estrutura. `displayKey` cai pra
    // 'standard' quando o trainer ainda não escolheu um chip — nesse caso o
    // segmented control mostra todos como inativos exceto se o método for
    // 'custom' (chip Customizado destacado).
    const displayKey: MethodKey = methodKey ?? 'standard'
    const compound = isCompoundMethod(displayKey)
    const safeRounds = clampRounds(rounds ?? 1)

    // "+ Mais campos" toggle (Fase 4.5b) — persists per device. SSR-safe:
    // first render is always false; useEffect rehydrates on the client.
    const [showAdvancedFields, setShowAdvancedFields] = useState<boolean>(false)
    useEffect(() => {
        setShowAdvancedFields(readAdvancedFieldsPref())
    }, [])
    const toggleAdvancedFields = () => {
        setShowAdvancedFields((prev) => {
            const next = !prev
            writeAdvancedFieldsPref(next)
            return next
        })
    }
    // Effective rounds for the footer math: linear methods always run as 1
    // round even if `rounds` was set incidentally; compound methods honor the
    // value the trainer typed.
    const effectiveRounds = compound ? safeRounds : 1
    const phasesPerRound = sets.length
    const totalPhases = phasesPerRound * effectiveRounds

    // Fase 4.5d §7 (intenção sacra): edits, add/remove/duplicate de fase NÃO
    // alteram mais o `method_key`. A intenção do trainer (qual preset ele
    // declarou) só muda quando ele clica num chip ou em "Customizado".
    const updateSet = (index: number, patch: Partial<WorkoutSet>) => {
        const next = sets.map((s, i) => (i === index ? { ...s, ...patch } : s))
        onChange(renumber(next), displayKey, safeRounds)
    }

    const addSet = () => {
        const last = sets[sets.length - 1]
        const newSet: WorkoutSet = last
            ? { ...last, set_number: sets.length + 1 }
            : newEmptySet(1)
        onChange([...sets, newSet], displayKey, safeRounds)
    }

    const duplicateSet = (index: number) => {
        const original = sets[index]
        const dup: WorkoutSet = { ...original }
        const next = [...sets.slice(0, index + 1), dup, ...sets.slice(index + 1)]
        onChange(renumber(next), displayKey, safeRounds)
    }

    const removeSet = (index: number) => {
        if (sets.length <= 1) return
        const next = sets.filter((_, i) => i !== index)
        onChange(renumber(next), displayKey, safeRounds)
    }

    /** Fase 4.5d §1+§7 / Fase 4.5e §2: handler unificado para o segmented control.
     *  - 'custom' preserva scheme + rounds, só rotula como Customizado.
     *  - Preset real sobrescreve scheme + rounds direto (sem confirm — Fase
     *    4.5e: trainer é intencional ao clicar; o confirm era fricção
     *    sem ganho. Se errar, basta clicar em outro preset ou em
     *    Customizado pra manter o scheme atual). */
    const applyPresetKey = (key: Exclude<MethodKey, 'standard'>) => {
        if (key === 'custom') {
            onChange(sets, 'custom', safeRounds)
            return
        }
        const next = applyPreset(key)
        const presetRounds = SYSTEM_PRESETS[key]?.defaultRounds ?? 1
        onChange(next, key, clampRounds(presetRounds))
    }

    const adjustRounds = (delta: number) => {
        const nextRounds = clampRounds(safeRounds + delta)
        if (nextRounds === safeRounds) return
        // Changing rounds keeps the per-round structure and the chip — trainer
        // is just deciding how many times to repeat it.
        onChange(sets, displayKey, nextRounds)
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
            {/* "Voltar para modo simples" — botão secundário pequeno no canto
             *  superior esquerdo, separado da área de toggle (Fase 4.5c §3). */}
            {!readonly && (
                <div>
                    <button
                        type="button"
                        onClick={handleExit}
                        className="inline-flex items-center gap-1 text-xs text-k-text-secondary hover:text-k-text-primary dark:hover:text-k-text-primary px-2 py-1 -ml-2 rounded hover:bg-[#F5F5F7] dark:hover:bg-glass-bg-active transition-colors"
                    >
                        <Undo2 className="w-3 h-3" />
                        Voltar para modo simples
                    </button>
                </div>
            )}

            {/* Header: toggle "Mais campos" alinhado à direita.
             *  Fase 4.5d §1: o badge `MÉTODO [Customizado]` foi removido
             *  porque o segmented control abaixo já comunica o estado
             *  (chip ativo destacado). */}
            {!readonly && (
                <div className="flex items-center justify-end">
                    <button
                        type="button"
                        onClick={toggleAdvancedFields}
                        aria-pressed={showAdvancedFields}
                        className="flex items-center gap-1 text-[11px] font-medium text-k-text-secondary hover:text-[#007AFF] dark:hover:text-violet-400 transition-colors"
                    >
                        {showAdvancedFields ? (
                            <ChevronUp className="w-3 h-3" />
                        ) : (
                            <ChevronDown className="w-3 h-3" />
                        )}
                        {showAdvancedFields ? 'Menos campos' : 'Mais campos'}
                    </button>
                </div>
            )}

            {/* Pílula de síntese (Fase 4.5d §5) — header destacado da
             *  estrutura. Substitui o footer "Aluno verá..." removido nesta
             *  fase: a informação fica no topo onde o trainer percebe ANTES
             *  de mexer na tabela.
             *  - compound + rounds > 1 → "N rondas × M fases · NxM fases totais"
             *  - linear customizado (rounds=1 + length>1) → "M fases"
             *  - <= 1 fase → não exibe */}
            {phasesPerRound > 1 && (
                <div className="flex items-center gap-1.5 inline-flex self-start bg-violet-50 text-violet-700 border border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800 px-3 py-1 rounded-full text-xs font-semibold">
                    <Repeat className="w-3.5 h-3.5" />
                    {compound && safeRounds > 1 ? (
                        <span>
                            {safeRounds} rodadas × {phasesPerRound} fases · {totalPhases} fases totais
                        </span>
                    ) : (
                        <span>{phasesPerRound} fases</span>
                    )}
                </div>
            )}

            {/* Banner explicativo de rodadas (Fase 4.5b) — só compound + rounds > 1. */}
            {compound && safeRounds > 1 && phasesPerRound > 0 && (
                <div className="flex items-start gap-2 px-3 py-2 rounded-md bg-blue-50 border border-blue-200 text-blue-900 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-200">
                    <Repeat className="w-4 h-4 mt-0.5 shrink-0" />
                    <p className="text-[11px] leading-snug">
                        <span className="font-semibold">
                            Esta estrutura de {phasesPerRound} {phasesPerRound === 1 ? 'fase' : 'fases'} será repetida {safeRounds} vezes.
                        </span>{' '}
                        Cada rodada inteira conta como 1 série efetiva no volume semanal.
                    </p>
                </div>
            )}

            {/* Preset chips */}
            {!readonly && (
                <SetSchemePresetChips activeKey={displayKey} onApply={applyPresetKey} />
            )}

            {/* Rodadas (apenas métodos compostos) */}
            {compound && (
                <div className="flex items-center justify-between gap-3 px-2 py-2 rounded-md bg-white dark:bg-surface-card border border-[#E8E8ED] dark:border-k-border-subtle">
                    <div className="min-w-0">
                        <div className="text-xs font-bold text-k-text-primary">Rodadas</div>
                        <div className="text-[11px] text-k-text-tertiary">
                            Quantas vezes a estrutura abaixo se repete.
                        </div>
                    </div>
                    {!readonly && (
                        <div className="flex items-center gap-2 shrink-0">
                            <button
                                type="button"
                                onClick={() => adjustRounds(-1)}
                                disabled={safeRounds <= ROUND_MIN}
                                aria-label="Diminuir rodadas"
                                className="w-7 h-7 rounded-md flex items-center justify-center bg-[#F5F5F7] dark:bg-surface-card-elevated text-[#007AFF] dark:text-violet-400 hover:bg-[#E8E8ED] dark:hover:bg-glass-bg-active disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                                <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="min-w-[1.75rem] text-center text-base font-extrabold tabular-nums text-[#007AFF] dark:text-violet-400">
                                {safeRounds}
                            </span>
                            <button
                                type="button"
                                onClick={() => adjustRounds(1)}
                                disabled={safeRounds >= ROUND_MAX}
                                aria-label="Aumentar rodadas"
                                className="w-7 h-7 rounded-md flex items-center justify-center bg-[#F5F5F7] dark:bg-surface-card-elevated text-[#007AFF] dark:text-violet-400 hover:bg-[#E8E8ED] dark:hover:bg-glass-bg-active disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                                <Plus className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    )}
                    {readonly && (
                        <span className="text-base font-extrabold tabular-nums text-[#007AFF] dark:text-violet-400">
                            {safeRounds}
                        </span>
                    )}
                </div>
            )}

            {/* Section title — only for compound methods, before the table */}
            {compound && (
                <div className="text-[10px] font-bold uppercase tracking-wider text-k-text-tertiary px-1">
                    Estrutura de uma rodada
                </div>
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
                            {showAdvancedFields && <th className="py-2 pr-2 font-bold">RIR</th>}
                            <th className="py-2 pr-2 font-bold">Descanso</th>
                            {showAdvancedFields && <th className="py-2 pr-2 font-bold">Cadência</th>}
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
                                showAdvancedFields={showAdvancedFields}
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
                    {compound ? 'Adicionar fase' : 'Adicionar série'}
                </button>
            )}

            {/* Footer "Aluno verá: ..." removido na Fase 4.5d §5.
             *  A informação migrou pra pílula no topo da seção (acima dos
             *  chips do segmented control), pra ser percebida antes de mexer
             *  na tabela em vez de depois. */}
        </div>
    )
}

interface SetRowProps {
    set: WorkoutSet
    index: number
    readonly?: boolean
    /** When false, RIR and Tempo cells are hidden (Fase 4.5b). */
    showAdvancedFields: boolean
    onUpdate: (patch: Partial<WorkoutSet>) => void
    onDuplicate: () => void
    onRemove: () => void
    canRemove: boolean
}

function SetRow({
    set,
    index,
    readonly,
    showAdvancedFields,
    onUpdate,
    onDuplicate,
    onRemove,
    canRemove,
}: SetRowProps) {
    const usePct = set.weight_target_pct1rm !== null

    const inputClass =
        'w-full bg-transparent text-k-text-primary text-xs px-1.5 py-1 border-b border-transparent focus:border-[#007AFF]/50 dark:focus:border-violet-500/50 focus:outline-none'

    const typeBorderClass = SET_TYPE_BORDER_CLASS[set.set_type] ?? ''

    return (
        <tr className={`border-t border-[#E8E8ED]/60 dark:border-k-border-subtle/60 ${typeBorderClass}`}>
            <td className={`py-1.5 pr-2 font-semibold text-k-text-primary ${typeBorderClass ? 'pl-2' : ''}`}>{set.set_number}</td>

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
                    /* Fase 4.5d §2: input numérico + dropdown nativo de
                     *  unidade (kg / %1RM). Trocar a unidade zera o valor —
                     *  evita confusão visual ("100" virando "100% de 1RM"). */
                    <div className="flex items-center gap-1">
                        <input
                            type="number"
                            min={0}
                            step={usePct ? 1 : 0.5}
                            placeholder="0"
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
                            className={`${inputClass} max-w-[70px] placeholder:text-zinc-300 dark:placeholder:text-zinc-600`}
                        />
                        <select
                            aria-label={`Unidade da carga da série ${index + 1}`}
                            value={usePct ? 'pct' : 'kg'}
                            onChange={(e) => {
                                const next = e.target.value
                                if (next === 'pct' && !usePct) {
                                    onUpdate({ weight_target_pct1rm: null, weight_target_kg: null })
                                } else if (next === 'kg' && usePct) {
                                    onUpdate({ weight_target_kg: null, weight_target_pct1rm: null })
                                }
                            }}
                            className="text-xs font-medium text-k-text-secondary bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors focus:outline-none focus:ring-1 focus:ring-[#007AFF] dark:focus:ring-violet-500"
                        >
                            <option value="kg">kg</option>
                            <option value="pct">% 1RM</option>
                        </select>
                    </div>
                )}
            </td>

            {showAdvancedFields && (
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
            )}

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

            {showAdvancedFields && (
                <td className="py-1.5 pr-2">
                    {readonly ? (
                        <span className="text-k-text-primary">{set.tempo ?? '—'}</span>
                    ) : (
                        <input
                            type="text"
                            aria-label={`Cadência da série ${index + 1}`}
                            value={set.tempo ?? ''}
                            onChange={(e) => onUpdate({ tempo: e.target.value || null })}
                            placeholder="3-1-1-0"
                            className={`${inputClass} max-w-[80px]`}
                        />
                    )}
                </td>
            )}

            {!readonly && (
                <td className="py-1.5 pr-2">
                    <div className="flex items-center gap-0.5">
                        <button
                            type="button"
                            onClick={onDuplicate}
                            className="p-1.5 rounded text-zinc-400 hover:text-zinc-700 dark:text-k-text-quaternary dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                            title="Duplicar linha"
                            aria-label={`Duplicar linha ${index + 1}`}
                        >
                            <Copy className="w-4 h-4" />
                        </button>
                        <button
                            type="button"
                            onClick={onRemove}
                            disabled={!canRemove}
                            className="p-1.5 rounded text-zinc-400 hover:text-[#FF3B30] dark:text-k-text-quaternary dark:hover:text-red-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                            title={canRemove ? 'Remover linha' : 'Pelo menos 1 linha é obrigatória'}
                            aria-label={`Remover linha ${index + 1}`}
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </td>
            )}
        </tr>
    )
}
