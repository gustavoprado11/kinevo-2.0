'use client'

import { useEffect, useRef } from 'react'
import { Command } from 'cmdk'
import { Search } from 'lucide-react'
import { SearchResults, type SearchStudent } from './search-results'
import { useSearchStore } from '@/stores/search-store'

interface InlineSearchBarProps {
    students?: SearchStudent[]
}

// Tuning knobs — keep in one place
const CLOSED_WIDTH = 160  // visual width of the resting bar
const OPEN_WIDTH = 420    // how wide the expanded bar grows to the left

/**
 * Header search bar that expands inline when clicked. The closed bar occupies
 * a fixed 160px slot in the header flow; when opened, the expanded bar floats
 * in `position: absolute` over the adjacent buttons, growing to the left so
 * nothing around it moves. No backdrop, no centered modal.
 *
 * Registers itself with the search store on mount so the global
 * CommandPalette modal steps aside and ⌘K opens this bar instead.
 */
export function InlineSearchBar({ students = [] }: InlineSearchBarProps) {
    const isOpen = useSearchStore(s => s.isInlineOpen)
    const openInline = useSearchStore(s => s.openInline)
    const closeInline = useSearchStore(s => s.closeInline)
    const toggleInline = useSearchStore(s => s.toggleInline)
    const registerInlineSearch = useSearchStore(s => s.registerInlineSearch)
    const unregisterInlineSearch = useSearchStore(s => s.unregisterInlineSearch)

    const slotRef = useRef<HTMLDivElement>(null)
    const expandedRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    // Tell the modal palette to stand down while this inline bar is mounted.
    useEffect(() => {
        registerInlineSearch()
        return () => unregisterInlineSearch()
    }, [registerInlineSearch, unregisterInlineSearch])

    // ⌘K / Ctrl+K opens (or toggles) the inline bar.
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                toggleInline()
                requestAnimationFrame(() => inputRef.current?.focus())
            }
        }
        document.addEventListener('keydown', onKeyDown)
        return () => document.removeEventListener('keydown', onKeyDown)
    }, [toggleInline])

    // Close on Escape.
    useEffect(() => {
        if (!isOpen) return
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault()
                closeInline()
                inputRef.current?.blur()
            }
        }
        document.addEventListener('keydown', onKeyDown)
        return () => document.removeEventListener('keydown', onKeyDown)
    }, [isOpen, closeInline])

    // Close when clicking outside the expanded panel.
    useEffect(() => {
        if (!isOpen) return
        const onPointerDown = (e: PointerEvent) => {
            const target = e.target as Node
            if (expandedRef.current?.contains(target)) return
            if (slotRef.current?.contains(target)) return
            closeInline()
        }
        document.addEventListener('pointerdown', onPointerDown)
        return () => document.removeEventListener('pointerdown', onPointerDown)
    }, [isOpen, closeInline])

    return (
        <div
            ref={slotRef}
            style={{ width: CLOSED_WIDTH }}
            className="relative shrink-0 h-[30px]"
        >
            {/* Closed state — plain button-like element, no cmdk input in DOM.
                Hidden (not unmounted) when open so there's nothing behind the
                expanded panel. */}
            <button
                type="button"
                onClick={() => {
                    openInline()
                    requestAnimationFrame(() => inputRef.current?.focus())
                }}
                aria-label="Abrir busca"
                className={`absolute inset-0 flex items-center gap-2 px-3 py-1.5 border text-sm rounded-xl bg-white dark:bg-surface-card border-[#D2D2D7] dark:border-k-border-primary text-[#86868B] dark:text-k-text-quaternary hover:border-[#AEAEB2] dark:hover:border-k-border-primary hover:text-[#1D1D1F] dark:hover:text-k-text-primary transition-[opacity,color,border-color] duration-150 ${
                    isOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'
                }`}
            >
                <Search className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span className="flex-1 min-w-0 text-left truncate">Buscar</span>
                <kbd className="shrink-0 text-[10px] bg-[#F5F5F7] dark:bg-glass-bg px-1.5 py-0.5 rounded font-mono">
                    ⌘K
                </kbd>
            </button>

            {/* Expanded state — anchored to the right edge of the closed slot,
                grows to the left. Uses `position: absolute` so it paints on top
                of whatever is immediately to the left (the page heading area)
                without pushing the sibling buttons on the right. */}
            <div
                ref={expandedRef}
                style={{
                    width: isOpen ? OPEN_WIDTH : CLOSED_WIDTH,
                    right: 0,
                }}
                className={`absolute top-0 transition-[width,opacity] duration-200 ease-out ${
                    isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                }`}
            >
                <Command label="Busca global" shouldFilter>
                    <div className="flex items-center gap-2 px-3 py-1.5 h-[30px] bg-white dark:bg-surface-card border border-[#AEAEB2] dark:border-k-border-primary rounded-xl shadow-sm">
                        <Search
                            className="w-3.5 h-3.5 shrink-0 text-[#1D1D1F] dark:text-k-text-primary"
                            aria-hidden="true"
                        />
                        <Command.Input
                            ref={inputRef}
                            placeholder="Buscar alunos, ações, páginas..."
                            className="flex-1 min-w-0 text-sm bg-transparent outline-none text-[#1D1D1F] dark:text-k-text-primary placeholder:text-[#86868B] dark:placeholder:text-k-text-quaternary"
                            tabIndex={isOpen ? 0 : -1}
                        />
                        <kbd className="shrink-0 text-[10px] text-[#AEAEB2] dark:text-k-text-quaternary bg-[#F5F5F7] dark:bg-glass-bg px-1.5 py-0.5 rounded font-mono">
                            ESC
                        </kbd>
                    </div>

                    {/* Dropdown */}
                    {isOpen && (
                        <div
                            role="dialog"
                            aria-label="Resultados de busca"
                            className="absolute right-0 left-0 top-[calc(100%+6px)] z-float bg-white dark:bg-surface-card border border-[#D2D2D7] dark:border-k-border-primary rounded-2xl shadow-2xl overflow-hidden animate-[fadeSlide_150ms_ease-out]"
                        >
                            <SearchResults students={students} onSelect={closeInline} />

                            <div className="flex items-center gap-4 border-t border-[#E8E8ED] dark:border-k-border-subtle px-4 py-2">
                                <span className="text-[10px] text-[#AEAEB2] dark:text-k-text-quaternary flex items-center gap-1">
                                    <kbd className="bg-[#F5F5F7] dark:bg-glass-bg px-1 py-0.5 rounded font-mono text-[9px]">↑↓</kbd>
                                    navegar
                                </span>
                                <span className="text-[10px] text-[#AEAEB2] dark:text-k-text-quaternary flex items-center gap-1">
                                    <kbd className="bg-[#F5F5F7] dark:bg-glass-bg px-1 py-0.5 rounded font-mono text-[9px]">↵</kbd>
                                    selecionar
                                </span>
                                <span className="text-[10px] text-[#AEAEB2] dark:text-k-text-quaternary flex items-center gap-1">
                                    <kbd className="bg-[#F5F5F7] dark:bg-glass-bg px-1 py-0.5 rounded font-mono text-[9px]">⌘K</kbd>
                                    abrir/fechar
                                </span>
                            </div>
                        </div>
                    )}
                </Command>
            </div>
        </div>
    )
}
