'use client'

import { useEffect, useState, useCallback } from 'react'
import { Keyboard, X } from 'lucide-react'

interface KeyboardShortcutsProps {
    onEditProgram?: () => void
    onCompleteProgram?: () => void
    onAssignProgram?: () => void
    onEditStudent?: () => void
    onNavigateMessages?: () => void
    hasActiveProgram: boolean
}

const SHORTCUTS = [
    { key: 'e', label: 'Editar programa', action: 'editProgram', requiresProgram: true },
    { key: 'c', label: 'Concluir programa', action: 'completeProgram', requiresProgram: true },
    { key: 'n', label: 'Novo/Atribuir programa', action: 'assignProgram', requiresProgram: false },
    { key: 'i', label: 'Editar aluno', action: 'editStudent', requiresProgram: false },
    { key: 'm', label: 'Ir para mensagens', action: 'navigateMessages', requiresProgram: false },
    { key: '?', label: 'Mostrar atalhos', action: 'showHelp', requiresProgram: false },
]

export function KeyboardShortcuts({
    onEditProgram,
    onCompleteProgram,
    onAssignProgram,
    onEditStudent,
    onNavigateMessages,
    hasActiveProgram,
}: KeyboardShortcutsProps) {
    const [showHelp, setShowHelp] = useState(false)

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        // Don't intercept when user is typing in an input
        const target = e.target as HTMLElement
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable) {
            return
        }

        // Don't intercept with modifiers (except Shift for ?)
        if (e.ctrlKey || e.metaKey || e.altKey) return

        switch (e.key.toLowerCase()) {
            case 'e':
                if (hasActiveProgram && onEditProgram) {
                    e.preventDefault()
                    onEditProgram()
                }
                break
            case 'c':
                if (hasActiveProgram && onCompleteProgram) {
                    e.preventDefault()
                    onCompleteProgram()
                }
                break
            case 'n':
                if (onAssignProgram) {
                    e.preventDefault()
                    onAssignProgram()
                }
                break
            case 'i':
                if (onEditStudent) {
                    e.preventDefault()
                    onEditStudent()
                }
                break
            case 'm':
                if (onNavigateMessages) {
                    e.preventDefault()
                    onNavigateMessages()
                }
                break
            case '?':
                e.preventDefault()
                setShowHelp(prev => !prev)
                break
            case 'escape':
                if (showHelp) {
                    e.preventDefault()
                    setShowHelp(false)
                }
                break
        }
    }, [hasActiveProgram, onEditProgram, onCompleteProgram, onAssignProgram, onEditStudent, onNavigateMessages, showHelp])

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [handleKeyDown])

    return (
        <>
            {/* Floating shortcut hint */}
            <button
                onClick={() => setShowHelp(true)}
                className="fixed bottom-6 right-6 z-10 p-2.5 rounded-xl bg-white dark:bg-surface-card border border-[#E5E5EA] dark:border-k-border-primary shadow-lg hover:shadow-xl transition-all group"
                title="Atalhos de teclado (?)"
            >
                <Keyboard className="w-4 h-4 text-[#86868B] dark:text-k-text-quaternary group-hover:text-[#1C1C1E] dark:group-hover:text-white transition-colors" />
            </button>

            {/* Shortcuts modal */}
            {showHelp && (
                <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowHelp(false)} />
                    <div className="relative bg-white dark:bg-surface-card border border-[#E5E5EA] dark:border-k-border-primary rounded-2xl shadow-2xl p-6 max-w-sm w-full animate-in zoom-in-95 fade-in duration-200">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-base font-bold text-[#1C1C1E] dark:text-white flex items-center gap-2">
                                <Keyboard className="w-5 h-5 text-violet-500" />
                                Atalhos de Teclado
                            </h3>
                            <button onClick={() => setShowHelp(false)} className="p-1.5 text-[#86868B] dark:text-k-text-quaternary hover:text-[#1C1C1E] dark:hover:text-white rounded-lg transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="space-y-2">
                            {SHORTCUTS.map(s => {
                                const disabled = s.requiresProgram && !hasActiveProgram
                                return (
                                    <div key={s.key} className={`flex items-center justify-between py-2 px-3 rounded-lg ${disabled ? 'opacity-40' : 'hover:bg-[#F5F5F7] dark:hover:bg-white/5'}`}>
                                        <span className={`text-sm ${disabled ? 'text-[#86868B] dark:text-k-text-quaternary' : 'text-[#1C1C1E] dark:text-k-text-secondary'}`}>
                                            {s.label}
                                        </span>
                                        <kbd className="px-2 py-0.5 rounded bg-[#F5F5F7] dark:bg-white/10 text-xs font-mono font-bold text-[#6E6E73] dark:text-k-text-tertiary border border-[#E5E5EA] dark:border-k-border-subtle">
                                            {s.key}
                                        </kbd>
                                    </div>
                                )
                            })}
                        </div>
                        <p className="text-[10px] text-[#AEAEB2] dark:text-k-text-quaternary mt-4 text-center">
                            Pressione <kbd className="px-1 rounded bg-[#F5F5F7] dark:bg-white/10 text-[10px] font-mono border border-[#E5E5EA] dark:border-k-border-subtle">Esc</kbd> para fechar
                        </p>
                    </div>
                </div>
            )}
        </>
    )
}
