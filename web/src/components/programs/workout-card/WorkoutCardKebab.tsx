'use client'

import { MoreHorizontal, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

export interface WorkoutCardKebabItem {
    label: string
    icon?: LucideIcon
    onClick: () => void
    disabled?: boolean
    destructive?: boolean
    separatorAbove?: boolean
}

export interface WorkoutCardKebabProps {
    items: WorkoutCardKebabItem[]
    align?: 'start' | 'end'
}

/**
 * Kebab menu for workout cards.
 *
 * Visibility convention: the trigger is *always rendered*. The parent card
 * (a `group` container) is responsible for fading it in on hover via
 * `opacity-0 group-hover:opacity-100 focus-within:opacity-100`. Wrap this
 * component accordingly when consuming.
 *
 * The trigger and panel both call `e.stopPropagation()` so the parent card's
 * onToggle handler is not triggered when interacting with the kebab.
 */
export function WorkoutCardKebab({ items, align = 'end' }: WorkoutCardKebabProps) {
    const [open, setOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!open) return
        function onDocClick(e: MouseEvent) {
            if (!containerRef.current) return
            if (!containerRef.current.contains(e.target as Node)) setOpen(false)
        }
        function onEsc(e: KeyboardEvent) {
            if (e.key === 'Escape') setOpen(false)
        }
        document.addEventListener('mousedown', onDocClick)
        document.addEventListener('keydown', onEsc)
        return () => {
            document.removeEventListener('mousedown', onDocClick)
            document.removeEventListener('keydown', onEsc)
        }
    }, [open])

    const alignClass = align === 'end' ? 'right-0' : 'left-0'

    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation()
                    setOpen((prev) => !prev)
                }}
                className="h-7 w-7 inline-flex items-center justify-center rounded-md text-[var(--text-quaternary)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg)] transition-colors"
                aria-haspopup="menu"
                aria-expanded={open}
                title="Ações"
            >
                <MoreHorizontal className="size-4" />
            </button>
            {open && (
                <div
                    role="menu"
                    onClick={(e) => e.stopPropagation()}
                    className={`absolute ${alignClass} top-8 z-dropdown w-48 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-apple-elevated overflow-hidden py-1`}
                >
                    {items.map((item, idx) => {
                        const Icon = item.icon
                        const colorClass = item.destructive
                            ? 'text-[var(--destructive)] hover:bg-[var(--destructive)]/10'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg)]'
                        return (
                            <div key={`${item.label}-${idx}`}>
                                {item.separatorAbove && (
                                    <div className="my-1 h-px bg-[var(--border-subtle)]" role="separator" />
                                )}
                                <button
                                    type="button"
                                    role="menuitem"
                                    disabled={item.disabled}
                                    onClick={() => {
                                        if (item.disabled) return
                                        item.onClick()
                                        setOpen(false)
                                    }}
                                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs ${colorClass} disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors`}
                                >
                                    {Icon && <Icon className="size-3.5 shrink-0" />}
                                    <span className="truncate">{item.label}</span>
                                </button>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
