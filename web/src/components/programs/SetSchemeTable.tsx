'use client'

import { useEffect, useState } from 'react'
import { Copy, Info, Minus, Plus, Trash2 } from 'lucide-react'

import type { MethodKey, SetType, WorkoutSet } from '@kinevo/shared/types/prescription'
import { SET_TYPE_OPTIONS } from '@kinevo/shared/types/prescription'
import {
    applyPreset,
} from '@kinevo/shared/lib/prescription/set-scheme'
import {
    SYSTEM_PRESETS,
    isCompoundMethod,
} from '@kinevo/shared/lib/prescription/set-scheme-presets'
import { isAmrapReps } from '@kinevo/shared/lib/prescription/set-meta-label'

import { SetSchemePresetChips } from './SetSchemePresetChips'

interface SetSchemeTableProps {
    value: WorkoutSet[]
    methodKey: MethodKey | null
    /** Rodadas (Fase 4.4). 1 para métodos lineares (default). 2..20 para
     *  compostos. O componente só mostra o stepper de rodadas quando o método
     *  ativo é compound. */
    rounds?: number | null
    onChange: (next: WorkoutSet[], nextMethodKey: MethodKey, nextRounds: number) => void
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

/* Preferências do dispositivo. RIR e Cadência ficam independentes — quem quer
 * só prescrever RIR não precisa ver a coluna Cadência junto. A chave antiga
 * (`kinevo_setscheme_advanced_fields`) ainda é lida na primeira hidratação
 * pra preservar a preferência de quem já tinha o toggle ligado. */
const SHOW_RIR_KEY = 'kinevo_setscheme_show_rir'
const SHOW_TEMPO_KEY = 'kinevo_setscheme_show_tempo'
const LEGACY_BOTH_KEY = 'kinevo_setscheme_advanced_fields'

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

const readPref = (key: string): boolean => {
    if (typeof window === 'undefined') return false
    try {
        return window.localStorage.getItem(key) === '1'
    } catch {
        return false
    }
}

const writePref = (key: string, value: boolean) => {
    if (typeof window === 'undefined') return
    try {
        window.localStorage.setItem(key, value ? '1' : '0')
    } catch {
        /* localStorage indisponível: toggle ainda funciona em memória. */
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
    readonly,
}: SetSchemeTableProps) {
    const sets = value
    const displayKey: MethodKey = methodKey ?? 'standard'
    const compound = isCompoundMethod(displayKey)
    const safeRounds = clampRounds(rounds ?? 1)

    /* RIR e Cadência são toggles independentes. Hidratamos do localStorage
     * client-side via useEffect — necessário pra evitar hydration mismatch
     * com SSR (primeira render = false em ambos, depois useEffect ajusta no
     * client). */
    const [showRir, setShowRir] = useState(false)
    const [showTempo, setShowTempo] = useState(false)
    useEffect(() => {
        const legacy = readPref(LEGACY_BOTH_KEY)
        const rir =
            window.localStorage.getItem(SHOW_RIR_KEY) === null
                ? legacy
                : readPref(SHOW_RIR_KEY)
        const tempo =
            window.localStorage.getItem(SHOW_TEMPO_KEY) === null
                ? legacy
                : readPref(SHOW_TEMPO_KEY)
        // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration de preferência persistida; setState aqui é o ponto único de sincronização com o localStorage e roda só uma vez no mount
        setShowRir(rir)
        setShowTempo(tempo)
    }, [])

    const toggleRir = () => {
        setShowRir((prev) => {
            const next = !prev
            writePref(SHOW_RIR_KEY, next)
            return next
        })
    }
    const toggleTempo = () => {
        setShowTempo((prev) => {
            const next = !prev
            writePref(SHOW_TEMPO_KEY, next)
            return next
        })
    }

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
        onChange(sets, displayKey, nextRounds)
    }

    const sectionTitle = compound ? 'Estrutura de uma rodada' : 'Fases'
    const compoundTooltip = compound
        ? `Esta estrutura de ${sets.length} ${sets.length === 1 ? 'fase' : 'fases'} será repetida ${safeRounds} ${safeRounds === 1 ? 'vez' : 'vezes'}. Cada rodada inteira conta como 1 série efetiva no volume semanal.`
        : undefined

    return (
        <div className="space-y-2.5">
            {/* Switcher de método */}
            {!readonly && (
                <SetSchemePresetChips activeKey={displayKey} onApply={applyPresetKey} />
            )}

            {/* Linha de seção: título + (rodadas, compound) + toggles RIR/Cadência */}
            <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">
                    {sectionTitle}
                    {compound && compoundTooltip && (
                        <span
                            className="inline-flex items-center justify-center text-[var(--text-tertiary)] cursor-help"
                            title={compoundTooltip}
                            aria-label="Como funciona a estrutura de rodadas"
                        >
                            <Info className="size-3" />
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {compound && (
                        <RoundsStepper
                            rounds={safeRounds}
                            readonly={readonly}
                            onIncrement={() => adjustRounds(1)}
                            onDecrement={() => adjustRounds(-1)}
                        />
                    )}
                    {!readonly && (
                        <>
                            <ToggleChip pressed={showRir} onClick={toggleRir} label="RIR" />
                            <ToggleChip pressed={showTempo} onClick={toggleTempo} label="Cadência" />
                        </>
                    )}
                </div>
            </div>

            {/* Tabela */}
            <div className="overflow-x-auto -mx-1 px-1">
                <table className="w-full text-xs text-left">
                    <thead className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
                        <tr>
                            <th className="py-2 pr-2 font-bold">#</th>
                            <th className="py-2 pr-2 font-bold">Tipo</th>
                            <th className="py-2 pr-2 font-bold">Reps</th>
                            <th className="py-2 pr-2 font-bold">Carga</th>
                            {showRir && <th className="py-2 pr-2 font-bold">RIR</th>}
                            <th className="py-2 pr-2 font-bold">Descanso</th>
                            {showTempo && <th className="py-2 pr-2 font-bold">Cadência</th>}
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
                                showRir={showRir}
                                showTempo={showTempo}
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
                    className="flex items-center gap-1.5 text-xs font-semibold text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 transition-colors"
                >
                    <Plus className="w-3.5 h-3.5" />
                    {compound ? 'Adicionar fase' : 'Adicionar série'}
                </button>
            )}
        </div>
    )
}

/* ---------- Sub-componentes da seção ---------- */

function RoundsStepper({
    rounds,
    readonly,
    onIncrement,
    onDecrement,
}: {
    rounds: number
    readonly?: boolean
    onIncrement: () => void
    onDecrement: () => void
}) {
    return (
        <div className="inline-flex items-center gap-1.5 rounded-md bg-[var(--surface-inset)] border border-[var(--border-subtle)] pl-2.5 pr-1 py-0.5">
            <span className="text-[9.5px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">
                Rodadas
            </span>
            {readonly ? (
                <span className="px-1 text-sm font-extrabold tabular-nums text-[#007AFF] dark:text-violet-400">
                    {rounds}
                </span>
            ) : (
                <>
                    <button
                        type="button"
                        onClick={onDecrement}
                        disabled={rounds <= ROUND_MIN}
                        aria-label="Diminuir rodadas"
                        className="w-5 h-5 rounded flex items-center justify-center text-[#007AFF] dark:text-violet-400 hover:bg-[var(--glass-bg-active)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                        <Minus className="w-3 h-3" />
                    </button>
                    <span className="min-w-[1.1rem] text-center text-sm font-extrabold tabular-nums text-[#007AFF] dark:text-violet-400">
                        {rounds}
                    </span>
                    <button
                        type="button"
                        onClick={onIncrement}
                        disabled={rounds >= ROUND_MAX}
                        aria-label="Aumentar rodadas"
                        className="w-5 h-5 rounded flex items-center justify-center text-[#007AFF] dark:text-violet-400 hover:bg-[var(--glass-bg-active)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                        <Plus className="w-3 h-3" />
                    </button>
                </>
            )}
        </div>
    )
}

function ToggleChip({
    pressed,
    onClick,
    label,
}: {
    pressed: boolean
    onClick: () => void
    label: string
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={pressed}
            className={
                pressed
                    ? 'inline-flex items-center gap-1 text-[10.5px] font-semibold rounded-md px-2 py-1 transition-colors bg-violet-100 text-violet-700 border border-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/30'
                    : 'inline-flex items-center gap-1 text-[10.5px] font-semibold rounded-md px-2 py-1 transition-colors text-[var(--text-secondary)] border border-[var(--border-subtle)] hover:bg-[var(--glass-bg)] hover:text-[var(--text-primary)]'
            }
        >
            {pressed ? '−' : '+'} {label}
        </button>
    )
}

/* ---------- Linha da tabela ---------- */

interface SetRowProps {
    set: WorkoutSet
    index: number
    readonly?: boolean
    showRir: boolean
    showTempo: boolean
    onUpdate: (patch: Partial<WorkoutSet>) => void
    onDuplicate: () => void
    onRemove: () => void
    canRemove: boolean
}

function SetRow({
    set,
    index,
    readonly,
    showRir,
    showTempo,
    onUpdate,
    onDuplicate,
    onRemove,
    canRemove,
}: SetRowProps) {
    /* Unidade da carga: kg vs %1RM. A inferência pura ("usePct = pct !== null")
     * trava quando ambos os campos estão null — clicar no dropdown não muda
     * nada porque o setter manda os dois pra null e a inferência continua
     * falsa. Usar estado local resolve: o trainer escolhe a unidade no
     * dropdown e a preferência fica preservada mesmo com célula vazia. O
     * useEffect sincroniza quando o dado muda externamente (ex: aplicar um
     * preset que vem com weight_target_pct1rm preenchido). */
    const [unit, setUnit] = useState<'kg' | 'pct'>(
        set.weight_target_pct1rm !== null ? 'pct' : 'kg',
    )
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronia com prop externa (apply preset / reset). Sem isso, mudar de pirâmide pra drop-set não atualizaria o dropdown que já estava aberto.
        if (set.weight_target_pct1rm !== null) setUnit('pct')
        else if (set.weight_target_kg !== null) setUnit('kg')
        // Ambos null: mantém a preferência local
    }, [set.weight_target_kg, set.weight_target_pct1rm])
    const usePct = unit === 'pct'

    const inputClass =
        'w-full bg-transparent text-[var(--text-primary)] text-xs px-1.5 py-1 border-b border-transparent focus:border-[#007AFF]/50 dark:focus:border-violet-500/50 focus:outline-none'

    const typeBorderClass = SET_TYPE_BORDER_CLASS[set.set_type] ?? ''

    return (
        <tr className={`border-t border-[var(--border-subtle)]/60 ${typeBorderClass}`}>
            <td className={`py-1.5 pr-2 font-semibold text-[var(--text-primary)] ${typeBorderClass ? 'pl-2' : ''}`}>
                {set.set_number}
            </td>

            <td className="py-1.5 pr-2">
                {readonly ? (
                    <span className="text-[var(--text-primary)]">{SET_TYPE_LABELS[set.set_type]}</span>
                ) : (
                    <select
                        aria-label={`Tipo da série ${index + 1}`}
                        value={set.set_type}
                        onChange={(e) => {
                            const nextType = e.target.value as typeof SET_TYPE_OPTIONS[number]
                            const updates: Partial<WorkoutSet> = { set_type: nextType }
                            /* Auto-fill: ao escolher Falha, preenche reps com
                             * "Máximo" pra alinhar a UI da prescrição com o
                             * que o aluno verá ("Meta: até a falha"). Pula
                             * se reps já indica falha (AMRAP, Falha, Máximo,
                             * "5+ falha", etc) — não sobrescreve intenção
                             * existente do trainer. */
                            if (nextType === 'failure' && !isAmrapReps(set.reps ?? '')) {
                                updates.reps = 'Máximo'
                            }
                            onUpdate(updates)
                        }}
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
                    <span className="text-[var(--text-primary)]">{set.reps}</span>
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
                    <span className="text-[var(--text-primary)]">
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
                            value={unit}
                            onChange={(e) => {
                                const next = e.target.value as 'kg' | 'pct'
                                if (next === unit) return
                                setUnit(next)
                                /* Limpa só o campo da unidade antiga. kg e
                                 * %1RM são escalas diferentes — converter
                                 * automaticamente induziria erro silencioso. */
                                if (next === 'pct' && set.weight_target_kg !== null) {
                                    onUpdate({ weight_target_kg: null })
                                } else if (next === 'kg' && set.weight_target_pct1rm !== null) {
                                    onUpdate({ weight_target_pct1rm: null })
                                }
                            }}
                            className="text-xs font-medium text-[var(--text-secondary)] bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors focus:outline-none focus:ring-1 focus:ring-[#007AFF] dark:focus:ring-violet-500"
                        >
                            <option value="kg">kg</option>
                            <option value="pct">% 1RM</option>
                        </select>
                    </div>
                )}
            </td>

            {showRir && (
                <td className="py-1.5 pr-2">
                    {readonly ? (
                        <span className="text-[var(--text-primary)]">{set.rir ?? '—'}</span>
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
                    <span className="text-[var(--text-primary)]">{set.rest_seconds}s</span>
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
                        <span className="text-[10px] text-[var(--text-tertiary)]">s</span>
                    </div>
                )}
            </td>

            {showTempo && (
                <td className="py-1.5 pr-2">
                    {readonly ? (
                        <span className="text-[var(--text-primary)]">{set.tempo ?? '—'}</span>
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
                            className="p-1.5 rounded text-[var(--text-quaternary)] hover:text-[var(--text-secondary)] hover:bg-[var(--glass-bg)] transition-colors"
                            title="Duplicar linha"
                            aria-label={`Duplicar linha ${index + 1}`}
                        >
                            <Copy className="w-4 h-4" />
                        </button>
                        <button
                            type="button"
                            onClick={onRemove}
                            disabled={!canRemove}
                            className="p-1.5 rounded text-[var(--text-quaternary)] hover:text-[#FF3B30] dark:hover:text-red-400 hover:bg-[#FF3B30]/10 dark:hover:bg-red-400/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
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
