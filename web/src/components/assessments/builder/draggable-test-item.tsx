'use client'

import { useDraggable } from '@dnd-kit/core'
import { GripVertical } from 'lucide-react'
import type { CatalogEntry } from './test-catalog'

interface DraggableTestItemProps {
    entry: CatalogEntry
    /**
     * Click handler is provided in addition to drag, since on small viewports
     * (or for keyboard users) the catalog should still let you "add" a test.
     */
    onAdd: (entry: CatalogEntry) => void
}

/**
 * Catalog row in the TestLibraryColumn. Drag source only — drop target lives
 * in AssessmentBuilderCanvas. Falls back to a click-to-add affordance on
 * mobile/keyboard.
 */
export function DraggableTestItem({ entry, onAdd }: DraggableTestItemProps) {
    const Icon = entry.icon
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: `lib:${entry.catalogId}`,
        data: { source: 'library', catalogId: entry.catalogId },
    })

    return (
        <div
            ref={setNodeRef}
            className={`group flex items-center gap-3 rounded-xl border border-k-border-subtle bg-surface-elevated px-3 py-2.5 transition-colors hover:border-violet-500/40 hover:bg-violet-500/5 ${
                isDragging ? 'opacity-40' : ''
            }`}
        >
            <button
                type="button"
                {...listeners}
                {...attributes}
                aria-label={`Arrastar ${entry.label}`}
                className="cursor-grab text-k-text-quaternary hover:text-violet-500 active:cursor-grabbing"
            >
                <GripVertical className="h-4 w-4" />
            </button>
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-500 dark:bg-violet-500/15 dark:text-violet-400">
                <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
                <div className="text-sm font-medium leading-snug text-k-text-primary line-clamp-2">{entry.label}</div>
                <div className="mt-0.5 text-[11px] leading-snug text-k-text-tertiary line-clamp-1">{entry.description}</div>
            </div>
            <button
                type="button"
                onClick={() => onAdd(entry)}
                aria-label={`Adicionar ${entry.label}`}
                className="rounded-md px-2 py-1 text-[11px] font-medium text-violet-500 opacity-0 transition-opacity hover:bg-violet-500/10 group-hover:opacity-100 dark:text-violet-400"
            >
                + Adicionar
            </button>
        </div>
    )
}
