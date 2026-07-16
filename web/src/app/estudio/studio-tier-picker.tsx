'use client'

import { useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { STUDIO_TIERS, type StudioTier } from '@/lib/studio/studio-tiers'
import { useToast } from '@/components/ui/toast'

const CONTACT_WHATSAPP = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || '5531999064997'

/** Dispara o checkout Stripe do estúdio para a faixa escolhida. */
export async function startStudioCheckout(tier: StudioTier): Promise<{ ok: boolean; error?: string }> {
    try {
        const res = await fetch('/api/stripe/studio-checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tier }),
        })
        const json = await res.json()
        if (!res.ok || !json.url) return { ok: false, error: json.error ?? 'Falha ao iniciar o checkout' }
        window.location.href = json.url
        return { ok: true }
    } catch {
        return { ok: false, error: 'Erro de rede ao iniciar o checkout' }
    }
}

interface Props {
    /** Faixa atual (destaca e rotula "Plano atual"). */
    currentTier?: StudioTier | null
    /** Rótulo do botão (ex.: "Assinar" ou "Trocar para"). */
    ctaLabel?: string
}

export function StudioTierPicker({ currentTier, ctaLabel = 'Assinar' }: Props) {
    const { toast } = useToast()
    const [loading, setLoading] = useState<StudioTier | null>(null)

    async function pick(tier: StudioTier) {
        setLoading(tier)
        const res = await startStudioCheckout(tier)
        if (!res.ok) {
            toast({ message: res.error ?? 'Falha ao iniciar o checkout', type: 'error' })
            setLoading(null)
        }
        // sucesso → redirect para o Stripe (não reseta o loading)
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {STUDIO_TIERS.map(t => {
                const isCurrent = currentTier === t.tier
                return (
                    <div
                        key={t.tier}
                        className={`rounded-2xl border p-4 flex flex-col ${isCurrent ? 'border-violet-500 bg-violet-500/5' : 'border-k-border-subtle bg-surface-card'}`}
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-k-text-primary">{t.name}</span>
                            {isCurrent && <span className="text-[10px] font-bold text-violet-500 uppercase">Atual</span>}
                        </div>
                        <p className="mt-1 text-2xl font-bold text-k-text-primary">
                            {t.price}
                            {!t.custom && <span className="text-sm font-normal text-k-text-tertiary">/mês</span>}
                        </p>
                        <p className="mt-1 text-xs text-k-text-tertiary flex-1">{t.blurb}</p>
                        {t.custom ? (
                            <a
                                href={`https://wa.me/${CONTACT_WHATSAPP}?text=${encodeURIComponent('Quero um plano de estúdio acima de 200 alunos')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-3 inline-flex items-center justify-center rounded-xl border border-k-border-primary px-4 py-2 text-xs font-bold text-k-text-primary hover:bg-glass-bg"
                            >
                                Falar com a gente
                            </a>
                        ) : isCurrent ? (
                            <div className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-violet-500">
                                <Check size={14} /> Plano atual
                            </div>
                        ) : (
                            <button
                                onClick={() => pick(t.tier)}
                                disabled={loading !== null}
                                className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white hover:bg-violet-500 disabled:opacity-60"
                            >
                                {loading === t.tier ? <Loader2 size={14} className="animate-spin" /> : `${ctaLabel} ${t.name}`}
                            </button>
                        )}
                    </div>
                )
            })}
        </div>
    )
}
