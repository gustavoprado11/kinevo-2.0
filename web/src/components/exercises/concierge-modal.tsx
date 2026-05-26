'use client'

import { useState, useTransition } from 'react'
import { X, Video, MessageCircle } from 'lucide-react'
import { requestConcierge } from '@/actions/concierge/request-concierge'

interface ConciergeModalProps {
    open: boolean
    /** Origem do clique (ex.: 'biblioteca_button', 'exercise_empty'). */
    source: string
    onClose: () => void
}

const STEPS = [
    'Você nos envia seus vídeos (Drive, WeTransfer, WhatsApp)',
    'A equipe nomeia, organiza e atribui a cada exercício',
    'Sua biblioteca aparece pronta em até 24h úteis',
]

/**
 * Modal do Concierge — segue o sistema visual do dashboard (card branco,
 * acentos violeta, ritmo do BrandingSection). Ao confirmar, grava o lead
 * (server action) e abre wa.me em nova aba.
 */
export function ConciergeModal({ open, source, onClose }: ConciergeModalProps) {
    const [isPending, startTransition] = useTransition()
    const [error, setError] = useState<string | null>(null)

    if (!open) return null

    const handleConfirm = () => {
        setError(null)
        startTransition(async () => {
            const result = await requestConcierge(source)
            if (!result.success || !result.whatsappUrl) {
                setError(result.message ?? 'Não foi possível abrir o WhatsApp. Tente de novo.')
                return
            }
            window.open(result.whatsappUrl, '_blank', 'noopener,noreferrer')
            onClose()
        })
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6 backdrop-blur-sm"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
        >
            <div
                className="relative w-full max-w-[500px] rounded-2xl border border-k-border-primary bg-surface-card p-6 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Fechar */}
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Fechar"
                    className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-k-border-subtle bg-glass-bg text-k-text-tertiary transition-colors hover:bg-glass-bg-active hover:text-k-text-primary"
                >
                    <X size={14} />
                </button>

                {/* Header: icon + eyebrow + status */}
                <div className="mb-5 flex items-start gap-3">
                    <div className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl border border-violet-500/20 bg-violet-500/10 text-violet-600 dark:text-violet-400">
                        <Video size={20} strokeWidth={1.8} />
                    </div>
                    <div className="flex flex-col gap-1 leading-tight">
                        <span className="text-[10px] font-extrabold uppercase tracking-[1.4px] text-k-text-tertiary">
                            Concierge
                        </span>
                        <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.22)]" />
                            Equipe disponível
                        </span>
                    </div>
                </div>

                {/* Title + body */}
                <h2 className="mb-2 text-[22px] font-bold tracking-tight text-k-text-primary">
                    Biblioteca pronta em 24h
                </h2>
                <p className="mb-5 text-sm leading-relaxed text-k-text-tertiary">
                    Mande seus vídeos pra equipe Kinevo, a gente coloca cada um no exercício certo do seu programa.
                    Você não levanta um dedo.
                </p>

                {/* Steps */}
                <div className="mb-6 flex flex-col gap-2.5">
                    {STEPS.map((t, i) => (
                        <div
                            key={i}
                            className="flex items-center gap-3 rounded-xl border border-k-border-subtle bg-surface-inset px-3.5 py-2.5"
                        >
                            <div className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full bg-violet-100 text-[11px] font-extrabold text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
                                {i + 1}
                            </div>
                            <div className="text-[13px] font-medium text-k-text-secondary">{t}</div>
                        </div>
                    ))}
                </div>

                {error && (
                    <div className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-300">
                        {error}
                    </div>
                )}

                {/* CTA */}
                <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={isPending}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/20 transition-all hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    <MessageCircle size={14} />
                    {isPending ? 'Abrindo WhatsApp...' : 'Falar no WhatsApp'}
                </button>
                <p className="mt-3 text-center text-[11.5px] font-medium text-k-text-tertiary">
                    Resposta em até 1h em horário comercial
                </p>
            </div>
        </div>
    )
}
