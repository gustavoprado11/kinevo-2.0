'use client'

import { useMemo, useCallback } from 'react'
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core'
import {
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { motion } from 'framer-motion'
import { GripVertical, X, Settings2 } from 'lucide-react'
import {
    useDashboardLayoutStore,
    WIDGET_REGISTRY,
    type WidgetId,
    type WidgetPlacement,
} from '@/stores/dashboard-layout-store'

// ── Types ──

interface WidgetGridProps {
    /** Map widget ID → React node to render */
    widgetMap: Partial<Record<WidgetId, React.ReactNode>>
}

// ── Sortable Widget Wrapper ──

function SortableWidget({
    placement,
    children,
    isCustomizing,
    onRemove,
}: {
    placement: WidgetPlacement
    children: React.ReactNode
    isCustomizing: boolean
    onRemove?: () => void
}) {
    const config = WIDGET_REGISTRY[placement.id]
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: placement.id, disabled: !isCustomizing })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : undefined,
    }

    // Size classes for grid placement
    const sizeClass = config.size === 'full'
        ? 'col-span-full'
        : config.size === 'half'
            ? 'col-span-full lg:col-span-1'
            : 'col-span-full lg:col-span-1 xl:col-span-1'

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`${sizeClass} relative ${isDragging ? 'opacity-80 scale-[1.01]' : ''} transition-transform`}
        >
            {/* Customizing overlay */}
            {isCustomizing && (
                <div className="absolute inset-0 z-10 rounded-xl border-2 border-dashed border-[#007AFF]/30 dark:border-primary/30 pointer-events-none" />
            )}

            {/* Drag handle + remove button */}
            {isCustomizing && (
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1">
                    <button
                        {...attributes}
                        {...listeners}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white dark:bg-surface-card border border-[#D2D2D7] dark:border-k-border-primary shadow-md text-[10px] font-medium text-[#6E6E73] dark:text-k-text-secondary hover:bg-[#F5F5F7] dark:hover:bg-muted cursor-grab active:cursor-grabbing transition-colors"
                    >
                        <GripVertical className="w-3 h-3" />
                        {config.label}
                    </button>
                    {config.removable && onRemove && (
                        <button
                            onClick={onRemove}
                            className="p-1 rounded-full bg-white dark:bg-surface-card border border-[#D2D2D7] dark:border-k-border-primary shadow-md text-[#AEAEB2] dark:text-k-text-quaternary hover:text-red-500 hover:border-red-200 dark:hover:border-red-500/30 transition-colors"
                            title={`Remover ${config.label}`}
                        >
                            <X className="w-3 h-3" />
                        </button>
                    )}
                </div>
            )}

            {children}
        </div>
    )
}

// ── Widget Grid ──

export function WidgetGrid({ widgetMap }: WidgetGridProps) {
    const { widgets, isCustomizing, reorderWidgets, removeWidget, setCustomizing } =
        useDashboardLayoutStore()

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    )

    const sortedWidgets = useMemo(
        () => [...widgets].sort((a, b) => a.order - b.order),
        [widgets]
    )

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event
        if (over && active.id !== over.id) {
            reorderWidgets(active.id as string, over.id as string)
        }
    }, [reorderWidgets])

    // Pair up consecutive "half" widgets for the 2-column grid rows
    const renderItems = useMemo(() => {
        const items: Array<{ type: 'full' | 'pair'; widgets: WidgetPlacement[] }> = []
        let i = 0
        while (i < sortedWidgets.length) {
            const current = sortedWidgets[i]
            const config = WIDGET_REGISTRY[current.id]
            if (config.size === 'half' && i + 1 < sortedWidgets.length) {
                const next = sortedWidgets[i + 1]
                const nextConfig = WIDGET_REGISTRY[next.id]
                if (nextConfig.size === 'half') {
                    items.push({ type: 'pair', widgets: [current, next] })
                    i += 2
                    continue
                }
            }
            items.push({ type: config.size === 'full' ? 'full' : 'pair', widgets: [current] })
            i++
        }
        return items
    }, [sortedWidgets])

    return (
        <div className="relative">
            {/* Customize toggle button */}
            <div className="flex justify-end mb-3">
                <button
                    onClick={() => setCustomizing(!isCustomizing)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                        isCustomizing
                            ? 'bg-[#007AFF] text-white shadow-md hover:bg-[#0056B3]'
                            : 'text-[#AEAEB2] dark:text-k-text-quaternary hover:text-[#6E6E73] dark:hover:text-k-text-secondary hover:bg-[#F5F5F7] dark:hover:bg-muted'
                    }`}
                >
                    <Settings2 className="w-3.5 h-3.5" />
                    {isCustomizing ? 'Concluir' : 'Personalizar'}
                </button>
            </div>

            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                <SortableContext
                    items={sortedWidgets.map(w => w.id)}
                    strategy={verticalListSortingStrategy}
                >
                    <div className="space-y-5">
                        {renderItems.map((item, idx) => {
                            if (item.type === 'full' || item.widgets.length === 1) {
                                const placement = item.widgets[0]
                                const content = widgetMap[placement.id]
                                if (!content) return null
                                return (
                                    <SortableWidget
                                        key={placement.id}
                                        placement={placement}
                                        isCustomizing={isCustomizing}
                                        onRemove={() => removeWidget(placement.id)}
                                    >
                                        {content}
                                    </SortableWidget>
                                )
                            }

                            // Pair of half widgets
                            return (
                                <div key={`pair-${idx}`} className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                                    {item.widgets.map(placement => {
                                        const content = widgetMap[placement.id]
                                        if (!content) return null
                                        return (
                                            <SortableWidget
                                                key={placement.id}
                                                placement={placement}
                                                isCustomizing={isCustomizing}
                                                onRemove={() => removeWidget(placement.id)}
                                            >
                                                {content}
                                            </SortableWidget>
                                        )
                                    })}
                                </div>
                            )
                        })}
                    </div>
                </SortableContext>
            </DndContext>
        </div>
    )
}
