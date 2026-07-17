'use client'

import { useRouter } from 'next/navigation'
import { Monitor, MessageCircle } from 'lucide-react'
import { useCommunicationStore } from '@/stores/communication-store'
import { NotificationBell } from '@/components/layout/notification-bell'
import { useUnreadMessagesCount } from '@/hooks/use-unread-messages-count'
import { InlineSearchBar } from '@/components/search/inline-search-bar'
import type { SearchStudent } from '@/components/search/search-results'
import { AssistantMark } from '@/components/assistant/assistant-mark'

interface DashboardHeaderProps {
    trainerName: string
    students?: SearchStudent[]
}

function getGreeting(): string {
    // No SSR este componente renderiza no servidor (UTC) e o suppressHydrationWarning
    // congela o texto — às 21h35 BRT o primeiro paint dizia "Bom dia". Fixar o fuso
    // resolve, e mantém coerência com o formatDate logo abaixo.
    const hour = Number(
        new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: 'America/Sao_Paulo' })
            .format(new Date())
    )
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

export function DashboardHeader({ trainerName, students = [] }: DashboardHeaderProps) {
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
        <div className="flex items-center justify-between mb-5">
            <div>
                <h1 className="text-[28px] font-bold tracking-[-0.02em] text-k-text-primary leading-none" suppressHydrationWarning>
                    {getGreeting()}, {firstName}
                </h1>
                <span className="text-[13px] text-k-text-tertiary mt-1.5 block" suppressHydrationWarning>{formatDate()}</span>
            </div>
            <div className="flex items-center gap-2">
                {/* Inline search bar — expands on click/⌘K, overlay so siblings stay still */}
                <InlineSearchBar students={students} />

                <NotificationBell />

                {/* Assistente button — quieto: violeta é da ação primária */}
                <button
                    onClick={handleAssistantClick}
                    className={`relative flex items-center gap-2 px-3.5 py-1.5 text-sm font-medium rounded-control transition-colors border ${
                        assistantActive
                            ? 'bg-surface-inset border-k-border-primary text-k-text-primary'
                            : 'bg-surface-card border-k-border-primary text-k-text-secondary hover:text-k-text-primary hover:bg-surface-inset'
                    }`}
                >
                    <AssistantMark className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">Assistente</span>
                </button>

                {/* Mensagens button */}
                <button
                    onClick={handleMessagesClick}
                    className={`relative flex items-center gap-2 px-3.5 py-1.5 text-sm font-medium rounded-control transition-colors border ${
                        messagesActive
                            ? 'bg-surface-inset border-k-border-primary text-k-text-primary'
                            : 'bg-surface-card border-k-border-primary text-k-text-secondary hover:text-k-text-primary hover:bg-surface-inset'
                    }`}
                >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">Mensagens</span>
                    {unreadMessagesCount > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-red-500 text-white tabular-nums">
                            {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
                        </span>
                    )}
                </button>

                {/* Sala de Treino — a ação primária da tela */}
                <button
                    data-onboarding="dashboard-training-room"
                    onClick={() => router.push('/training-room')}
                    className="flex items-center gap-2 px-4 py-1.5 bg-primary text-primary-foreground hover:opacity-90 text-sm font-semibold rounded-control transition-opacity"
                >
                    <Monitor size={16} />
                    <span className="hidden md:inline">Sala de Treino</span>
                </button>
            </div>
        </div>
    )
}
