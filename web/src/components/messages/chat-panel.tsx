'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { ArrowLeft, Check, CheckCheck, ImageOff, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getMessages, markMessagesAsRead } from '@/app/messages/actions'
import { MessageInput } from './message-input'
import type { Message } from '@/types/messages'

function getInitials(name: string): string {
    return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

function formatTime(dateStr: string): string {
    return new Date(dateStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function formatDateSeparator(dateStr: string): string {
    const date = new Date(dateStr)
    const today = new Date()
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) return 'Hoje'
    if (date.toDateString() === yesterday.toDateString()) return 'Ontem'

    return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })
}

function shouldShowDateSeparator(messages: Message[], index: number): boolean {
    if (index === 0) return true
    const prev = new Date(messages[index - 1].created_at).toDateString()
    const curr = new Date(messages[index].created_at).toDateString()
    return prev !== curr
}

interface ChatPanelProps {
    studentId: string
    studentName: string
    studentAvatar: string | null
    onBack: () => void
}

export function ChatPanel({ studentId, studentName, studentAvatar, onBack }: ChatPanelProps) {
    const [messages, setMessages] = useState<Message[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [hasMore, setHasMore] = useState(false)
    const [isLoadingMore, setIsLoadingMore] = useState(false)
    const scrollRef = useRef<HTMLDivElement>(null)
    const bottomRef = useRef<HTMLDivElement>(null)
    const isAtBottomRef = useRef(true)

    // Load initial messages
    useEffect(() => {
        setIsLoading(true)
        setMessages([])

        getMessages(studentId).then(result => {
            setMessages(result.messages)
            setHasMore(result.hasMore)
            setIsLoading(false)
            // Mark as read
            markMessagesAsRead(studentId).catch(() => {})
            // Scroll to bottom after render
            setTimeout(() => bottomRef.current?.scrollIntoView(), 50)
        })
    }, [studentId])

    // Realtime: listen for new messages in this conversation
    useEffect(() => {
        const supabase = createClient()

        const channel = supabase
            .channel(`chat_${studentId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `student_id=eq.${studentId}`,
                },
                (payload) => {
                    const newMsg = payload.new as Message
                    setMessages(prev => {
                        if (prev.some(m => m.id === newMsg.id)) return prev
                        return [...prev, newMsg]
                    })
                    // If from student, mark as read
                    if (newMsg.sender_type === 'student') {
                        markMessagesAsRead(studentId).catch(() => {})
                    }
                    // Auto-scroll if at bottom
                    if (isAtBottomRef.current) {
                        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'messages',
                    filter: `student_id=eq.${studentId}`,
                },
                (payload) => {
                    const updated = payload.new as Message
                    setMessages(prev => prev.map(m => m.id === updated.id ? updated : m))
                }
            )
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [studentId])

    // Track scroll position
    const handleScroll = useCallback(() => {
        const el = scrollRef.current
        if (!el) return
        isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100
    }, [])

    // Load more (scroll to top)
    const loadMore = useCallback(async () => {
        if (!hasMore || isLoadingMore || messages.length === 0) return
        setIsLoadingMore(true)

        const oldestCreatedAt = messages[0].created_at
        const result = await getMessages(studentId, oldestCreatedAt)

        const el = scrollRef.current
        const prevScrollHeight = el?.scrollHeight ?? 0

        setMessages(prev => [...result.messages, ...prev])
        setHasMore(result.hasMore)
        setIsLoadingMore(false)

        // Maintain scroll position
        requestAnimationFrame(() => {
            if (el) {
                el.scrollTop = el.scrollHeight - prevScrollHeight
            }
        })
    }, [hasMore, isLoadingMore, messages, studentId])

    // Handle message sent from input
    const handleMessageSent = useCallback((msg: Message) => {
        setMessages(prev => {
            if (prev.some(m => m.id === msg.id)) return prev
            return [...prev, msg]
        })
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }, [])

    return (
        <div className="flex flex-col h-full bg-[#F5F5F7] dark:bg-[#18181B]">
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-3.5 bg-white dark:bg-surface-card border-b border-[#D2D2D7] dark:border-k-border-subtle">
                <button
                    onClick={onBack}
                    className="md:hidden p-1 -ml-1 text-[#6E6E73] dark:text-k-text-quaternary hover:text-[#1D1D1F] dark:hover:text-white"
                >
                    <ArrowLeft size={20} strokeWidth={1.5} />
                </button>

                {studentAvatar ? (
                    <img src={studentAvatar} alt="" className="w-9 h-9 rounded-full object-cover" />
                ) : (
                    <div className="w-9 h-9 rounded-full bg-[#F5F5F7] dark:bg-glass-bg flex items-center justify-center">
                        <span className="text-[10px] font-semibold text-[#6E6E73] dark:text-k-text-quaternary">
                            {getInitials(studentName)}
                        </span>
                    </div>
                )}

                <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-[#1D1D1F] dark:text-white truncate">
                        {studentName}
                    </h3>
                </div>

                <Link
                    href={`/students/${studentId}`}
                    className="text-xs font-semibold text-[#007AFF] dark:text-violet-400 hover:underline"
                >
                    Ver perfil
                </Link>
            </div>

            {/* Messages area */}
            <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto px-4 py-4 space-y-1"
            >
                {/* Load more */}
                {hasMore && (
                    <div className="flex justify-center pb-3">
                        <button
                            onClick={loadMore}
                            disabled={isLoadingMore}
                            className="text-xs text-[#007AFF] dark:text-violet-400 hover:underline disabled:opacity-50 flex items-center gap-1"
                        >
                            {isLoadingMore && <Loader2 size={12} className="animate-spin" />}
                            Carregar anteriores
                        </button>
                    </div>
                )}

                {isLoading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 size={20} className="animate-spin text-[#AEAEB2]" />
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex items-center justify-center py-16">
                        <p className="text-xs text-[#86868B] dark:text-k-text-quaternary">
                            Nenhuma mensagem ainda. Envie a primeira!
                        </p>
                    </div>
                ) : (
                    messages.map((msg, i) => (
                        <div key={msg.id}>
                            {/* Date separator */}
                            {shouldShowDateSeparator(messages, i) && (
                                <div className="flex items-center justify-center py-3">
                                    <span className="text-[10px] font-medium text-[#86868B] dark:text-k-text-quaternary bg-[#F5F5F7]/80 dark:bg-glass-bg px-3 py-1 rounded-full">
                                        {formatDateSeparator(msg.created_at)}
                                    </span>
                                </div>
                            )}

                            {/* Message bubble */}
                            <div className={`flex ${msg.sender_type === 'trainer' ? 'justify-end' : 'justify-start'} mb-1`}>
                                <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 ${
                                    msg.sender_type === 'trainer'
                                        ? 'bg-[#007AFF] dark:bg-violet-600 text-white rounded-br-md'
                                        : 'bg-white dark:bg-surface-card text-[#1D1D1F] dark:text-white rounded-bl-md shadow-sm border border-[#D2D2D7]/50 dark:border-k-border-subtle'
                                }`}>
                                    {/* Image */}
                                    {msg.image_url && (
                                        <a href={msg.image_url} target="_blank" rel="noopener noreferrer" className="block mb-1.5" data-img-container>
                                            <img
                                                src={msg.image_url}
                                                alt=""
                                                className="max-w-[280px] max-h-[200px] rounded-lg object-cover cursor-pointer"
                                                onError={(e) => {
                                                    const target = e.currentTarget
                                                    target.style.display = 'none'
                                                    const container = target.closest('[data-img-container]')
                                                    const fallback = container?.querySelector<HTMLElement>('[data-fallback="img-error"]')
                                                    if (fallback) fallback.style.display = 'flex'
                                                }}
                                            />
                                            <div data-fallback="img-error" className="hidden items-center justify-center gap-1.5 w-[200px] h-[80px] rounded-lg bg-[#F5F5F7] dark:bg-k-bg-tertiary">
                                                <ImageOff size={16} className="text-[#86868B] dark:text-k-text-quaternary" />
                                                <span className="text-[11px] text-[#86868B] dark:text-k-text-quaternary">Imagem indisponível</span>
                                            </div>
                                        </a>
                                    )}
                                    {/* Text */}
                                    {msg.content && (
                                        <p className="text-[13px] leading-relaxed whitespace-pre-wrap break-words">
                                            {msg.content}
                                        </p>
                                    )}
                                    {/* Time + read status */}
                                    <div className={`flex items-center gap-1 mt-0.5 ${
                                        msg.sender_type === 'trainer' ? 'justify-end' : 'justify-start'
                                    }`}>
                                        <span className={`text-[9px] ${
                                            msg.sender_type === 'trainer'
                                                ? 'text-white/60'
                                                : 'text-[#86868B] dark:text-k-text-quaternary'
                                        }`}>
                                            {formatTime(msg.created_at)}
                                        </span>
                                        {msg.sender_type === 'trainer' && (
                                            msg.read_at
                                                ? <CheckCheck size={12} className="text-white/80" />
                                                : <Check size={12} className="text-white/50" />
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}

                <div ref={bottomRef} />
            </div>

            {/* Input */}
            <MessageInput studentId={studentId} onMessageSent={handleMessageSent} />
        </div>
    )
}
