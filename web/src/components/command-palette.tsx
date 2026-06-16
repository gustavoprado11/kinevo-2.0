'use client'

import { useState, useEffect } from 'react'
import { Command } from 'cmdk'
import { Search, Sparkles, ArrowRight } from 'lucide-react'
import { SearchResults, type SearchStudent } from '@/components/search/search-results'
import { useSearchStore } from '@/stores/search-store'
import { CommandBar, fetchAiAccess, OPEN_AI_COMMAND_EVENT, type AiAccess } from '@/components/assistant/command-bar/command-bar'

// ── Types ──

interface CommandPaletteProps {
    students?: SearchStudent[]
}

// ── Component ──

export function CommandPalette({ students = [] }: CommandPaletteProps) {
    const [open, setOpen] = useState(false)
    // ── IA: barra de comando ⌘K (Trilha 1). Gated por tier Pro+. ──
    const [aiAccess, setAiAccess] = useState<AiAccess | null>(null)
    const [aiOpen, setAiOpen] = useState(false)
    const [aiQuery, setAiQuery] = useState('')
    const [aiInput, setAiInput] = useState('')

    const aiAllowed = aiAccess?.allowed ?? false

    // Carrega o acesso à superfície de IA uma vez (decide se mostra o campo de IA).
    useEffect(() => {
        let active = true
        fetchAiAccess().then((a) => {
            if (active && a) setAiAccess(a)
        })
        return () => {
            active = false
        }
    }, [])

    // Abre a barra de IA por evento global (item "Assistente" da sidebar).
    useEffect(() => {
        const onOpen = () => {
            if (!aiAllowed) return
            setAiQuery('')
            setAiInput('')
            setOpen(false)
            setAiOpen(true)
        }
        window.addEventListener(OPEN_AI_COMMAND_EVENT, onOpen)
        return () => window.removeEventListener(OPEN_AI_COMMAND_EVENT, onOpen)
    }, [aiAllowed])

    const launchAi = (query: string) => {
        setAiQuery(query)
        setOpen(false)
        setAiOpen(true)
    }

    // Toggle ⌘K / Ctrl+K — but stand down if an inline search bar is mounted on
    // the current page; it will handle the shortcut itself.
    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                if (useSearchStore.getState().inlineSearchMounted) return
                e.preventDefault()
                setOpen(o => !o)
            }
        }
        document.addEventListener('keydown', down)
        return () => document.removeEventListener('keydown', down)
    }, [])

    // Close on Escape
    useEffect(() => {
        if (!open) return
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false)
        }
        document.addEventListener('keydown', handleEsc)
        return () => document.removeEventListener('keydown', handleEsc)
    }, [open])

    return (
        <>
            {/* Barra de comando de IA (⌘K · Trilha 1) — gated por tier Pro+. */}
            <CommandBar
                open={aiOpen}
                onClose={() => setAiOpen(false)}
                initialQuery={aiQuery}
                access={aiAccess}
            />

            {open && (
                <div className="fixed inset-0 z-float" role="dialog" aria-modal="true" aria-label="Busca global">
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={() => setOpen(false)}
                        aria-hidden="true"
                    />

                    {/* Dialog */}
                    <div className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-lg">
                        <div
                            className="bg-white dark:bg-surface-card border border-[#D2D2D7] dark:border-k-border-primary rounded-2xl shadow-2xl overflow-hidden"
                        >
                            {/* Campo de IA — só aparece nos planos Pro+. Enter roteia para a barra de comando. */}
                            {aiAllowed && (
                                <div className="flex items-center gap-3 px-4 border-b border-[#E8E8ED] dark:border-k-border-subtle">
                                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] bg-gradient-to-br from-[#7C3AED] to-[#A78BFA] text-white">
                                        <Sparkles className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
                                    </span>
                                    <input
                                        value={aiInput}
                                        onChange={(e) => setAiInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && aiInput.trim().length > 0) {
                                                e.preventDefault()
                                                launchAi(aiInput.trim())
                                                setAiInput('')
                                            }
                                        }}
                                        placeholder="Pedir à IA para agir nesta tela…"
                                        className="flex-1 py-3.5 text-sm text-[#1D1D1F] dark:text-k-text-primary bg-transparent outline-none placeholder:text-[#AEAEB2] dark:placeholder:text-k-text-quaternary"
                                        aria-label="Pedir à IA para agir nesta tela"
                                    />
                                    {aiInput.trim().length > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                launchAi(aiInput.trim())
                                                setAiInput('')
                                            }}
                                            className="inline-flex items-center gap-1 rounded-lg bg-[#7C3AED] px-2.5 py-1.5 text-xs font-bold text-white"
                                        >
                                            Agir
                                            <ArrowRight className="h-3 w-3" strokeWidth={2.5} />
                                        </button>
                                    )}
                                </div>
                            )}

                    <Command label="Busca global">
                        {/* Input */}
                        <div className="flex items-center gap-3 px-4 border-b border-[#E8E8ED] dark:border-k-border-subtle" role="search">
                            <Search className="w-4 h-4 text-[#AEAEB2] dark:text-k-text-quaternary shrink-0" aria-hidden="true" />
                            <Command.Input
                                placeholder="Buscar alunos, ações, páginas..."
                                className="flex-1 py-3.5 text-sm text-[#1D1D1F] dark:text-k-text-primary bg-transparent outline-none placeholder:text-[#AEAEB2] dark:placeholder:text-k-text-quaternary"
                                autoFocus
                            />
                            <kbd className="text-[10px] text-[#AEAEB2] dark:text-k-text-quaternary bg-[#F5F5F7] dark:bg-glass-bg px-1.5 py-0.5 rounded font-mono">
                                ESC
                            </kbd>
                        </div>

                        <SearchResults students={students} onSelect={() => setOpen(false)} />

                        {/* Footer hints */}
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
                            </Command>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
