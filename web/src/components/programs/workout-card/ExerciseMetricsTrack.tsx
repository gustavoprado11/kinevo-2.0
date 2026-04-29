'use client'

import { ArrowLeftRight, Clock, Hash, ListOrdered } from 'lucide-react'
import { memo, type ReactNode } from 'react'

import { isCompoundMethod } from '@kinevo/shared/lib/prescription/set-scheme-presets'
import {
    EXERCISE_FUNCTION_LABELS,
    EXERCISE_FUNCTION_OPTIONS,
    type ExerciseFunction,
    type WorkoutSet,
} from '@kinevo/shared/types/prescription'

import type { WorkoutItem } from '../program-builder-client'

interface ExerciseMetricsTrackProps {
    item: WorkoutItem
    readonly?: boolean
    onUpdate: (updates: Partial<WorkoutItem>) => void
    /**
     * Quando true, oculta o card de Descanso. Usado em filhos de superset:
     * o tempo de descanso vive no superset pai (entre rodadas), não no
     * exercício individual.
     */
    omitRest?: boolean
}

/**
 * Trilho horizontal de métricas do exercício — Séries / Repetições / Descanso /
 * Função. É o mesmo componente nos dois modos:
 *
 *   - Modo simples (sem `set_scheme`): cada card é um input editável.
 *   - Modo detalhado (com `set_scheme`): cards viram resumo derivado da
 *     tabela. "Repetições: 12·10·8", "Descanso: 90s" (uniforme) ou
 *     "15·15·180s" (variado), com sufixo "(× N)" pra métodos compostos.
 *
 * Esse trilho é o ponto de consistência entre o card simples, o detalhado e
 * os filhos de superset: mesma altura, mesmo layout, mesma posição da Função.
 */
export const ExerciseMetricsTrack = memo(function ExerciseMetricsTrack({
    item,
    readonly,
    onUpdate,
    omitRest,
}: ExerciseMetricsTrackProps) {
    const scheme = item.set_scheme ?? null
    const hasScheme = !!scheme && scheme.length > 0
    const compound = hasScheme && isCompoundMethod(item.method_key ?? null)
    const rounds = compound ? clampRounds(item.rounds ?? 1) : 1

    const gridCols = omitRest
        ? 'grid-cols-2 sm:grid-cols-3'
        : 'grid-cols-2 sm:grid-cols-4'

    return (
        <div className={`grid ${gridCols} gap-1.5`}>
            {/* Séries */}
            <MetricCard label="Séries" icon={<ListOrdered className="size-4" />}>
                {hasScheme ? (
                    <SchemeSeriesValue scheme={scheme!} compound={compound} rounds={rounds} />
                ) : readonly ? (
                    <ReadonlyValue value={item.sets ?? 0} />
                ) : (
                    <input
                        type="number"
                        min={1}
                        step={1}
                        value={item.sets ?? ''}
                        onChange={(e) => onUpdate({ sets: parseInt(e.target.value) || null })}
                        onFocus={(e) => e.target.select()}
                        placeholder="0"
                        className={metricInputClass}
                        aria-label="Séries"
                    />
                )}
            </MetricCard>

            {/* Repetições */}
            <MetricCard label="Repetições" icon={<Hash className="size-4" />}>
                {hasScheme ? (
                    <SchemeRepsValue scheme={scheme!} compound={compound} rounds={rounds} />
                ) : readonly ? (
                    <ReadonlyValue value={item.reps ?? '—'} />
                ) : (
                    <input
                        type="text"
                        value={item.reps ?? ''}
                        onChange={(e) => onUpdate({ reps: e.target.value || null })}
                        onFocus={(e) => e.target.select()}
                        placeholder="0"
                        className={metricInputClass}
                        aria-label="Repetições"
                    />
                )}
            </MetricCard>

            {/* Descanso (omitido em filhos de superset — pai controla o descanso entre rodadas) */}
            {!omitRest && (
            <MetricCard label="Descanso" icon={<Clock className="size-4" />}>
                {hasScheme ? (
                    <SchemeRestValue scheme={scheme!} />
                ) : readonly ? (
                    <ReadonlyValue value={`${item.rest_seconds ?? 0}s`} />
                ) : (
                    <div className="flex items-baseline gap-1">
                        <input
                            type="number"
                            min={0}
                            step={15}
                            value={item.rest_seconds ?? ''}
                            onChange={(e) =>
                                onUpdate({ rest_seconds: parseInt(e.target.value) || null })
                            }
                            onFocus={(e) => e.target.select()}
                            placeholder="0"
                            className={`${metricInputClass} max-w-[3rem]`}
                            aria-label="Descanso (segundos)"
                        />
                        <span className="text-[10.5px] font-medium text-[var(--text-tertiary)]">
                            s
                        </span>
                    </div>
                )}
            </MetricCard>
            )}

            {/* Função (sempre o mesmo controle, simples ou detalhado) */}
            <MetricCard label="Função" icon={<ArrowLeftRight className="size-4" />}>
                <FunctionSelect
                    value={item.exercise_function}
                    readonly={readonly}
                    onChange={(v) => onUpdate({ exercise_function: v })}
                />
            </MetricCard>
        </div>
    )
})

/* ---------- Sub-componentes ---------- */

function MetricCard({
    label,
    icon,
    children,
}: {
    label: string
    icon: ReactNode
    children: ReactNode
}) {
    return (
        <div className="flex items-start gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-2.5 py-2 transition-colors hover:bg-[var(--surface-card)] hover:border-[var(--border-primary)]">
            <span className="shrink-0 text-[var(--text-tertiary)] mt-0.5" aria-hidden>
                {icon}
            </span>
            <div className="flex-1 min-w-0">
                <div className="text-[9.5px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] leading-tight mb-0.5">
                    {label}
                </div>
                <div className="min-w-0">{children}</div>
            </div>
        </div>
    )
}

const metricInputClass =
    'w-full bg-transparent text-[var(--text-primary)] text-[13px] font-bold tabular-nums focus:outline-none focus:text-[#007AFF] dark:focus:text-violet-400 transition-colors placeholder:text-[var(--text-quaternary)] placeholder:font-medium p-0'

function ReadonlyValue({ value }: { value: string | number }) {
    return (
        <span className="text-[13px] font-bold text-[var(--text-primary)] tabular-nums">
            {value}
        </span>
    )
}

function FunctionSelect({
    value,
    readonly,
    onChange,
}: {
    value?: string | null
    readonly?: boolean
    onChange: (v: ExerciseFunction | null) => void
}) {
    const label =
        value && EXERCISE_FUNCTION_OPTIONS.includes(value as ExerciseFunction)
            ? EXERCISE_FUNCTION_LABELS[value as ExerciseFunction]
            : null

    if (readonly) {
        return (
            <span className="text-[13px] font-semibold text-[var(--text-primary)]">
                {label ?? '—'}
            </span>
        )
    }

    return (
        <select
            value={value ?? ''}
            onChange={(e) => onChange((e.target.value || null) as ExerciseFunction | null)}
            aria-label="Função do exercício"
            className="w-full bg-transparent text-[13px] font-semibold text-[var(--text-primary)] cursor-pointer focus:outline-none focus:text-[#007AFF] dark:focus:text-violet-400 transition-colors p-0 appearance-none pr-3"
            style={{
                backgroundImage:
                    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'><path fill='none' stroke='%23999' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round' d='M2.5 4l2.5 2.5L7.5 4'/></svg>\")",
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 0 center',
            }}
        >
            <option value="">—</option>
            {EXERCISE_FUNCTION_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                    {EXERCISE_FUNCTION_LABELS[opt]}
                </option>
            ))}
        </select>
    )
}

/* ---------- Resumos derivados ---------- */

function SchemeSeriesValue({
    scheme,
    compound,
    rounds,
}: {
    scheme: WorkoutSet[]
    compound: boolean
    rounds: number
}) {
    const phases = scheme.length
    if (compound && rounds > 1) {
        return (
            <div className="text-[13px] font-bold text-[var(--text-primary)] leading-tight tabular-nums">
                {rounds}{' '}
                <span className="text-[10.5px] font-medium text-[var(--text-tertiary)]">
                    rodadas × {phases} fases
                </span>
            </div>
        )
    }
    return (
        <div className="text-[13px] font-bold text-[var(--text-primary)] leading-tight tabular-nums">
            {phases}{' '}
            <span className="text-[10.5px] font-medium text-[var(--text-tertiary)]">
                {phases === 1 ? 'fase' : 'fases'}
            </span>
        </div>
    )
}

function SchemeRepsValue({
    scheme,
    compound,
    rounds,
}: {
    scheme: WorkoutSet[]
    compound: boolean
    rounds: number
}) {
    const reps = scheme.map((s) => s.reps ?? '—')
    return (
        <div className="text-[13px] font-bold text-[var(--text-primary)] leading-tight tabular-nums">
            {compactSequence(reps)}
            {compound && rounds > 1 && (
                <span className="text-[10.5px] font-medium text-[var(--text-tertiary)] ml-1">
                    (× {rounds})
                </span>
            )}
        </div>
    )
}

function SchemeRestValue({ scheme }: { scheme: WorkoutSet[] }) {
    const rest = scheme.map((s) => s.rest_seconds ?? 0)
    return (
        <div className="text-[13px] font-bold text-[var(--text-primary)] leading-tight tabular-nums">
            {compactSequence(rest)}{' '}
            <span className="text-[10.5px] font-medium text-[var(--text-tertiary)]">s</span>
        </div>
    )
}

/* ---------- Helpers ---------- */

/** Mostra um valor único quando todos os elementos são iguais; senão, junta
 *  com `·`. Mantém a leitura curta quando o trainer não diferenciou as fases. */
function compactSequence<T>(values: T[]): string {
    if (values.length === 0) return '—'
    const first = values[0]
    if (values.every((v) => v === first)) return String(first)
    return values.map((v) => String(v)).join(' · ')
}

function clampRounds(n: number | null | undefined): number {
    const v = Number.isFinite(n as number) ? Math.floor(n as number) : 1
    return Math.max(1, Math.min(20, v))
}
