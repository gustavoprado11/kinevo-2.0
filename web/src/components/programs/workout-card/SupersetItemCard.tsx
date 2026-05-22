'use client'

import { ChevronDown, Copy, GripVertical, Repeat, Trash2 } from 'lucide-react'
import { useState, type HTMLAttributes } from 'react'

import type { WorkoutItem } from '../program-builder-client'
import { SupersetChildCard } from './SupersetChildCard'

interface SupersetItemCardProps {
    item: WorkoutItem
    onUpdate: (updates: Partial<WorkoutItem>) => void
    onDelete: () => void
    onDuplicate?: () => void
    onUpdateChild?: (childId: string, updates: Partial<WorkoutItem>) => void
    onDeleteChild?: (childId: string) => void
    onRemoveFromSuperset?: (childId: string) => void
    onDissolveSuperset?: () => void
    dragHandleProps?: HTMLAttributes<HTMLDivElement>
    readonly?: boolean
}

/**
 * Card de superset do builder de treino.
 *
 * Layout:
 *   ▍ [grip]  Superset (2)              Descanso  [0] s   [↻]  [🗑]
 *   ▍
 *   ▍   ┌──────────────────────────────────────────┐
 *   ▍   │ <SupersetChildCard />                    │
 *   ▍   └──────────────────────────────────────────┘
 *   ▍   ┌──────────────────────────────────────────┐
 *   ▍   │ <SupersetChildCard />                    │
 *   ▍   └──────────────────────────────────────────┘
 *
 * Decisões:
 * - Card sempre aberto (sem chevron / collapse). Mostra a estrutura inteira
 *   do superset de cara — cabe a um treinador entender a sequência.
 * - Faixa azul/violeta vertical à esquerda como identidade do superset.
 *   Substitui o ícone do tipo: o rail é mais discreto e marca melhor o
 *   agrupamento dos filhos.
 * - Ações do canto superior direito (descanso, dissolver, excluir) sempre
 *   visíveis — nunca dependem de hover.
 * - Filhos renderizados em coluna, sem wrapper extra com fundo: o rail à
 *   esquerda já amarra visualmente o grupo.
 */
export function SupersetItemCard({
    item,
    onUpdate,
    onDelete,
    onDuplicate,
    onUpdateChild,
    onDeleteChild,
    onRemoveFromSuperset,
    onDissolveSuperset,
    dragHandleProps,
    readonly,
}: SupersetItemCardProps) {
    const children = item.children || []
    /* Minimização manual: esconde a lista de filhos, mantém o header com
     * Descanso visível. */
    const [isMinimized, setIsMinimized] = useState(false)

    return (
        <div className="bg-[var(--surface-card)] rounded-xl border border-[var(--border-subtle)] p-4 relative transition-colors hover:border-[var(--border-primary)]">
            {/* Faixa vertical azul (identidade do superset) */}
            <div
                aria-hidden
                className="absolute top-4 bottom-4 left-0 w-1 rounded-r-full bg-[#7C3AED]/20 dark:bg-violet-600/20"
            />

            {/* Header */}
            <div className="flex items-center justify-between gap-3 mb-4 pl-3">
                <div className="flex items-center gap-3 min-w-0">
                    {!readonly && (
                        <div
                            {...(dragHandleProps ?? {})}
                            className="text-[var(--text-quaternary)] hover:text-[var(--text-secondary)] cursor-grab active:cursor-grabbing touch-none transition-colors shrink-0"
                            aria-label="Reordenar"
                        >
                            <GripVertical className="w-4 h-4" />
                        </div>
                    )}
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-bold text-[#7C3AED] dark:text-violet-400 truncate">
                            Superset
                        </span>
                        <span className="flex items-center justify-center bg-[#7C3AED]/10 dark:bg-violet-500/10 text-[#7C3AED] dark:text-violet-300 text-[10px] font-bold px-1.5 py-0.5 rounded border border-[#7C3AED]/20 dark:border-violet-500/20 shrink-0">
                            {children.length}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-[#8E8E93] dark:text-k-text-tertiary">
                            Descanso
                        </span>
                        {readonly ? (
                            <span className="text-[#1C1C1E] dark:text-k-text-primary text-xs font-medium">
                                {item.rest_seconds || 0}s
                            </span>
                        ) : (
                            <>
                                <input
                                    type="number"
                                    min={0}
                                    step={15}
                                    value={item.rest_seconds || ''}
                                    onChange={(e) =>
                                        onUpdate({
                                            rest_seconds: parseInt(e.target.value) || null,
                                        })
                                    }
                                    onFocus={(e) => e.target.select()}
                                    placeholder="0"
                                    className="w-8 bg-transparent text-[#1C1C1E] dark:text-k-text-primary text-xs font-medium text-center focus:outline-none focus:text-[#7C3AED] dark:focus:text-violet-400 transition-colors placeholder:text-k-border-subtle border-b border-transparent focus:border-[#7C3AED]/50 dark:focus:border-violet-500/50 p-0"
                                />
                                <span className="text-[10px] text-[#8E8E93] dark:text-k-text-tertiary">
                                    s
                                </span>
                            </>
                        )}
                    </div>

                    {/* Ações sempre visíveis */}
                    {!readonly && (
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                onClick={() => setIsMinimized((v) => !v)}
                                className="p-1.5 rounded-md text-[var(--text-quaternary)] hover:text-[var(--text-secondary)] hover:bg-[var(--glass-bg)] transition-colors"
                                title={isMinimized ? 'Expandir superset' : 'Minimizar superset'}
                                aria-label={isMinimized ? 'Expandir superset' : 'Minimizar superset'}
                                aria-expanded={!isMinimized}
                            >
                                <ChevronDown
                                    className={`w-3.5 h-3.5 transition-transform ${isMinimized ? '' : 'rotate-180'}`}
                                />
                            </button>
                            {onDuplicate && (
                                <button
                                    type="button"
                                    onClick={onDuplicate}
                                    className="p-1.5 rounded-md text-[var(--text-quaternary)] hover:text-[#7C3AED] dark:hover:text-violet-400 hover:bg-[#7C3AED]/10 dark:hover:bg-violet-400/10 transition-colors"
                                    title="Duplicar superset"
                                    aria-label="Duplicar superset"
                                >
                                    <Copy className="w-3.5 h-3.5" />
                                </button>
                            )}
                            {onDissolveSuperset && (
                                <button
                                    type="button"
                                    onClick={onDissolveSuperset}
                                    className="p-1.5 rounded-md text-[var(--text-quaternary)] hover:text-[#7C3AED] dark:hover:text-violet-400 hover:bg-[#7C3AED]/10 dark:hover:bg-violet-400/10 transition-colors"
                                    title="Dissolver superset"
                                    aria-label="Dissolver superset"
                                >
                                    <Repeat className="w-3.5 h-3.5" />
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={onDelete}
                                className="p-1.5 rounded-md text-[var(--text-quaternary)] hover:text-[#FF3B30] dark:hover:text-red-400 hover:bg-[#FF3B30]/10 dark:hover:bg-red-400/10 transition-colors"
                                title="Excluir superset"
                                aria-label="Excluir superset"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Filhos — escondidos quando o superset está minimizado */}
            {!isMinimized && (
                <div className="space-y-2 pl-3">
                    {children.map((child) => (
                        <SupersetChildCard
                            key={child.id}
                            item={child}
                            onUpdate={(updates) => onUpdateChild?.(child.id, updates)}
                            onDelete={() => onDeleteChild?.(child.id)}
                            onRemoveFromSuperset={() => onRemoveFromSuperset?.(child.id)}
                            readonly={readonly}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}
