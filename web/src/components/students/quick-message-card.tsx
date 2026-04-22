'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Send, Loader2, Check, MessageCircle } from 'lucide-react'
import { sendMessage } from '@/app/messages/actions'

interface QuickSuggestion {
    emoji: string
    label: string
    message: string
}

interface QuickMessageCardProps {
    studentId: string
    studentName: string
    suggestions?: QuickSuggestion[]
    /**
     * Callback disparado ao clicar em "Ver conversa". Se não for passado,
     * o link fica oculto. A versão antiga do componente fazia
     * `router.push('/messages?student=...')` — agora preferimos abrir o
     * painel lateral sem sair da página, então o parent controla.
     */
    onOpenThread?: () => void
}

export function QuickMessageCard({ studentId, studentName, suggestions = [], onOpenThread }: QuickMessageCardProps) {
    const [text, setText] = useState('')
    const [isSending, setIsSending] = useState(false)
    const [showSuccess, setShowSuccess] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    // Auto-resize textarea
    useEffect(() => {
        const el = textareaRef.current
        if (!el) return
        el.style.height = 'auto'
        el.style.height = Math.min(el.scrollHeight, 80) + 'px'
    }, [text])

    const handleSubmit = useCallback(async () => {
        const trimmed = text.trim()
        if (!trimmed || isSending) return

        setIsSending(true)
        setError(null)

        const formData = new FormData()
        formData.set('content', trimmed)

        const result = await sendMessage(studentId, formData)

        setIsSending(false)

        if (result.success) {
            setText('')
            setShowSuccess(true)
            setTimeout(() => setShowSuccess(false), 2000)
        } else {
            setError(result.error || 'Erro ao enviar.')
        }
    }, [text, isSending, studentId])

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSubmit()
        }
    }

    const firstName = studentName.split(' ')[0]

    return (
        <div className="bg-white dark:bg-glass-bg backdrop-blur-md rounded-2xl border border-transparent dark:border-k-border-primary shadow-sm dark:shadow-none p-6">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-[#1C1C1E] dark:text-white flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 text-blue-500" />
                    Mensagem Rápida
                </h3>
                {onOpenThread && (
                    <button
                        onClick={onOpenThread}
                        className="text-[10px] font-bold text-[#007AFF] dark:text-violet-400 hover:underline"
                    >
                        Ver conversa
                    </button>
                )}
            </div>

            {/* Success feedback */}
            {showSuccess && (
                <div className="flex items-center gap-2 px-3 py-2 mb-3 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Mensagem enviada!</span>
                </div>
            )}

            {/* Error feedback */}
            {error && (
                <p className="text-red-500 text-[10px] mb-2">{error}</p>
            )}

            {/* Quick suggestions */}
            {suggestions.length > 0 && !text && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                    {suggestions.slice(0, 3).map((s, i) => (
                        <button
                            key={i}
                            onClick={() => setText(s.message)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#F5F5F7] dark:bg-white/5 hover:bg-[#E8E8ED] dark:hover:bg-white/10 text-[11px] font-medium text-[#6E6E73] dark:text-k-text-tertiary transition-colors"
                        >
                            <span>{s.emoji}</span>
                            <span>{s.label}</span>
                        </button>
                    ))}
                </div>
            )}

            {/* Input area */}
            <div className="flex items-end gap-2">
                <textarea
                    ref={textareaRef}
                    value={text}
                    onChange={e => { setText(e.target.value); setError(null) }}
                    onKeyDown={handleKeyDown}
                    placeholder={`Enviar mensagem para ${firstName}...`}
                    rows={1}
                    className="flex-1 resize-none bg-[#F5F5F7] dark:bg-surface-inset rounded-xl px-3.5 py-2 text-sm text-[#1D1D1F] dark:text-k-text-primary placeholder-[#AEAEB2] dark:placeholder-k-text-quaternary outline-none focus:ring-1 focus:ring-[#007AFF]/20 dark:focus:ring-violet-500/20 max-h-[80px]"
                />
                <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!text.trim() || isSending}
                    className="p-2 rounded-full bg-[#007AFF] dark:bg-violet-600 text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#0066D6] dark:hover:bg-violet-500 transition-colors flex-shrink-0"
                >
                    {isSending ? (
                        <Loader2 size={16} className="animate-spin" />
                    ) : (
                        <Send size={16} strokeWidth={1.5} />
                    )}
                </button>
            </div>
            <p className="text-[10px] text-[#AEAEB2] dark:text-k-text-quaternary mt-1.5">
                Enter para enviar, Shift+Enter para nova linha
            </p>
        </div>
    )
}
