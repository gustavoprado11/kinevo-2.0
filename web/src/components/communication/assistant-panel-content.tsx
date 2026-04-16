'use client'

import { useState, useEffect, useRef, useMemo, useId } from 'react'
import { useChat } from 'ai/react'
import { Sparkles, Send, User, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { useCommunicationStore } from '@/stores/communication-store'

// ── Quick action chips based on insight category ──

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

// ── Simple markdown rendering ──
// SECURITY: The LLM response can contain attacker-controlled content
// (student names, anamnese answers are echoed by the model). We MUST:
//   1. Escape all HTML entities BEFORE applying markdown transforms, so any
//      `<script>`, `<img onerror>`, `<iframe>` in the raw text is neutralized.
//   2. Validate URL schemes in [label](url) links — block `javascript:`,
//      `data:`, `vbscript:`, `file:`, etc. Allow only http(s), relative paths,
//      mailto, tel, and anchors.

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}

const SAFE_URL_RE = /^(?:https?:\/\/|mailto:|tel:|\/|#)/i

function safeUrl(rawUrl: string): string {
    const trimmed = rawUrl.trim()
    if (SAFE_URL_RE.test(trimmed)) return trimmed
    return '#'
}

function renderMarkdown(text: string): string {
    // Escape first — the only HTML in the output past this point is what we
    // explicitly insert (strong/em/a/li/ul/br). Characters like `*`, `[`, `(`
    // are not escaped so the markdown substitutions still match.
    const escaped = escapeHtml(text)
    return escaped
        .replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+?)\*/g, '<em>$1</em>')
        .replace(
            /\[([^\]]+)\]\(([^)]+)\)/g,
            (_m, label: string, url: string) =>
                `<a href="${escapeHtml(safeUrl(url))}" class="text-violet-500 underline underline-offset-2 hover:text-violet-400" target="_blank" rel="noopener noreferrer">${label}</a>`,
        )
        .replace(/^- (.+)$/gm, '<li>$1</li>')
        .replace(/(<li>.*<\/li>\n?)+/g, '<ul class="list-disc pl-4 space-y-0.5">$&</ul>')
        .replace(/\n/g, '<br/>')
}

/** Extract review links from message content for rendering as buttons.
 *  Constrained to `/students/...review=...` (relative paths) so the extracted
 *  URL is safe to pass to next/Link. */
function extractReviewLink(content: string): { url: string; label: string } | null {
    const match = content.match(/\[([^\]]+)\]\((\/students\/[^)]+review=[^)]+)\)/)
    if (match) return { label: match[1], url: match[2] }
    const rawMatch = content.match(/(\/students\/\S*review=\S+)/)
    if (rawMatch) return { label: 'Revisar programa', url: rawMatch[1] }
    return null
}

// ── Component ──

export function AssistantPanelContent() {
    const { studentId, studentName, insightId, initialMessage, closePanel } = useCommunicationStore()
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

    // Extended loading state (tool execution takes longer)
    const [loadingSeconds, setLoadingSeconds] = useState(0)
    useEffect(() => {
        if (!isLoading) { setLoadingSeconds(0); return }
        const interval = setInterval(() => setLoadingSeconds(s => s + 1), 1000)
        return () => clearInterval(interval)
    }, [isLoading])

    const loadingText = loadingSeconds >= 5 ? 'Gerando programa...' : loadingSeconds >= 3 ? 'Analisando dados...' : null

    // Scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    // Focus input on mount
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
        <div className="flex flex-col h-full">
            {/* Context subtitle */}
            <div className="px-4 py-2 border-b border-border">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                        <Sparkles className="w-3 h-3 text-violet-500" />
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-tight truncate">{subtitle}</p>
                </div>
            </div>

            {/* Messages area */}
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
                                                onClick={() => closePanel()}
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

                {/* Loading indicator */}
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
        </div>
    )
}
