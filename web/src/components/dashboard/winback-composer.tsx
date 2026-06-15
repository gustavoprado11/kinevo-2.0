'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, X, Send, Loader2, AlertTriangle, Link2 } from 'lucide-react'
import { sendMessage } from '@/app/messages/actions'

interface WinbackComposerProps {
    studentId: string
    planId: string
    studentName: string
    planTitle: string | null
    onClose: () => void
    /** Chamado após envio bem-sucedido — o pai esconde o card de plano expirado. */
    onSent: (studentId: string) => void
}

type Phase = 'loading' | 'ready' | 'error'

interface WinbackResponse {
    draft?: { message?: string; references?: string[]; confidence?: 'high' | 'low' }
    can_attach_link?: boolean
}

export function WinbackComposer({ studentId, planId, studentName, planTitle, onClose, onSent }: WinbackComposerProps) {
    const [phase, setPhase] = useState<Phase>('loading')
    const [message, setMessage] = useState('')
    const [references, setReferences] = useState<string[]>([])
    const [confidence, setConfidence] = useState<'high' | 'low'>('high')
    const [canAttachLink, setCanAttachLink] = useState(false)
    const [attachLink, setAttachLink] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [sending, setSending] = useState(false)

    useEffect(() => {
        let cancelled = false
        ;(async () => {
            try {
                const res = await fetch('/api/assistant/winback-draft', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ student_id: studentId, plan_id: planId }),
                })
                if (!res.ok) {
                    const txt = await res.text().catch(() => '')
                    if (!cancelled) { setError(txt || 'Não foi possível gerar o rascunho.'); setPhase('error') }
                    return
                }
                const data = (await res.json()) as WinbackResponse
                if (cancelled) return
                setMessage(data?.draft?.message ?? '')
                setReferences(Array.isArray(data?.draft?.references) ? data.draft!.references! : [])
                setConfidence(data?.draft?.confidence === 'low' ? 'low' : 'high')
                setCanAttachLink(Boolean(data?.can_attach_link))
                setAttachLink(Boolean(data?.can_attach_link))
                setPhase('ready')
            } catch {
                if (!cancelled) { setError('Erro de rede ao gerar o rascunho.'); setPhase('error') }
            }
        })()
        return () => { cancelled = true }
    }, [studentId, planId])

    const handleSend = useCallback(async () => {
        let text = message.trim()
        if (!text || sending) return
        setSending(true)
        setError(null)

        // Gera o link Asaas SÓ no envio (não cria contrato pending em rascunho descartado).
        if (canAttachLink && attachLink) {
            try {
                const linkRes = await fetch('/api/wallet/subscriptions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ studentId, planId }),
                })
                const linkData = await linkRes.json().catch(() => ({}))
                if (!linkRes.ok || !linkData?.url) {
                    setError(linkData?.error || 'Falha ao gerar o link de renovação. Desmarque para enviar sem link.')
                    setSending(false)
                    return
                }
                text = `${text}\n\nRenove aqui: ${linkData.url}`
            } catch {
                setError('Erro ao gerar o link de renovação. Desmarque para enviar sem link.')
                setSending(false)
                return
            }
        }

        const fd = new FormData()
        fd.set('content', text)
        const res = await sendMessage(studentId, fd)
        if (res.success) {
            onSent(studentId)
        } else {
            setError(res.error || 'Falha ao enviar a mensagem.')
            setSending(false)
        }
    }, [message, sending, canAttachLink, attachLink, studentId, planId, onSent])

    return (
        <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
        >
            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="flex w-full max-h-[90vh] flex-col rounded-t-2xl border border-[#E8E8ED] bg-white shadow-xl dark:border-k-border-subtle dark:bg-surface-card sm:max-w-md sm:rounded-2xl"
            >
                <div className="flex items-center justify-between border-b border-[#E8E8ED] px-5 py-4 dark:border-k-border-subtle">
                    <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-violet-500" />
                        <div>
                            <h3 className="text-sm font-semibold text-[#1D1D1F] dark:text-k-text-primary">
                                Reativar {studentName}
                            </h3>
                            <p className="text-[11px] text-[#86868B] dark:text-k-text-tertiary line-clamp-1">
                                {planTitle ? `Plano: ${planTitle}` : 'Plano expirado'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="rounded-md p-1 transition-colors hover:bg-black/5 dark:hover:bg-white/5" title="Fechar">
                        <X className="h-4 w-4 text-[#AEAEB2] dark:text-muted-foreground/60" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4">
                    {phase === 'loading' && (
                        <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                            <Loader2 className="h-5 w-5 animate-spin text-violet-500" />
                            <p className="text-[13px] text-[#6E6E73] dark:text-k-text-secondary">Gerando rascunho de reativação…</p>
                        </div>
                    )}

                    {phase === 'error' && (
                        <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                            <AlertTriangle className="h-5 w-5 text-amber-500" />
                            <p className="text-[13px] text-[#6E6E73] dark:text-k-text-secondary">{error || 'Não foi possível gerar o rascunho.'}</p>
                        </div>
                    )}

                    {phase === 'ready' && (
                        <>
                            {confidence === 'low' && (
                                <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-500/20 dark:bg-amber-500/10">
                                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                                    <p className="text-[11px] text-amber-700 dark:text-amber-400">Contexto limitado — revise com atenção antes de enviar.</p>
                                </div>
                            )}

                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                rows={5}
                                maxLength={2000}
                                className="w-full resize-none rounded-lg border border-[#D2D2D7] bg-white px-3 py-2 text-[14px] text-[#1D1D1F] outline-none focus:border-violet-400 dark:border-k-border-primary dark:bg-glass-bg dark:text-k-text-primary"
                                placeholder="Mensagem de reativação…"
                            />

                            {references.length > 0 && (
                                <div className="mt-3">
                                    <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[#AEAEB2] dark:text-k-text-quaternary">Ancorado em</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {references.map((r, i) => (
                                            <span key={i} className="rounded-full bg-[#F5F5F7] px-2 py-0.5 text-[10px] text-[#6E6E73] dark:bg-glass-bg dark:text-k-text-secondary">{r}</span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {canAttachLink ? (
                                <label className="mt-3 flex items-center gap-2 text-[12px] text-[#6E6E73] dark:text-k-text-secondary cursor-pointer">
                                    <input type="checkbox" checked={attachLink} onChange={(e) => setAttachLink(e.target.checked)} className="accent-violet-600" />
                                    <Link2 className="h-3.5 w-3.5" />
                                    Anexar link de renovação{planTitle ? ` (${planTitle})` : ''}
                                </label>
                            ) : (
                                <p className="mt-3 text-[11px] text-[#AEAEB2] dark:text-k-text-tertiary">
                                    Cobrança manual — combine o pagamento com o aluno (sem link automático).
                                </p>
                            )}

                            {error && <p className="mt-2 text-[11px] text-red-500">{error}</p>}
                        </>
                    )}
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-[#E8E8ED] px-5 py-3 dark:border-k-border-subtle">
                    <button onClick={onClose} disabled={sending} className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-[#6E6E73] transition-colors hover:bg-[#F5F5F7] disabled:opacity-50 dark:text-k-text-secondary dark:hover:bg-muted">
                        Descartar
                    </button>
                    <button onClick={handleSend} disabled={phase !== 'ready' || sending || !message.trim()} className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3.5 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-violet-500 disabled:opacity-50">
                        {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                        Enviar
                    </button>
                </div>
            </motion.div>
        </div>
    )
}
