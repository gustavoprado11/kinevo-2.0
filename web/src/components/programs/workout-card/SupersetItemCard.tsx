'use client'

import { ChevronDown, Copy, GripVertical, Repeat, Trash2 } from 'lucide-react'
import { useState, type HTMLAttributes } from 'react'

import type { Exercise } from '@/types/exercise'

import type { WorkoutItem } from '../program-builder-client'
import { ExerciseItemCard } from './ExerciseItemCard'

interface SupersetItemCardProps {
    item: WorkoutItem
    exercises: Exercise[]
    onDelete: () => void
    onDuplicate?: () => void
    onUpdateChild?: (childId: string, updates: Partial<WorkoutItem>) => void
    onDeleteChild?: (childId: string) => void
    /** Move o filho DENTRO do superset (setas ↑↓ — o modelo compartilhado já
     *  trata filhos no moveItemIn). */
    onMoveChild?: (childId: string, direction: 'up' | 'down') => void
    onRemoveFromSuperset?: (childId: string) => void
    onDissolveSuperset?: () => void
    dragHandleProps?: HTMLAttributes<HTMLDivElement>
    readonly?: boolean
}

/**
 * Card de superset do builder de treino.
 *
 * Layout:
 *   ▍ [grip]  Superset (2)                              [↻]  [🗑]
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
 * - O descanso é editado POR EXERCÍCIO (em cada filho), não no superset: o
 *   descanso do último filho é o tempo após a rodada; os do meio, a transição
 *   pro próximo. Ações (minimizar, duplicar, dissolver, excluir) sempre
 *   visíveis — nunca dependem de hover.
 * - Filhos renderizados em coluna, sem wrapper extra com fundo: o rail à
 *   esquerda já amarra visualmente o grupo.
 */
export function SupersetItemCard({
    item,
    exercises,
    onDelete,
    onDuplicate,
    onUpdateChild,
    onDeleteChild,
    onMoveChild,
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

            {/* Filhos — escondidos quando o superset está minimizado.
             *  Reusam o ExerciseItemCard completo (séries, reps, DESCANSO próprio,
             *  nota técnica, substituições, trocar exercício) e sem grip de
             *  arrastar. Cada exercício do superset edita seu próprio descanso:
             *  o do meio = transição pro próximo; o do último = após a rodada. */}
            {!isMinimized && (
                <div className="space-y-2 pl-3">
                    {children.map((child, index) => (
                        <ExerciseItemCard
                            key={child.id}
                            item={child}
                            exercises={exercises}
                            onUpdate={(updates) => onUpdateChild?.(child.id, updates)}
                            onDelete={() => onDeleteChild?.(child.id)}
                            {...(onMoveChild
                                ? {
                                    onMoveUp: () => onMoveChild(child.id, 'up'),
                                    onMoveDown: () => onMoveChild(child.id, 'down'),
                                    canMoveUp: index > 0,
                                    canMoveDown: index < children.length - 1,
                                }
                                : {})}
                            onRemoveFromSuperset={() => onRemoveFromSuperset?.(child.id)}
                            readonly={readonly}
                            hideDragHandle
                        />
                    ))}
                </div>
            )}
        </div>
    )
}
