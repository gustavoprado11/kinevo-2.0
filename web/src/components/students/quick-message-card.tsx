'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Send, Loader2, Check } from 'lucide-react'
import { sendMessage } from '@/app/messages/actions'
import { AssistantMark } from '@/components/assistant/assistant-mark'

// Sem emoji: sugestões são texto puro (regra da UI — ícones são Lucide,
// emoji nunca).
interface QuickSuggestion {
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
        <div className="bg-surface-card rounded-panel border border-k-border-subtle p-5">
            <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.1em] text-k-text-tertiary">
                    Mensagem rápida
                </span>
                {onOpenThread && (
                    <button
                        onClick={onOpenThread}
                        className="text-[11px] font-semibold text-primary hover:opacity-80 transition-opacity"
                    >
                        Ver conversa
                    </button>
                )}
            </div>

            {/* Success feedback */}
            {showSuccess && (
                <div className="flex items-center gap-1.5 mb-3">
                    <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Mensagem enviada</span>
                </div>
            )}

            {/* Error feedback */}
            {error && (
                <p className="text-red-500 text-[11px] mb-2">{error}</p>
            )}

            {/* Quick suggestions — a primeira é a frase pronta contextual do
                assistente (citação); as demais são chips de texto quietos. */}
            {suggestions.length > 0 && !text && (
                <div className="flex flex-col gap-2 mb-3">
                    <button
                        type="button"
                        onClick={() => setText(suggestions[0].message)}
                        className="w-full text-left px-3 py-2 rounded-control border border-k-border-subtle bg-surface-primary text-[12.5px] text-k-text-secondary hover:bg-surface-inset transition-colors flex items-start gap-2"
                        data-testid="featured-suggestion"
                    >
                        <AssistantMark className="w-3.5 h-3.5 mt-0.5 shrink-0 text-k-text-tertiary" aria-hidden="true" />
                        <span className="italic">&ldquo;{suggestions[0].message}&rdquo;</span>
                    </button>
                    {suggestions.length > 1 && (
                        <div className="flex flex-wrap gap-1.5">
                            {suggestions.slice(1, 3).map((s, i) => (
                                <button
                                    key={i}
                                    onClick={() => setText(s.message)}
                                    className="px-2.5 py-1.5 rounded-control border border-k-border-primary text-[11px] font-medium text-k-text-secondary hover:bg-surface-inset hover:text-k-text-primary transition-colors"
                                >
                                    {s.label}
                                </button>
                            ))}
                        </div>
                    )}
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
                    className="flex-1 resize-none bg-surface-inset rounded-control px-3.5 py-2 text-sm text-k-text-primary placeholder-k-text-quaternary outline-none focus:ring-1 focus:ring-ring/25 max-h-[80px]"
                />
                <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!text.trim() || isSending}
                    aria-label="Enviar mensagem"
                    className="p-2 rounded-control border border-k-border-primary text-k-text-secondary hover:bg-surface-inset hover:text-k-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                >
                    {isSending ? (
                        <Loader2 size={15} className="animate-spin" />
                    ) : (
                        <Send size={15} strokeWidth={1.5} />
                    )}
                </button>
            </div>
            <p className="text-[10px] text-k-text-quaternary mt-1.5">
                Enter para enviar, Shift+Enter para nova linha
            </p>
        </div>
    )
}
