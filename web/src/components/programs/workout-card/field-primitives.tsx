'use client'

// Primitivas de campo dos cards do builder — mesma linguagem do trilho de
// métricas do exercício (MetricCard do ExerciseMetricsTrack): caixa inset com
// hairline, rótulo em Geist Mono 9px uppercase e valores mono tabulares.
// Usadas pelos cards de Aquecimento e Aeróbio (Fase 4 do redesign: assinatura
// própria do builder — violeta só na ação, cor de tipo só no ícone).

import type { ReactNode } from 'react'

/** Caixa de campo rotulada — clone visual do MetricCard do trilho de exercício. */
export function FieldCard({
    label,
    icon,
    children,
    className,
}: {
    label: string
    icon?: ReactNode
    children: ReactNode
    className?: string
}) {
    return (
        <div
            className={`flex items-start gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-2.5 py-2 transition-colors hover:bg-[var(--surface-card)] hover:border-[var(--border-primary)]${className ? ` ${className}` : ''}`}
        >
            {icon && (
                <span className="shrink-0 text-[var(--text-tertiary)] mt-0.5" aria-hidden>
                    {icon}
                </span>
            )}
            <div className="flex-1 min-w-0">
                <div className="font-mono text-[9px] font-medium uppercase tracking-[0.1em] text-[var(--text-tertiary)] leading-tight mb-0.5">
                    {label}
                </div>
                <div className="min-w-0">{children}</div>
            </div>
        </div>
    )
}

/** Input numérico/textual dentro de um FieldCard — mono, tabular, foco violeta. */
export const fieldInputClass =
    'w-full bg-transparent font-mono text-[var(--text-primary)] text-[12.5px] font-semibold tabular-nums focus:outline-none focus:text-[#7C3AED] dark:focus:text-violet-400 transition-colors placeholder:text-[var(--text-quaternary)] placeholder:font-medium p-0'

/** Select quieto dentro de um FieldCard — mesmo estilo do FUNÇÃO do exercício. */
export const fieldSelectClass =
    'w-full bg-transparent text-[13px] font-semibold text-[var(--text-primary)] cursor-pointer focus:outline-none focus:text-[#7C3AED] dark:focus:text-violet-400 transition-colors p-0 appearance-none pr-3'

export const fieldSelectChevronStyle = {
    backgroundImage:
        "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'><path fill='none' stroke='%23999' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round' d='M2.5 4l2.5 2.5L7.5 4'/></svg>\")",
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 0 center',
} as const

/** Sufixo de unidade ("s", "min", "km", "bpm") ao lado de um input mono. */
export function UnitSuffix({ children }: { children: ReactNode }) {
    return (
        <span className="text-[10.5px] font-medium text-[var(--text-tertiary)]">{children}</span>
    )
}

/**
 * Grupo segmentado neutro (padrão "filtros como segmentos" do redesign):
 * trilho inset, opção ativa = superfície + hairline + tinta. Sem cor de tipo.
 */
export function SegmentGroup<T extends string>({
    options,
    value,
    onChange,
    size = 'sm',
    ariaLabel,
}: {
    options: Array<{ value: T; label: ReactNode; title?: string; disabled?: boolean }>
    value: T
    onChange: (v: T) => void
    size?: 'sm' | 'xs'
    ariaLabel?: string
}) {
    const pad = size === 'xs' ? 'px-2 h-6 text-[10.5px]' : 'px-2.5 h-6.5 text-[11px]'
    return (
        <div
            role="group"
            aria-label={ariaLabel}
            className="inline-flex items-center gap-0.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-inset)] p-0.5"
        >
            {options.map((opt) => {
                const active = opt.value === value
                return (
                    <button
                        key={opt.value}
                        type="button"
                        disabled={opt.disabled}
                        title={opt.title}
                        onClick={(e) => {
                            e.stopPropagation()
                            if (!opt.disabled) onChange(opt.value)
                        }}
                        className={`inline-flex items-center gap-1 rounded-[6px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${pad} ${
                            active
                                ? 'bg-[var(--surface-card)] text-[var(--text-primary)] shadow-sm ring-1 ring-[var(--border-subtle)]'
                                : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
                        }`}
                    >
                        {opt.label}
                    </button>
                )
            })}
        </div>
    )
}

/**
 * Tecla de valor discreto (zonas Z1–Z5, RPE 1–10) — mono; selecionada = tinta
 * ("pílula só quando é estado": a seleção é estado, preenchida com a tinta).
 */
export function KeyChip({
    selected,
    onClick,
    title,
    children,
    width = 'w-8',
}: {
    selected: boolean
    onClick: () => void
    title?: string
    children: ReactNode
    width?: string
}) {
    return (
        <button
            type="button"
            title={title}
            onClick={(e) => {
                e.stopPropagation()
                onClick()
            }}
            className={`${width} h-7 rounded-[6px] font-mono text-[11px] font-semibold tabular-nums transition-colors border ${
                selected
                    ? 'bg-[var(--text-primary)] border-[var(--text-primary)] text-[var(--surface-card)]'
                    : 'bg-transparent border-[var(--border-subtle)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:border-[var(--border-primary)]'
            }`}
        >
            {children}
        </button>
    )
}
