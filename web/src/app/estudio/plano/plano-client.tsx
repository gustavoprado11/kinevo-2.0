'use client'

import { useState } from 'react'
import { ExternalLink, Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { STUDIO_TIERS, studioTierDisplay, type StudioTier } from '@/lib/studio/studio-tiers'

interface Props {
    tier: StudioTier | null
    studentCount: number
    studentLimit: number | null // null = ilimitado
    currentPeriodEnd: string | null
    cancelAtPeriodEnd: boolean
    status: string
}

export function PlanoClient({ tier, studentCount, studentLimit, currentPeriodEnd, cancelAtPeriodEnd, status }: Props) {
    const { toast } = useToast()
    const [loadingPortal, setLoadingPortal] = useState(false)
    const display = tier ? studioTierDisplay(tier) : null

    async function openPortal() {
        setLoadingPortal(true)
        try {
            const res = await fetch('/api/stripe/studio-portal', { method: 'POST' })
            const json = await res.json()
            if (json.url) window.location.href = json.url
            else { toast({ message: json.error ?? 'Falha ao abrir a gestão', type: 'error' }); setLoadingPortal(false) }
        } catch {
            toast({ message: 'Erro ao abrir a gestão', type: 'error' }); setLoadingPortal(false)
        }
    }

    const pct = studentLimit && Number.isFinite(studentLimit) ? Math.min(100, Math.round((studentCount / studentLimit) * 100)) : 0
    const near = studentLimit != null && Number.isFinite(studentLimit) && studentCount / studentLimit >= 0.8

    const fmtDate = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'

    return (
        <div className="mt-6 space-y-6">
            {/* Assinatura atual */}
            <div className="rounded-2xl border border-k-border-subtle bg-surface-card p-6">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-k-text-quaternary">Plano atual</p>
                        <p className="mt-1 text-xl font-bold text-k-text-primary">{display ? `Kinevo ${display.name}` : '—'}</p>
                        {display && <p className="text-sm text-violet-500 font-medium">{display.price}/mês</p>}
                    </div>
                    <button
                        onClick={openPortal}
                        disabled={loadingPortal}
                        className="inline-flex items-center gap-2 rounded-xl border border-k-border-primary bg-glass-bg px-4 py-2 text-sm font-bold text-k-text-primary hover:bg-glass-bg-active disabled:opacity-60"
                    >
                        {loadingPortal ? <Loader2 size={14} className="animate-spin" /> : <>Gerenciar assinatura <ExternalLink size={14} /></>}
                    </button>
                </div>

                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-k-border-subtle bg-glass-bg p-4">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-k-text-quaternary mb-1">Alunos</p>
                        <p className="text-sm font-bold text-k-text-primary">
                            {studentCount}{studentLimit != null && Number.isFinite(studentLimit) ? ` / ${studentLimit}` : ''}
                        </p>
                        {studentLimit != null && Number.isFinite(studentLimit) && (
                            <div className="mt-2 h-1.5 rounded-full bg-k-border-subtle overflow-hidden">
                                <div className={`h-full rounded-full ${near ? 'bg-amber-500' : 'bg-violet-500'}`} style={{ width: `${pct}%` }} />
                            </div>
                        )}
                        {near && <p className="mt-1.5 text-[11px] text-amber-500">Perto do limite — considere a próxima faixa.</p>}
                    </div>
                    <div className="rounded-xl border border-k-border-subtle bg-glass-bg p-4">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-k-text-quaternary mb-1">
                            {cancelAtPeriodEnd ? 'Acesso até' : 'Próxima cobrança'}
                        </p>
                        <p className="text-sm font-bold text-k-text-primary">{fmtDate(currentPeriodEnd)}</p>
                        {cancelAtPeriodEnd && <p className="mt-1 text-[11px] text-amber-500">Cancelamento agendado.</p>}
                        {status === 'past_due' && <p className="mt-1 text-[11px] text-amber-500">Pagamento pendente.</p>}
                    </div>
                </div>
            </div>

            {/* Faixas + troca via portal (checkout criaria uma 2ª assinatura) */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-k-text-primary">Faixas do estúdio</h2>
                    <button
                        onClick={openPortal}
                        disabled={loadingPortal}
                        className="text-xs font-semibold text-violet-500 hover:text-violet-400 disabled:opacity-60"
                    >
                        Trocar de faixa ou cancelar →
                    </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {STUDIO_TIERS.map(t => {
                        const isCurrent = tier === t.tier
                        return (
                            <div key={t.tier} className={`rounded-2xl border p-4 ${isCurrent ? 'border-violet-500 bg-violet-500/5' : 'border-k-border-subtle bg-surface-card'}`}>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-semibold text-k-text-primary">{t.name}</span>
                                    {isCurrent && <span className="text-[10px] font-bold text-violet-500 uppercase">Atual</span>}
                                </div>
                                <p className="mt-1 text-xl font-bold text-k-text-primary">
                                    {t.price}{!t.custom && <span className="text-xs font-normal text-k-text-tertiary">/mês</span>}
                                </p>
                                <p className="mt-1 text-xs text-k-text-tertiary">{t.blurb}</p>
                            </div>
                        )
                    })}
                </div>
                <p className="mt-3 text-xs text-k-text-quaternary">Mudar de faixa ou cancelar é feito em &ldquo;Gerenciar assinatura&rdquo; — a troca ajusta o valor proporcionalmente (sem nova cobrança cheia).</p>
            </div>
        </div>
    )
}
