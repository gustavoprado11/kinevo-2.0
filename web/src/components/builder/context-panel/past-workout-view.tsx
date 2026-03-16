import { Loader2, Repeat, Clock, MessageSquare, StickyNote } from 'lucide-react'
import type { PastWorkoutDetail, PastWorkoutItem } from '@/app/students/[id]/actions/get-past-workouts'

const FUNCTION_LABELS: Record<string, string> = {
    warmup: 'AQUECIMENTO',
    activation: 'ATIVAÇÃO',
    main: 'PRINCIPAL',
    accessory: 'ACESSÓRIO',
    conditioning: 'CONDICIONAMENTO',
}

interface PastWorkoutViewProps {
    detail: PastWorkoutDetail | null
    isLoading: boolean
}

export function PastWorkoutView({ detail, isLoading }: PastWorkoutViewProps) {
    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <Loader2 size={20} className="animate-spin text-[#AEAEB2] dark:text-k-text-quaternary" />
            </div>
        )
    }

    if (!detail) {
        return (
            <div className="flex-1 flex items-center justify-center px-6">
                <p className="text-xs text-[#AEAEB2] dark:text-k-text-quaternary text-center leading-relaxed">
                    Selecione um treino anterior para comparar com o treino atual
                </p>
            </div>
        )
    }

    // Build render list: group supersets, insert section headers
    const topLevel = detail.items.filter(i => !i.parent_item_id)
    const childrenByParent = new Map<string, PastWorkoutItem[]>()
    for (const item of detail.items) {
        if (item.parent_item_id) {
            const list = childrenByParent.get(item.parent_item_id) || []
            list.push(item)
            childrenByParent.set(item.parent_item_id, list)
        }
    }

    type RenderItem =
        | { type: 'section_header'; label: string }
        | { type: 'exercise'; item: PastWorkoutItem }
        | { type: 'superset'; item: PastWorkoutItem; children: PastWorkoutItem[] }
        | { type: 'note'; item: PastWorkoutItem }

    const renderItems: RenderItem[] = []
    const hasAnyFunction = topLevel.some(i => i.exercise_function)
    let lastFunction: string | null = null

    for (const item of topLevel) {
        // Insert section header if function changed
        if (hasAnyFunction && item.item_type !== 'note' && item.exercise_function && item.exercise_function !== lastFunction) {
            renderItems.push({
                type: 'section_header',
                label: FUNCTION_LABELS[item.exercise_function] || item.exercise_function.toUpperCase(),
            })
            lastFunction = item.exercise_function
        }

        if (item.item_type === 'note') {
            renderItems.push({ type: 'note', item })
        } else if (item.item_type === 'superset') {
            const children = (childrenByParent.get(item.id) || []).sort((a, b) => a.order_index - b.order_index)
            renderItems.push({ type: 'superset', item, children })
        } else {
            renderItems.push({ type: 'exercise', item })
        }
    }

    const formattedDate = detail.startedAt
        ? new Date(detail.startedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
        : null

    return (
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
            {/* Header */}
            <div className="mb-3">
                <h3 className="text-sm font-bold text-[#1D1D1F] dark:text-k-text-primary">{detail.workoutName}</h3>
                <p className="text-[11px] text-[#86868B] dark:text-k-text-quaternary">
                    {detail.programName}
                    {formattedDate && <> · {formattedDate}</>}
                </p>
            </div>

            {/* Items */}
            {renderItems.map((entry, idx) => {
                if (entry.type === 'section_header') {
                    return (
                        <div key={`hdr-${idx}`} className="pt-3 pb-1">
                            <span className="text-[10px] font-bold tracking-widest text-[#AEAEB2] dark:text-k-text-quaternary">
                                {entry.label}
                            </span>
                        </div>
                    )
                }

                if (entry.type === 'note') {
                    return (
                        <div key={entry.item.id} className="flex items-start gap-2 rounded-lg bg-violet-500/5 dark:bg-violet-500/10 px-3 py-2.5 mb-1">
                            <StickyNote size={12} className="text-violet-400 mt-0.5 shrink-0" />
                            <span className="text-xs text-[#6E6E73] dark:text-k-text-tertiary leading-relaxed">{entry.item.notes}</span>
                        </div>
                    )
                }

                if (entry.type === 'superset') {
                    return (
                        <div key={entry.item.id} className="rounded-xl border border-violet-200 dark:border-violet-500/20 bg-violet-50/50 dark:bg-violet-500/5 p-3 mb-1.5 space-y-2">
                            <div className="flex items-center gap-2 mb-1">
                                <div className="flex items-center gap-1 px-2 py-0.5 bg-violet-100 dark:bg-violet-500/15 rounded">
                                    <Repeat size={10} className="text-violet-600 dark:text-violet-400" />
                                    <span className="text-[10px] font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider">Superset</span>
                                </div>
                                {entry.item.rest_seconds && (
                                    <div className="flex items-center gap-1 text-[10px] text-violet-500 dark:text-violet-400/70">
                                        <Clock size={10} />
                                        <span>{entry.item.rest_seconds}s entre rodadas</span>
                                    </div>
                                )}
                            </div>
                            {entry.children.map((child, cIdx) => (
                                <ExerciseRow key={child.id} item={child} compact />
                            ))}
                        </div>
                    )
                }

                return <ExerciseRow key={entry.item.id} item={entry.item} />
            })}
        </div>
    )
}

function ExerciseRow({ item, compact }: { item: PastWorkoutItem; compact?: boolean }) {
    return (
        <div className={`${compact ? 'py-1.5' : 'rounded-lg bg-white dark:bg-surface-card border border-[#F0F0F2] dark:border-k-border-subtle px-3 py-2.5 mb-1.5'}`}>
            <div className="flex items-baseline justify-between gap-2">
                <span className={`font-semibold text-[#1D1D1F] dark:text-k-text-primary ${compact ? 'text-xs' : 'text-[13px]'}`}>
                    {item.exercise_name || 'Exercício'}
                </span>
                <span className="text-[11px] text-[#86868B] dark:text-k-text-quaternary tabular-nums whitespace-nowrap shrink-0">
                    {item.sets && item.reps ? `${item.sets} × ${item.reps}` : '—'}
                </span>
            </div>
            {(item.rest_seconds || item.notes) && (
                <div className="flex items-center gap-3 mt-0.5">
                    {item.rest_seconds && (
                        <span className="text-[10px] text-[#AEAEB2] dark:text-k-text-quaternary">{item.rest_seconds}s descanso</span>
                    )}
                    {item.notes && (
                        <span className="flex items-center gap-1 text-[10px] text-violet-500 dark:text-violet-400 truncate">
                            <MessageSquare size={9} className="shrink-0" />
                            {item.notes}
                        </span>
                    )}
                </div>
            )}
        </div>
    )
}
