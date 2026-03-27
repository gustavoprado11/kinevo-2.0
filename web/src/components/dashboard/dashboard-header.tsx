'use client'

import { useRouter } from 'next/navigation'
import { Monitor, Sparkles } from 'lucide-react'
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

export function DashboardHeader({ trainerName }: DashboardHeaderProps) {
    const router = useRouter()
    const openChat = useAssistantChatStore(s => s.openChat)
    const firstName = trainerName.split(' ')[0]

    return (
        <div className="flex items-center justify-between mb-6">
            <div>
                <h1 className="font-display text-[32px] font-light tracking-tight text-k-text-primary leading-none" suppressHydrationWarning>
                    {getGreeting()}, {firstName}
                </h1>
                <span className="text-[13px] text-k-text-tertiary mt-1.5 block" suppressHydrationWarning>{formatDate()}</span>
            </div>
            <div className="flex items-center gap-2">
                <NotificationBell />
                <button onClick={() => openChat()} className="flex items-center gap-2 px-4 py-1.5 border border-violet-200 dark:border-violet-500/30 bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-500/20 text-sm font-medium rounded-xl transition-colors">
                    <Sparkles className="w-3.5 h-3.5" />
                    Assistente
                </button>
                <button
                    data-onboarding="dashboard-training-room"
                    onClick={() => router.push('/training-room')}
                    className="flex items-center gap-2 px-4 py-1.5 bg-[#007AFF] dark:bg-transparent border-0 dark:border dark:border-k-border-primary text-white dark:text-k-text-secondary hover:bg-[#0066D6] dark:hover:bg-glass-bg dark:hover:text-k-text-primary text-sm font-medium rounded-xl transition-colors"
                >
                    <Monitor size={16} className="text-white dark:text-emerald-400" />
                    Sala de Treino
                </button>
            </div>
        </div>
    )
}
