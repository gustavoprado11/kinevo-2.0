'use client'

import { ChevronDown, GripVertical } from 'lucide-react'
import type { HTMLAttributes, ReactNode } from 'react'

import { WORKOUT_CARD_TYPE, type WorkoutCardType } from './workout-card-types'

export interface WorkoutCardShellProps {
    type: WorkoutCardType
    title: string
    /** Resumo mostrado apenas no estado colapsado, à direita do título. */
    subtitle?: ReactNode
    /** Slot para chips/badges (Drop-set, muscle tags, method) à direita do título. */
    badges?: ReactNode
    isExpanded: boolean
    onToggle: () => void
    /** 'top' = card de topo (sortável). 'nested' = filho de Superset (sem drag, sem fundo). */
    variant?: 'top' | 'nested'

    /**
     * Props para o GripVertical (dnd-kit listeners + attributes mesclados,
     * ou HTMLAttributes legados). Apenas em variant='top'. Tipo permissivo
     * porque é apenas spread no DOM.
     */
    dragHandleProps?: HTMLAttributes<HTMLElement> | Record<string, unknown>
    /** dnd-kit attributes aplicados ao container raiz. Apenas em variant='top'. */
    dragAttributes?: Record<string, unknown>

    /** Slot para <WorkoutCardKebab items={...} />. */
    kebab?: ReactNode

    /**
     * Conteúdo extra a renderizar dentro do header quando o card está
     * colapsado, abaixo da linha do título. Útil para inputs compactos
     * (ex: Quick fields do Exercise). Sem border-top próprio.
     */
    compactBody?: ReactNode

    /** Conteúdo do body expandido. */
    children?: ReactNode

    /**
     * Quando true, oculta affordances de **edição** (drag handle, kebab),
     * mas mantém affordances de **navegação** (chevron e toggle continuam
     * ativos para permitir expandir/recolher e visualizar detalhes).
     */
    readonly?: boolean

    /** Classe extra para o container raiz. */
    className?: string
}

/**
 * Estrutura padrão dos cards de exercício na tela de prescrição.
 *
 * Layout do header: [Grip*] [Icon**] [Title] [Badges] [· Subtitle***] [Chevron] [Kebab]
 *
 * - O click no header dispara `onToggle` (toggle bidirecional). Elementos
 *   interativos dentro de `badges`, `kebab` ou `compactBody` precisam chamar
 *   `e.stopPropagation()` nos seus handlers — o Shell não intercepta cliques
 *   internos.
 * - GripVertical e Kebab usam fade-in via `group-hover` (o container raiz tem
 *   `group`).
 * - Em `variant='nested'`, o GripVertical não é renderizado (V1: filhos de
 *   Superset não são sortáveis).
 * - `readonly`: oculta apenas affordances de edição (grip, kebab). O chevron
 *   permanece interativo para navegação.
 */
export function WorkoutCardShell({
    type,
    title,
    subtitle,
    badges,
    isExpanded,
    onToggle,
    variant = 'top',
    dragHandleProps,
    dragAttributes,
    kebab,
    compactBody,
    children,
    readonly,
    className,
}: WorkoutCardShellProps) {
    const cfg = WORKOUT_CARD_TYPE[type]
    const Icon = cfg.icon

    const baseSurface =
        variant === 'top'
            ? 'bg-[var(--surface-card)] border-[var(--border-subtle)]'
            : 'bg-transparent border-[var(--border-subtle)]/60'

    const headerPadding = variant === 'top' ? 'px-4 py-3' : 'px-3 py-2.5'
    const bodyPadding = variant === 'top' ? 'px-4 pb-4 pt-3' : 'px-3 pb-3 pt-2'

    const showGrip = variant === 'top' && !readonly
    const showKebab = !readonly && !!kebab

    return (
        <div
            {...(dragAttributes ?? {})}
            className={`group rounded-xl border transition-colors ${baseSurface}${className ? ` ${className}` : ''}`}
        >
            <div
                role="button"
                tabIndex={0}
                onClick={onToggle}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onToggle()
                    }
                }}
                className={`${headerPadding} cursor-pointer select-none`}
            >
                <div className="flex items-center gap-2">
                    {showGrip && (
                        <button
                            type="button"
                            {...(dragHandleProps ?? {})}
                            onClick={(e) => e.stopPropagation()}
                            className="shrink-0 -ml-1 p-1 rounded-md text-[var(--text-quaternary)] hover:text-[var(--text-secondary)] cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                            aria-label="Reordenar"
                        >
                            <GripVertical className="size-4" />
                        </button>
                    )}

                    <div className="flex-1 min-w-0 flex items-center gap-2">
                        {Icon && (
                            <Icon
                                className="size-4 shrink-0"
                                style={{ color: cfg.accentVar }}
                                aria-hidden
                            />
                        )}
                        <span className="font-semibold text-[15px] text-[var(--text-primary)] truncate">
                            {title}
                        </span>
                        {badges}
                        {!isExpanded && subtitle && (
                            <span className="text-sm text-[var(--text-secondary)] truncate flex items-center min-w-0">
                                <span className="mx-1.5 text-[var(--text-tertiary)]">·</span>
                                <span className="truncate">{subtitle}</span>
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation()
                                onToggle()
                            }}
                            className="h-7 w-7 inline-flex items-center justify-center rounded-md text-[var(--text-quaternary)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg)] transition-colors"
                            aria-label={isExpanded ? 'Recolher' : 'Expandir'}
                        >
                            <ChevronDown
                                className={`size-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            />
                        </button>
                        {showKebab && (
                            <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                                {kebab}
                            </div>
                        )}
                    </div>
                </div>

                {!isExpanded && compactBody && (
                    <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                        {compactBody}
                    </div>
                )}
            </div>

            {isExpanded && children && (
                <div className={`${bodyPadding} border-t border-[var(--border-subtle)]/60`}>
                    {children}
                </div>
            )}
        </div>
    )
}
