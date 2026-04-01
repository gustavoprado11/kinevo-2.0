'use client'

import { useRouter } from 'next/navigation'
import { Monitor, Sparkles, MessageCircle } from 'lucide-react'
import { useCommunicationStore } from '@/stores/communication-store'
import { NotificationBell } from '@/components/layout/notification-bell'
import { useUnreadMessagesCount } from '@/hooks/use-unread-messages-count'

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
    const { isOpen, activeTab, openPanel, closePanel, switchTab, openChat, unreadMessagesCount } = useCommunicationStore()
    const firstName = trainerName.split(' ')[0]

    // Initialize and keep unread count reactive via Realtime
    useUnreadMessagesCount()

    const handleAssistantClick = () => {
        if (isOpen && activeTab === 'assistant') {
            closePanel()
        } else if (isOpen) {
            switchTab('assistant')
        } else {
            openChat()
        }
    }

    const handleMessagesClick = () => {
        if (isOpen && activeTab === 'messages') {
            closePanel()
        } else if (isOpen) {
            switchTab('messages')
        } else {
            openPanel('messages')
        }
    }

    const assistantActive = isOpen && activeTab === 'assistant'
    const messagesActive = isOpen && activeTab === 'messages'

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

                {/* Assistente button */}
                <button
                    onClick={handleAssistantClick}
                    className={`relative flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-xl transition-colors border ${
                        assistantActive
                            ? 'bg-violet-100 dark:bg-violet-500/20 border-violet-300 dark:border-violet-500/40 text-violet-800 dark:text-violet-200'
                            : 'border-violet-200 dark:border-violet-500/30 bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-500/20'
                    }`}
                >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">Assistente</span>
                </button>

                {/* Mensagens button */}
                <button
                    onClick={handleMessagesClick}
                    className={`relative flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-xl transition-colors border ${
                        messagesActive
                            ? 'bg-blue-100 dark:bg-blue-500/20 border-blue-300 dark:border-blue-500/40 text-blue-800 dark:text-blue-200'
                            : 'border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-500/20'
                    }`}
                >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">Mensagens</span>
                    {unreadMessagesCount > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-red-500 text-white">
                            {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
                        </span>
                    )}
                </button>

                {/* Sala de Treino */}
                <button
                    data-onboarding="dashboard-training-room"
                    onClick={() => router.push('/training-room')}
                    className="flex items-center gap-2 px-4 py-1.5 bg-[#007AFF] dark:bg-transparent border-0 dark:border dark:border-k-border-primary text-white dark:text-k-text-secondary hover:bg-[#0066D6] dark:hover:bg-glass-bg dark:hover:text-k-text-primary text-sm font-medium rounded-xl transition-colors"
                >
                    <Monitor size={16} className="text-white dark:text-emerald-400" />
                    <span className="hidden md:inline">Sala de Treino</span>
                </button>
            </div>
        </div>
    )
}
