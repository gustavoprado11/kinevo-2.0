'use client'

import { useRouter } from 'next/navigation'
import { Search, Sparkles } from 'lucide-react'
import { useAssistantChatStore } from '@/stores/assistant-chat-store'
import { NotificationBell } from '@/components/layout/notification-bell'

interface DashboardHeaderProps {
    trainerName: string
}

function getGreeting(): string {
    const hour = new Date().getHours()
    if (hour < 12) return 'Bom dia'
    if (hour < 18) return 'Boa tarde'
    return 'Boa noite'
}

function formatDate(): string {
    const raw = new Date().toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        timeZone: 'America/Sao_Paulo',
    })
    // "sábado, 7 de março" → "Sábado, 7 de março"
    return raw.replace(/^(\w)/, (_, c: string) => c.toUpperCase())
}

function openCommandPalette() {
    // Dispatch the same keyboard event that cmdk listens for
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))
}

export function DashboardHeader({ trainerName }: DashboardHeaderProps) {
    const router = useRouter()
    const openChat = useAssistantChatStore(s => s.openChat)
    const firstName = trainerName.split(' ')[0]

    return (
        <div className="flex items-center justify-between mb-5">
            <div>
                <h1 className="font-display text-[32px] font-light tracking-tight text-k-text-primary leading-none" suppressHydrationWarning>
                    {getGreeting()}, {firstName}
                </h1>
                <span className="text-[13px] text-k-text-tertiary mt-1.5 block" suppressHydrationWarning>{formatDate()}</span>
            </div>
            <div className="flex items-center gap-2">
                {/* Search / Command Palette trigger */}
                <button
                    onClick={openCommandPalette}
                    className="flex items-center gap-2 px-3 py-1.5 border border-[#D2D2D7] dark:border-k-border-primary bg-white dark:bg-surface-card text-[#86868B] dark:text-k-text-quaternary hover:text-[#1D1D1F] dark:hover:text-k-text-primary hover:border-[#AEAEB2] dark:hover:border-k-border-primary text-sm rounded-xl transition-colors"
                >
                    <Search className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Buscar</span>
                    <kbd className="hidden sm:inline text-[10px] bg-[#F5F5F7] dark:bg-glass-bg px-1.5 py-0.5 rounded font-mono ml-1">⌘K</kbd>
                </button>

                <NotificationBell />

                <button onClick={() => openChat()} className="flex items-center gap-2 px-4 py-1.5 border border-violet-200 dark:border-violet-500/30 bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-500/20 text-sm font-medium rounded-xl transition-colors">
                    <Sparkles className="w-3.5 h-3.5" />
                    Assistente
                </button>
            </div>
        </div>
    )
}
