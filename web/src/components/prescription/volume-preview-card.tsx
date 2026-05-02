'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { BarChart3, Ban, ChevronDown, ChevronUp, Info, Minus, Plus, RotateCcw } from 'lucide-react'

import { previewVolumeBudget } from '@/lib/prescription/constraints-engine'
import { PRIMARY_MUSCLE_GROUPS, SMALL_MUSCLE_GROUPS } from '@/lib/prescription/constants'
import type { TrainingLevel, VolumeOverride } from '@kinevo/shared/types/prescription'

// ============================================================================
// Props
// ============================================================================

type OverrideMap = Record<string, VolumeOverride>

interface VolumePreviewCardProps {
    trainingLevel: TrainingLevel
    availableDays: number[]
    sessionDurationMinutes: number
    /**
     * Phase 3.5 — controlled state of trainer overrides. Each entry is a
     * { min, max } pair (single target = same number twice; range = different
     * numbers; { 0, 0 } = "skip isolation for this group").
     */
    overrides: OverrideMap
    onOverridesChange: (next: OverrideMap) => void
}

// Hard bounds matching server-side validation in save-prescription-profile.
const OVERRIDE_MIN = 0   // 0 = skip
const OVERRIDE_MAX = 40

// ============================================================================
// Component
// ============================================================================

export function VolumePreviewCard({
    trainingLevel,
    availableDays,
    sessionDurationMinutes,
    overrides,
    onOverridesChange,
}: VolumePreviewCardProps) {
    const [isExpanded, setIsExpanded] = useState(true)

    const naturalBudget = useMemo(
        () => previewVolumeBudget({
            training_level: trainingLevel,
            available_days: availableDays,
            session_duration_minutes: sessionDurationMinutes,
        }),
        [trainingLevel, availableDays, sessionDurationMinutes],
    )

    const displayBudget = useMemo(
        () => previewVolumeBudget({
            training_level: trainingLevel,
            available_days: availableDays,
            session_duration_minutes: sessionDurationMinutes,
            volume_overrides: overrides,
        }),
        [trainingLevel, availableDays, sessionDurationMinutes, overrides],
    )

    const hasInputs = availableDays.length > 0

    const orderedGroups = useMemo(() => {
        const present = new Set<string>([
            ...Object.keys(naturalBudget),
            ...Object.keys(overrides),
        ])
        const result: string[] = []
        for (const g of PRIMARY_MUSCLE_GROUPS) {
            if (present.has(g)) result.push(g)
        }
        for (const g of SMALL_MUSCLE_GROUPS) {
            if (present.has(g)) result.push(g)
        }
        return result
    }, [naturalBudget, overrides])

    const overrideCount = Object.keys(overrides).length
    const skippedCount = Object.values(overrides).filter(
        v => v.min === 0 && v.max === 0,
    ).length

    const totalSets = useMemo(
        () => orderedGroups.reduce(
            (sum, g) => sum + (displayBudget[g]?.min ?? 0),
            0,
        ),
        [orderedGroups, displayBudget],
    )

    function setOverride(group: string, next: VolumeOverride) {
        const min = clamp(Math.round(next.min), OVERRIDE_MIN, OVERRIDE_MAX)
        const max = clamp(Math.round(next.max), min, OVERRIDE_MAX)
        onOverridesChange({ ...overrides, [group]: { min, max } })
    }

    function clearOverride(group: string) {
        const next = { ...overrides }
        delete next[group]
        onOverridesChange(next)
    }

    function shiftRange(group: string, delta: number) {
        const current = overrides[group]
        if (!current) {
            // First click: enter override mode using the natural range, shifted
            // by `delta`. This keeps continuity with what's on screen — the
            // trainer sees "12-15" and clicks +, gets "13-16".
            const natural = naturalBudget[group]
            const baseMin = natural?.min ?? 0
            const baseMax = natural?.max ?? baseMin
            setOverride(group, { min: baseMin + delta, max: baseMax + delta })
            return
        }
        // Already overridden — shift both bounds. Floor at 0, max at OVERRIDE_MAX.
        const newMin = Math.max(0, current.min + delta)
        const newMax = Math.max(newMin, Math.min(OVERRIDE_MAX, current.max + delta))
        setOverride(group, { min: newMin, max: newMax })
    }

    function skipGroup(group: string) {
        // Explicit "no isolation" — sets to {0,0}. The save action validates
        // it; the prompt-builder and validator handle the LLM side.
        setOverride(group, { min: 0, max: 0 })
    }

    return (
        <div className="bg-glass-bg backdrop-blur-md rounded-2xl
            border border-violet-200 dark:border-violet-500/30 overflow-hidden">
            {/* ── Header ─────────────────────────────────────────────────── */}
            <button
                type="button"
                onClick={() => setIsExpanded(v => !v)}
                aria-expanded={isExpanded}
                className="w-full flex items-center justify-between px-6 py-4
                    hover:bg-violet-50/60 dark:hover:bg-violet-500/[0.04] transition-colors"
            >
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-500/15
                        border border-violet-200 dark:border-violet-500/30
                        flex items-center justify-center shrink-0">
                        <BarChart3 className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div className="text-left min-w-0">
                        <span className="text-sm font-semibold text-k-text-primary block truncate">
                            Volume semanal previsto
                        </span>
                        <p className="text-[11px] text-k-text-tertiary mt-0.5 truncate">
                            {hasInputs
                                ? overrideCount > 0
                                    ? `${totalSets}+ séries · ${overrideCount} grupo${overrideCount === 1 ? '' : 's'} ajustado${overrideCount === 1 ? '' : 's'}${skippedCount > 0 ? ` (${skippedCount} sem isolamento)` : ''}`
                                    : `${totalSets}+ séries por semana · clique para ajustar grupos`
                                : 'Selecione dias para ver o que a IA vai prescrever'
                            }
                        </p>
                    </div>
                </div>
                {isExpanded
                    ? <ChevronUp className="w-4 h-4 text-k-text-tertiary shrink-0" />
                    : <ChevronDown className="w-4 h-4 text-k-text-tertiary shrink-0" />
                }
            </button>

            {/* ── Content ────────────────────────────────────────────────── */}
            <div
                className="overflow-hidden transition-all duration-300"
                style={{
                    maxHeight: isExpanded ? '1100px' : '0',
                    opacity: isExpanded ? 1 : 0,
                }}
            >
                <div className="px-6 pb-5 border-t border-violet-200 dark:border-violet-500/10 pt-3">
                    {!hasInputs ? (
                        <EmptyState />
                    ) : (
                        <>
                            <ul className="divide-y divide-violet-200/60 dark:divide-violet-500/10">
                                {orderedGroups.map(group => {
                                    const natural = naturalBudget[group]
                                    const override = overrides[group]
                                    return (
                                        <VolumeRow
                                            key={group}
                                            group={group}
                                            override={override}
                                            naturalMin={natural?.min ?? 0}
                                            naturalMax={natural?.max ?? 0}
                                            onShift={(delta) => shiftRange(group, delta)}
                                            onSetExact={(value) => setOverride(group, value)}
                                            onSkip={() => skipGroup(group)}
                                            onReset={() => clearOverride(group)}
                                        />
                                    )
                                })}
                            </ul>

                            <ImpactHint
                                trainingLevel={trainingLevel}
                                frequency={availableDays.length}
                                overrideCount={overrideCount}
                                skippedCount={skippedCount}
                            />
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}

// ============================================================================
// Volume row — label + value editor + controls
// ============================================================================
//
// Visual states:
//   - Natural (no override): "12-15 séries" plain text + [-] [+] [⛔] icons
//   - Override single (min === max): "16 séries" + same controls + [↺]
//   - Override range (min < max): "14-18 séries" + same controls + [↺]
//   - Skipped (min === 0 && max === 0): "Sem isolamento direto" italic
//                                       + [↺] only (no -/+/skip)
//
// The text input accepts: "16", "12-18", "0", "12 - 18" (whitespace tolerated).
// Invalid input falls back to last valid value on blur.

function VolumeRow({
    group,
    override,
    naturalMin,
    naturalMax,
    onShift,
    onSetExact,
    onSkip,
    onReset,
}: {
    group: string
    override: VolumeOverride | undefined
    naturalMin: number
    naturalMax: number
    onShift: (delta: number) => void
    onSetExact: (value: VolumeOverride) => void
    onSkip: () => void
    onReset: () => void
}) {
    const isOverridden = override != null
    const isSkipped = isOverridden && override.min === 0 && override.max === 0
    const effectiveMin = isOverridden ? override.min : naturalMin
    const effectiveMax = isOverridden ? override.max : naturalMax

    return (
        // Grid with two columns: label gets remaining space (minmax(0,1fr)
        // allows the label to shrink and truncate), controls are sized to
        // their content. More reliable than flex+justify-between when the
        // controls side has many children.
        <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2.5">
            <span className="text-xs font-medium text-k-text-tertiary truncate">
                {group}
            </span>

            <div className="flex items-center gap-1.5">
                {/* Decrement / increment shift the range */}
                <StepperButton
                    aria-label={`Diminuir volume de ${group}`}
                    disabled={isSkipped}
                    onClick={() => onShift(-1)}
                >
                    <Minus className="w-3 h-3" />
                </StepperButton>

                {isSkipped ? (
                    <span className="min-w-[100px] text-center text-sm font-medium italic
                        text-k-text-quaternary px-2">
                        Sem isolamento
                    </span>
                ) : (
                    <RangeInput
                        min={effectiveMin}
                        max={effectiveMax}
                        isOverridden={isOverridden}
                        onCommit={onSetExact}
                    />
                )}

                <StepperButton
                    aria-label={`Aumentar volume de ${group}`}
                    onClick={() => onShift(+1)}
                >
                    <Plus className="w-3 h-3" />
                </StepperButton>

                {/* Skip button — only RENDERED when not already skipped (no
                    space reserved when hidden, unlike the previous opacity-0
                    approach which kept eating a 24px column). */}
                {!isSkipped && (
                    <button
                        type="button"
                        onClick={onSkip}
                        aria-label={`Pular isolamento de ${group}`}
                        title="Sem isolamento (compostos ainda podem trabalhar este grupo)"
                        className="w-6 h-6 flex items-center justify-center rounded-md
                            text-k-text-quaternary hover:text-red-500 dark:hover:text-red-400
                            hover:bg-red-50 dark:hover:bg-red-500/10 cursor-pointer transition-colors"
                    >
                        <Ban className="w-3 h-3" />
                    </button>
                )}

                {/* Reset — only RENDERED when overridden. */}
                {isOverridden && (
                    <button
                        type="button"
                        onClick={onReset}
                        aria-label={`Voltar ${group} ao valor sugerido pela IA`}
                        title="Voltar ao valor sugerido pela IA"
                        className="w-6 h-6 flex items-center justify-center rounded-md
                            text-violet-600 dark:text-violet-400
                            hover:bg-violet-100 dark:hover:bg-violet-500/15
                            cursor-pointer transition-colors"
                    >
                        <RotateCcw className="w-3 h-3" />
                    </button>
                )}
            </div>
        </li>
    )
}

// ============================================================================
// RangeInput — editable text field that accepts "16" or "12-18"
// ============================================================================
// Controlled-by-keystroke locally, parent only learns about commits (blur or
// Enter). This avoids spamming the form state with every keystroke and lets
// the user type freely without clamping mid-edit.

function RangeInput({
    min,
    max,
    isOverridden,
    onCommit,
}: {
    min: number
    max: number
    isOverridden: boolean
    onCommit: (value: VolumeOverride) => void
}) {
    const formatted = formatRange(min, max)
    const [localValue, setLocalValue] = useState(formatted)
    const [isFocused, setIsFocused] = useState(false)
    const inputRef = useRef<HTMLInputElement | null>(null)

    // Reflect parent updates when not actively editing — e.g., user clicked
    // +/- from outside while focused elsewhere.
    useEffect(() => {
        if (!isFocused) {
            setLocalValue(formatted)
        }
    }, [formatted, isFocused])

    function commit() {
        const parsed = parseRange(localValue)
        if (parsed) {
            onCommit(parsed)
        } else {
            // Invalid → revert to last valid value
            setLocalValue(formatted)
        }
    }

    return (
        <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            onFocus={(e) => {
                setIsFocused(true)
                e.target.select()
            }}
            onBlur={() => {
                setIsFocused(false)
                commit()
            }}
            onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    e.preventDefault()
                    inputRef.current?.blur()
                }
                if (e.key === 'Escape') {
                    setLocalValue(formatted)
                    inputRef.current?.blur()
                }
            }}
            aria-label="Volume semanal (séries)"
            className={`w-[100px] text-right text-sm font-semibold
                bg-transparent border border-transparent rounded-md px-2 py-0.5
                focus:outline-none focus:border-violet-400 dark:focus:border-violet-500/40
                focus:bg-white dark:focus:bg-white/[0.04]
                ${isOverridden
                    ? 'text-violet-700 dark:text-violet-300'
                    : 'text-k-text-primary'
                }`}
        />
    )
}

// ============================================================================
// Helpers
// ============================================================================

function clamp(value: number, low: number, high: number): number {
    if (!Number.isFinite(value)) return low
    return Math.max(low, Math.min(high, value))
}

function formatRange(min: number, max: number): string {
    if (min === max) return `${min} séries`
    return `${min}-${max} séries`
}

function parseRange(text: string): VolumeOverride | null {
    const cleaned = text.trim().replace(/séries?/gi, '').trim()
    if (!cleaned) return null

    // Range form: "12-18", "12 - 18"
    const rangeMatch = cleaned.match(/^(\d+)\s*[-–]\s*(\d+)$/)
    if (rangeMatch) {
        const a = parseInt(rangeMatch[1], 10)
        const b = parseInt(rangeMatch[2], 10)
        if (Number.isFinite(a) && Number.isFinite(b)) {
            return { min: Math.min(a, b), max: Math.max(a, b) }
        }
    }

    // Single form: "16"
    const single = cleaned.match(/^(\d+)$/)
    if (single) {
        const n = parseInt(single[1], 10)
        if (Number.isFinite(n)) return { min: n, max: n }
    }

    return null
}

// ============================================================================
// Stepper button (compact +/-)
// ============================================================================

function StepperButton({
    children,
    onClick,
    disabled,
    'aria-label': ariaLabel,
}: {
    children: React.ReactNode
    onClick: () => void
    disabled?: boolean
    'aria-label': string
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={ariaLabel}
            className="w-6 h-6 flex items-center justify-center rounded-md
                bg-white dark:bg-white/[0.04]
                border border-[#D2D2D7] dark:border-k-border-secondary
                text-k-text-secondary hover:text-violet-600 dark:hover:text-violet-300
                hover:border-violet-400 dark:hover:border-violet-500/40
                disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-k-text-secondary
                disabled:hover:border-[#D2D2D7] dark:disabled:hover:border-k-border-secondary
                transition-colors cursor-pointer"
        >
            {children}
        </button>
    )
}

// ============================================================================
// Empty state
// ============================================================================

function EmptyState() {
    return (
        <div className="py-4 text-center text-xs text-k-text-tertiary">
            Selecione pelo menos um dia disponível para ver
            o volume previsto por grupo muscular.
        </div>
    )
}

// ============================================================================
// Impact hint
// ============================================================================

function ImpactHint({
    trainingLevel,
    frequency,
    overrideCount,
    skippedCount,
}: {
    trainingLevel: TrainingLevel
    frequency: number
    overrideCount: number
    skippedCount: number
}) {
    const levelLabel = {
        beginner: 'iniciante',
        intermediate: 'intermediário',
        advanced: 'avançado',
    }[trainingLevel]

    let message: string
    if (overrideCount === 0) {
        message =
            `Faixa calculada a partir do nível ${levelLabel} e ${frequency} dia${frequency === 1 ? '' : 's'}/semana. ` +
            `Toque + ou − para ajustar, digite uma faixa (ex: "12-18"), ou use o botão ⛔ para zerar isolamento de um grupo.`
    } else if (skippedCount === 0) {
        message =
            `Você ajustou ${overrideCount} grupo${overrideCount === 1 ? '' : 's'}. A IA vai priorizar essas faixas no programa.`
    } else if (skippedCount === overrideCount) {
        const groupWord = skippedCount === 1 ? 'grupo' : 'grupos'
        message =
            `${skippedCount} ${groupWord} sem isolamento — a IA não vai prescrever exercícios isolados, mas compostos ainda podem trabalhá-los.`
    } else {
        const adjustWord = overrideCount - skippedCount === 1 ? 'grupo' : 'grupos'
        const skipWord = skippedCount === 1 ? 'grupo' : 'grupos'
        message =
            `${overrideCount - skippedCount} ${adjustWord} com volume ajustado e ${skippedCount} ${skipWord} sem isolamento. ` +
            `Compostos continuam podendo trabalhar grupos sem isolamento.`
    }

    return (
        <div className="mt-3 flex items-start gap-2 px-3 py-2 rounded-lg
            bg-violet-50 dark:bg-violet-500/10
            border border-violet-200 dark:border-violet-500/30
            text-xs text-violet-700 dark:text-violet-200 leading-relaxed">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 opacity-80" />
            <span>{message}</span>
        </div>
    )
}
