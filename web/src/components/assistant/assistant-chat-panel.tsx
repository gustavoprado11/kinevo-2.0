'use client'

import { useState, useEffect, useRef, useMemo, useId, useCallback } from 'react'
import { useChat } from 'ai/react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Sparkles, X, Send, User, ExternalLink, MessageCircle,
    Bot, ArrowLeft, Check, CheckCheck, Loader2, Image as ImageIcon,
} from 'lucide-react'
import Link from 'next/link'
import { useAssistantChatStore } from '@/stores/assistant-chat-store'
import { createClient } from '@/lib/supabase/client'
import { getConversations, getMessages, sendMessage, markMessagesAsRead } from '@/app/messages/actions'
import type { Conversation } from '@/types/messages'
import type { Message } from '@/types/messages'

// ═══════════════════════════════════════════════════
// SHARED HELPERS
// ═══════════════════════════════════════════════════

const INSIGHT_CHIPS: Record<string, string[]> = {
    gap_alert: ['Sugerir mensagem de follow-up', 'Analisar histórico do aluno'],
    stagnation: ['Sugerir nova carga', 'Analisar tendência de progressão'],
    ready_to_progress: ['Sugerir aumento de carga', 'Analisar tendência de progressão'],
    program_expiring: ['Analisar progresso do programa', 'Sugerir próximo programa'],
    pain_report: ['Analisar relatório de dor', 'Sugerir ajustes no programa'],
}

function getChipsForInsight(insightId: string | null): string[] {
    if (!insightId) return []
    for (const key of Object.keys(INSIGHT_CHIPS)) {
        if (insightId.startsWith(key)) return INSIGHT_CHIPS[key]
    }
    return []
}

function renderMarkdown(text: string): string {
    return text
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-violet-500 underline underline-offset-2 hover:text-violet-400">$1</a>')
        .replace(/^- (.+)$/gm, '<li>$1</li>')
        .replace(/(<li>.*<\/li>\n?)+/g, '<ul class="list-disc pl-4 space-y-0.5">$&</ul>')
        .replace(/\n/g, '<br/>')
}

function extractReviewLink(content: string): { url: string; label: string } | null {
    const match = content.match(/\[([^\]]+)\]\((\/students\/[^)]+review=[^)]+)\)/)
    if (match) return { label: match[1], url: match[2] }
    const rawMatch = content.match(/(\/students\/\S*review=\S+)/)
    if (rawMatch) return { label: 'Revisar programa', url: rawMatch[1] }
    return null
}

function formatRelativeTime(dateStr: string): string {
    const now = Date.now()
    const diff = now - new Date(dateStr).getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 1) return 'agora'
    if (minutes < 60) return `${minutes}min`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}d`
    return `${Math.floor(days / 7)}sem`
}

function formatTime(dateStr: string): string {
    return new Date(dateStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

// ═══════════════════════════════════════════════════
// ASSISTANT TAB
// ═══════════════════════════════════════════════════

function AssistantTab() {
    const { studentId, studentName, insightId, initialMessage, closeChat } = useAssistantChatStore()
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const reactId = useId()

    const initialMessages = useMemo(() => {
        if (!initialMessage) return []
        return [{ id: 'initial-0', role: 'assistant' as const, content: initialMessage }]
    }, [initialMessage])

    const { messages, input, handleInputChange, handleSubmit, isLoading, setInput } = useChat({
        api: '/api/assistant/chat',
        body: { studentId, insightId },
        initialMessages,
        id: `chat-${studentId || 'general'}-${reactId}`,
    })

    const chips = getChipsForInsight(insightId)

    const [loadingSeconds, setLoadingSeconds] = useState(0)
    useEffect(() => {
        if (!isLoading) { setLoadingSeconds(0); return }
        const interval = setInterval(() => setLoadingSeconds(s => s + 1), 1000)
        return () => clearInterval(interval)
    }, [isLoading])
    const loadingText = loadingSeconds >= 5 ? 'Gerando programa...' : loadingSeconds >= 3 ? 'Analisando dados...' : null

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    useEffect(() => {
        setTimeout(() => inputRef.current?.focus(), 300)
    }, [])

    const handleChipClick = (chipText: string) => {
        setInput(chipText)
        setTimeout(() => {
            const form = inputRef.current?.closest('form')
            form?.requestSubmit()
        }, 0)
    }

    const subtitle = studentName ? `Sobre: ${studentName}` : 'Todos os alunos'

    return (
        <>
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {messages.length === 0 && !isLoading && (
                    <div className="flex flex-col items-center justify-center h-full text-center px-6 gap-3">
                        <div className="w-12 h-12 rounded-full bg-violet-500/10 flex items-center justify-center">
                            <Sparkles className="w-6 h-6 text-violet-500" />
                        </div>
                        <p className="text-sm text-muted-foreground">
                            {studentName
                                ? `Pergunte sobre o progresso de ${studentName}`
                                : 'Pergunte sobre seus alunos, programas ou treinos'
                            }
                        </p>
                    </div>
                )}

                {messages.map((message) => (
                    <div key={message.id} className={`flex gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {message.role === 'assistant' && (
                            <div className="w-6 h-6 rounded-full bg-violet-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <Sparkles className="w-3 h-3 text-violet-500" />
                            </div>
                        )}
                        <div className={`max-w-[85%] ${message.role === 'user'
                            ? 'bg-violet-600 text-white rounded-2xl rounded-br-md px-3.5 py-2.5'
                            : 'bg-muted text-foreground rounded-2xl rounded-bl-md px-3.5 py-2.5'
                        }`}>
                            {message.role === 'assistant' ? (
                                <>
                                    <div
                                        className="text-sm leading-relaxed [&_strong]:font-semibold [&_ul]:mt-1 [&_ul]:mb-1 [&_li]:text-sm [&_br+br]:hidden [&_a]:text-violet-500 [&_a]:underline"
                                        dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
                                    />
                                    {(() => {
                                        const reviewLink = extractReviewLink(message.content)
                                        if (!reviewLink) return null
                                        return (
                                            <Link
                                                href={reviewLink.url}
                                                className="mt-2 flex items-center gap-1.5 text-xs font-medium text-violet-600 dark:text-violet-400 hover:text-violet-500 transition-colors"
                                                onClick={closeChat}
                                            >
                                                <ExternalLink className="w-3 h-3" />
                                                {reviewLink.label}
                                            </Link>
                                        )
                                    })()}
                                </>
                            ) : (
                                <p className="text-sm leading-relaxed">{message.content}</p>
                            )}
                        </div>
                        {message.role === 'user' && (
                            <div className="w-6 h-6 rounded-full bg-violet-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <User className="w-3 h-3 text-white" />
                            </div>
                        )}
                    </div>
                ))}

                {isLoading && messages[messages.length - 1]?.role === 'user' && (
                    <div className="flex gap-2 justify-start">
                        <div className="w-6 h-6 rounded-full bg-violet-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Sparkles className="w-3 h-3 text-violet-500" />
                        </div>
                        <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                            {loadingText ? (
                                <p className="text-xs text-muted-foreground animate-pulse">{loadingText}</p>
                            ) : (
                                <div className="flex gap-1">
                                    <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:0ms]" />
                                    <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:150ms]" />
                                    <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:300ms]" />
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Quick action chips */}
            {chips.length > 0 && messages.length <= 1 && (
                <div className="px-4 pb-2 flex flex-wrap gap-1.5">
                    {chips.map((chip) => (
                        <button
                            key={chip}
                            onClick={() => handleChipClick(chip)}
                            disabled={isLoading}
                            className="text-xs px-3 py-1.5 rounded-full border border-violet-200 dark:border-violet-500/30 text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-500/10 hover:bg-violet-100 dark:hover:bg-violet-500/20 transition-colors disabled:opacity-50"
                        >
                            {chip}
                        </button>
                    ))}
                </div>
            )}

            {/* Input area */}
            <div className="border-t border-border px-4 py-3">
                <form onSubmit={handleSubmit} className="flex items-center gap-2">
                    <input
                        ref={inputRef}
                        value={input}
                        onChange={handleInputChange}
                        placeholder="Pergunte sobre seus alunos..."
                        disabled={isLoading}
                        className="flex-1 px-4 py-2.5 text-sm bg-muted border border-border rounded-full outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-colors placeholder:text-muted-foreground disabled:opacity-50"
                    />
                    <button
                        type="submit"
                        disabled={isLoading || !input.trim()}
                        className="w-9 h-9 flex items-center justify-center rounded-full bg-violet-600 hover:bg-violet-500 text-white transition-colors disabled:opacity-40 disabled:hover:bg-violet-600 flex-shrink-0"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </form>
            </div>
        </>
    )
}

// ═══════════════════════════════════════════════════
// MESSAGES TAB
// ═══════════════════════════════════════════════════

function MessagesTab() {
    const { chatStudentId, chatStudentName } = useAssistantChatStore()
    const [conversations, setConversations] = useState<Conversation[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedStudent, setSelectedStudent] = useState<{ id: string; name: string } | null>(
        chatStudentId && chatStudentName ? { id: chatStudentId, name: chatStudentName } : null
    )

    // Load conversations
    useEffect(() => {
        getConversations().then(convs => {
            setConversations(convs)
            setLoading(false)
        })
    }, [])

    // Deep-link from insight
    useEffect(() => {
        if (chatStudentId && chatStudentName) {
            setSelectedStudent({ id: chatStudentId, name: chatStudentName })
        }
    }, [chatStudentId, chatStudentName])

    // Realtime new messages
    useEffect(() => {
        const supabase = createClient()
        const channel = supabase
            .channel('panel-messages')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
                getConversations().then(setConversations)
            })
            .subscribe()
        return () => { supabase.removeChannel(channel) }
    }, [])

    if (selectedStudent) {
        return (
            <InlineChat
                studentId={selectedStudent.id}
                studentName={selectedStudent.name}
                onBack={() => setSelectedStudent(null)}
            />
        )
    }

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
        )
    }

    const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0)

    return (
        <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center px-6 gap-3">
                    <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                        <MessageCircle className="w-6 h-6 text-blue-500" />
                    </div>
                    <p className="text-sm text-muted-foreground">Nenhuma conversa ainda</p>
                    <p className="text-xs text-muted-foreground/60">As mensagens dos seus alunos aparecerão aqui</p>
                </div>
            ) : (
                <div className="divide-y divide-border">
                    {conversations.map(conv => {
                        const hasMessage = !!conv.lastMessage
                        const preview = !hasMessage
                            ? null
                            : conv.lastMessage!.image_url && !conv.lastMessage!.content
                                ? 'Enviou uma imagem'
                                : conv.lastMessage!.content || ''
                        const isTrainerLast = conv.lastMessage?.sender_type === 'trainer'

                        return (
                            <button
                                key={conv.student.id}
                                onClick={() => setSelectedStudent({ id: conv.student.id, name: conv.student.name })}
                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                            >
                                {/* Avatar */}
                                <div className="relative shrink-0">
                                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                                        <span className="text-[11px] font-bold text-white">
                                            {conv.student.name.charAt(0).toUpperCase()}
                                        </span>
                                    </div>
                                    {conv.unreadCount > 0 && (
                                        <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#007AFF] text-white rounded-full text-[8px] flex items-center justify-center border-2 border-background font-bold">
                                            {conv.unreadCount}
                                        </span>
                                    )}
                                </div>
                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                        <span className={`text-sm truncate ${conv.unreadCount > 0 ? 'font-semibold text-foreground' : 'font-medium text-foreground'}`}>
                                            {conv.student.name}
                                        </span>
                                        {hasMessage && (
                                            <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                                                {formatRelativeTime(conv.lastMessage!.created_at)}
                                            </span>
                                        )}
                                    </div>
                                    {preview && (
                                        <p className={`text-xs truncate mt-0.5 ${conv.unreadCount > 0 ? 'text-foreground/80' : 'text-muted-foreground'}`}>
                                            {isTrainerLast && <span className="text-muted-foreground">Você: </span>}
                                            {preview}
                                        </p>
                                    )}
                                </div>
                            </button>
                        )
                    })}
                </div>
            )}

            {/* Link to full messages page */}
            <div className="p-3 border-t border-border">
                <Link
                    href="/messages"
                    className="flex items-center justify-center gap-2 text-xs text-[#007AFF] dark:text-violet-400 hover:opacity-80 transition-colors font-medium py-1.5"
                >
                    <ExternalLink className="w-3 h-3" />
                    Abrir mensagens completas
                </Link>
            </div>
        </div>
    )
}

// ═══════════════════════════════════════════════════
// INLINE CHAT (within the panel)
// ═══════════════════════════════════════════════════

function InlineChat({ studentId, studentName, onBack }: { studentId: string; studentName: string; onBack: () => void }) {
    const [messages, setMessages] = useState<Message[]>([])
    const [loading, setLoading] = useState(true)
    const [sending, setSending] = useState(false)
    const [inputValue, setInputValue] = useState('')
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    // Load messages
    useEffect(() => {
        getMessages(studentId).then(result => {
            setMessages(result.messages)
            setLoading(false)
            // Mark as read
            markMessagesAsRead(studentId)
        })
    }, [studentId])

    // Scroll to bottom
    useEffect(() => {
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    }, [messages])

    // Focus input
    useEffect(() => {
        setTimeout(() => inputRef.current?.focus(), 300)
    }, [])

    // Realtime messages
    useEffect(() => {
        const supabase = createClient()
        const channel = supabase
            .channel(`inline-chat-${studentId}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'messages', filter: `student_id=eq.${studentId}` },
                (payload) => {
                    const newMsg = payload.new as Message
                    setMessages(prev => {
                        if (prev.some(m => m.id === newMsg.id)) return prev
                        return [...prev, newMsg]
                    })
                    if (newMsg.sender_type === 'student') {
                        markMessagesAsRead(studentId)
                    }
                }
            )
            .subscribe()
        return () => { supabase.removeChannel(channel) }
    }, [studentId])

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault()
        const text = inputValue.trim()
        if (!text || sending) return
        setSending(true)
        setInputValue('')
        try {
            const formData = new FormData()
            formData.set('content', text)
            await sendMessage(studentId, formData)
        } finally {
            setSending(false)
        }
    }

    return (
        <>
            {/* Chat header with back button */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
                <button onClick={onBack} className="p-1 rounded-lg hover:bg-muted transition-colors">
                    <ArrowLeft className="w-4 h-4 text-muted-foreground" />
                </button>
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-white">{studentName.charAt(0).toUpperCase()}</span>
                </div>
                <span className="text-sm font-semibold text-foreground">{studentName}</span>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-[#F5F5F7] dark:bg-[#18181B]">
                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    </div>
                ) : messages.length === 0 ? (
                    <div className="text-center py-8">
                        <p className="text-xs text-muted-foreground">Nenhuma mensagem ainda</p>
                    </div>
                ) : (
                    messages.map(msg => (
                        <div key={msg.id} className={`flex ${msg.sender_type === 'trainer' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${
                                msg.sender_type === 'trainer'
                                    ? 'bg-[#007AFF] text-white rounded-br-md'
                                    : 'bg-white dark:bg-surface-card text-foreground rounded-bl-md border border-border'
                            }`}>
                                {msg.content && <p className="leading-relaxed">{msg.content}</p>}
                                {msg.image_url && (
                                    <div className="mt-1 flex items-center gap-1 text-xs opacity-70">
                                        <ImageIcon className="w-3 h-3" />
                                        Imagem
                                    </div>
                                )}
                                <div className={`flex items-center gap-1 mt-0.5 ${msg.sender_type === 'trainer' ? 'justify-end' : ''}`}>
                                    <span className={`text-[10px] ${msg.sender_type === 'trainer' ? 'text-white/60' : 'text-muted-foreground'}`}>
                                        {formatTime(msg.created_at)}
                                    </span>
                                    {msg.sender_type === 'trainer' && (
                                        msg.read_at
                                            ? <CheckCheck className="w-3 h-3 text-white/60" />
                                            : <Check className="w-3 h-3 text-white/60" />
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-border px-3 py-2.5">
                <form onSubmit={handleSend} className="flex items-center gap-2">
                    <input
                        ref={inputRef}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="Digite uma mensagem..."
                        disabled={sending}
                        className="flex-1 px-4 py-2 text-sm bg-muted border border-border rounded-full outline-none focus:border-[#007AFF]/50 focus:ring-1 focus:ring-[#007AFF]/20 transition-colors placeholder:text-muted-foreground disabled:opacity-50"
                    />
                    <button
                        type="submit"
                        disabled={sending || !inputValue.trim()}
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-[#007AFF] hover:bg-[#0066D6] text-white transition-colors disabled:opacity-40 flex-shrink-0"
                    >
                        <Send className="w-3.5 h-3.5" />
                    </button>
                </form>
            </div>
        </>
    )
}

// ═══════════════════════════════════════════════════
// MAIN PANEL (wraps tabs)
// ═══════════════════════════════════════════════════

export function AssistantChatPanel() {
    const { isOpen, activeTab, closeChat, switchTab } = useAssistantChatStore()
    const [unreadCount, setUnreadCount] = useState(0)

    // Fetch unread count
    useEffect(() => {
        if (!isOpen) return
        getConversations().then(convs => {
            setUnreadCount(convs.reduce((sum, c) => sum + c.unreadCount, 0))
        })
    }, [isOpen, activeTab])

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop — hidden on xl+ where content reflows */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-dropdown bg-black/20 backdrop-blur-sm xl:hidden"
                        onClick={closeChat}
                    />

                    {/* Panel */}
                    <motion.aside
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed right-0 top-0 z-modal flex h-full w-full max-w-[420px] flex-col border-l border-border bg-background shadow-2xl"
                    >
                        {/* Header with tabs */}
                        <header className="border-b border-border">
                            <div className="flex items-center justify-between px-4 pt-3 pb-0">
                                <h2 className="text-sm font-semibold text-foreground">Kinevo</h2>
                                <button
                                    onClick={closeChat}
                                    className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                                >
                                    <X className="w-4 h-4 text-muted-foreground" />
                                </button>
                            </div>

                            {/* Tab switcher */}
                            <div className="flex px-4 pt-2">
                                <button
                                    onClick={() => switchTab('assistant')}
                                    className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-all ${
                                        activeTab === 'assistant'
                                            ? 'border-violet-500 text-violet-600 dark:text-violet-400'
                                            : 'border-transparent text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    <Sparkles className="w-3.5 h-3.5" />
                                    Assistente
                                </button>
                                <button
                                    onClick={() => switchTab('chat')}
                                    className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-all ${
                                        activeTab === 'chat'
                                            ? 'border-[#007AFF] text-[#007AFF] dark:text-blue-400'
                                            : 'border-transparent text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    <MessageCircle className="w-3.5 h-3.5" />
                                    Mensagens
                                    {unreadCount > 0 && (
                                        <span className="w-4.5 h-4.5 bg-[#007AFF] text-white rounded-full text-[9px] flex items-center justify-center font-bold min-w-[18px] px-1">
                                            {unreadCount}
                                        </span>
                                    )}
                                </button>
                            </div>
                        </header>

                        {/* Tab content */}
                        {activeTab === 'assistant' ? <AssistantTab /> : <MessagesTab />}
                    </motion.aside>
                </>
            )}
        </AnimatePresence>
    )
}
