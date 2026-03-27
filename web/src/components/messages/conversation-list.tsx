'use client'

import { useState, useEffect } from 'react'
import { Search, MessageCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getConversations } from '@/app/messages/actions'
import type { Conversation } from '@/types/messages'

function timeAgo(dateStr: string): string {
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
    if (seconds < 60) return 'agora'
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}min`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}d`
    return `${Math.floor(days / 7)}sem`
}

function getInitials(name: string): string {
    return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

interface ConversationListProps {
    conversations: Conversation[]
    selectedStudentId: string | null
    onSelect: (studentId: string) => void
    onConversationsUpdate: (conversations: Conversation[]) => void
    trainerId: string
}

export function ConversationList({
    conversations,
    selectedStudentId,
    onSelect,
    onConversationsUpdate,
    trainerId,
}: ConversationListProps) {
    const [search, setSearch] = useState('')

    // Realtime: listen for new messages to update list
    useEffect(() => {
        const supabase = createClient()

        const channel = supabase
            .channel(`messages_list_${trainerId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                },
                () => {
                    getConversations().then(onConversationsUpdate).catch(() => {})
                }
            )
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [trainerId, onConversationsUpdate])

    const filtered = search.trim()
        ? conversations.filter(c =>
            c.student.name.toLowerCase().includes(search.toLowerCase())
        )
        : conversations

    const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0)

    return (
        <>
            {/* Header */}
            <div className="px-5 pt-6 pb-4 border-b border-[#D2D2D7] dark:border-k-border-subtle">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-bold tracking-tight text-[#1D1D1F] dark:text-white">
                        Mensagens
                    </h2>
                    {totalUnread > 0 && (
                        <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold rounded-full bg-[#007AFF] dark:bg-violet-600 text-white">
                            {totalUnread > 99 ? '99+' : totalUnread}
                        </span>
                    )}
                </div>

                {/* Search */}
                <div className="relative">
                    <Search size={14} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#AEAEB2] dark:text-k-text-quaternary" />
                    <input
                        type="text"
                        placeholder="Buscar por nome..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-2.5 text-sm bg-white dark:bg-glass-bg rounded-lg border border-[#D2D2D7] dark:border-k-border-subtle text-[#1D1D1F] dark:text-k-text-primary placeholder:text-[#AEAEB2] dark:placeholder:text-k-text-quaternary outline-none focus:border-[#007AFF] dark:focus:border-violet-500/40 focus:ring-1 focus:ring-[#007AFF]/20 dark:focus:ring-violet-500/10 transition-all"
                    />
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
                {filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-4">
                        <div className="w-12 h-12 rounded-full bg-[#F5F5F7] dark:bg-glass-bg border border-[#E8E8ED] dark:border-k-border-subtle flex items-center justify-center mb-3">
                            <MessageCircle size={18} strokeWidth={1.5} className="text-[#86868B] dark:text-k-text-quaternary" />
                        </div>
                        <p className="text-xs text-[#86868B] dark:text-k-text-quaternary text-center">
                            {search ? 'Nenhum aluno encontrado.' : 'Nenhum aluno ativo.'}
                        </p>
                    </div>
                ) : (
                    filtered.map(conv => {
                        const isSelected = conv.student.id === selectedStudentId
                        const hasUnread = conv.unreadCount > 0
                        const hasMessages = conv.lastMessage !== null
                        const preview = !hasMessages
                            ? null
                            : conv.lastMessage!.image_url && !conv.lastMessage!.content
                                ? 'Enviou uma imagem'
                                : conv.lastMessage!.content || ''

                        return (
                            <button
                                key={conv.student.id}
                                onClick={() => onSelect(conv.student.id)}
                                className={`w-full flex items-center gap-3 px-5 py-3 text-left transition-colors border-b border-[#F5F5F7] dark:border-k-border-subtle/50 last:border-b-0 ${
                                    isSelected
                                        ? 'bg-[#007AFF]/8 dark:bg-violet-600/10'
                                        : 'hover:bg-[#F5F5F7] dark:hover:bg-white/[0.03]'
                                }`}
                            >
                                {/* Avatar */}
                                <div className="relative flex-shrink-0">
                                    {conv.student.avatar_url ? (
                                        <img
                                            src={conv.student.avatar_url}
                                            alt=""
                                            className="w-10 h-10 rounded-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-10 h-10 rounded-full bg-[#F5F5F7] dark:bg-glass-bg flex items-center justify-center">
                                            <span className="text-xs font-semibold text-[#6E6E73] dark:text-k-text-quaternary">
                                                {getInitials(conv.student.name)}
                                            </span>
                                        </div>
                                    )}
                                    {hasUnread && (
                                        <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#007AFF] dark:bg-violet-500 border-2 border-white dark:border-surface-card" />
                                    )}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className={`text-sm truncate ${hasUnread ? 'font-bold text-[#1D1D1F] dark:text-white' : 'font-medium text-[#1D1D1F] dark:text-white'}`}>
                                            {conv.student.name}
                                        </span>
                                        {conv.lastMessage && (
                                            <span className="text-[10px] text-[#86868B] dark:text-k-text-quaternary flex-shrink-0">
                                                {timeAgo(conv.lastMessage.created_at)}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center justify-between gap-2 mt-0.5">
                                        {hasMessages ? (
                                            <p className={`text-xs truncate ${hasUnread ? 'text-[#1D1D1F] dark:text-foreground/80 font-medium' : 'text-[#86868B] dark:text-k-text-quaternary'}`}>
                                                {conv.lastMessage!.sender_type === 'trainer' && (
                                                    <span className="text-[#AEAEB2] dark:text-k-text-quaternary/60">Você: </span>
                                                )}
                                                {preview}
                                            </p>
                                        ) : (
                                            <p className="text-xs text-[#AEAEB2] dark:text-k-text-quaternary/50 italic truncate">
                                                Nenhuma mensagem ainda
                                            </p>
                                        )}
                                        {hasUnread && (
                                            <span className="flex-shrink-0 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-[#007AFF] dark:bg-violet-600 text-white">
                                                {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </button>
                        )
                    })
                )}
            </div>
        </>
    )
}
