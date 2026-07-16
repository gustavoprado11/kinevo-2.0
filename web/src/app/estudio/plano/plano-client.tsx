'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ExternalLink, Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { STUDIO_TIERS, studioTierDisplay, type StudioTier } from '@/lib/studio/studio-tiers'
import { changeStudioTier } from '@/actions/organizations/change-studio-tier'

interface Props {
    tier: StudioTier | null
    studentCount: number
    studentLimit: number | null // null = ilimitado
    currentPeriodEnd: string | null
    cancelAtPeriodEnd: boolean
    status: string
    /** Plano SOLO pago do gestor (dupla cobrança): aviso + portal pessoal. */
    soloPlan?: { name: string; price: string; privateCount: number } | null
}

export function PlanoClient({ tier, studentCount, studentLimit, currentPeriodEnd, cancelAtPeriodEnd, status, soloPlan = null }: Props) {
    const { toast } = useToast()
    const router = useRouter()
    const [loadingPortal, setLoadingPortal] = useState(false)
    const [loadingSoloPortal, setLoadingSoloPortal] = useState(false)
    const [switchingTier, setSwitchingTier] = useState<StudioTier | null>(null)
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

    async function openSoloPortal() {
        setLoadingSoloPortal(true)
        try {
            const res = await fetch('/api/stripe/portal', { method: 'POST' })
            const json = await res.json()
            if (json.url) window.location.href = json.url
            else { toast({ message: json.error ?? 'Falha ao abrir o portal pessoal', type: 'error' }); setLoadingSoloPortal(false) }
        } catch {
            toast({ message: 'Erro ao abrir o portal pessoal', type: 'error' }); setLoadingSoloPortal(false)
        }
    }

    async function switchTier(target: StudioTier) {
        const targetDisplay = studioTierDisplay(target)
        const downgrade = studentLimit != null && Number.isFinite(studentLimit)
        const warn = downgrade
            ? `Trocar para ${targetDisplay?.name}? O valor é ajustado proporcionalmente na próxima fatura (sem nova cobrança cheia agora).`
            : `Trocar para ${targetDisplay?.name}?`
        if (!window.confirm(warn)) return
        setSwitchingTier(target)
        try {
            const res = await changeStudioTier({ tier: target })
            if (res.success) {
                toast({ message: `Faixa alterada para ${targetDisplay?.name}.`, type: 'success' })
                router.refresh()
            } else {
                toast({ message: res.error ?? 'Não foi possível trocar a faixa', type: 'error' })
            }
        } catch {
            toast({ message: 'Erro ao trocar a faixa', type: 'error' })
        } finally {
            setSwitchingTier(null)
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

            {/* Dupla cobrança: gestor com plano SOLO pago além do estúdio */}
            {soloPlan && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300/50 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10 p-4">
                    <div className="text-sm">
                        <p className="font-semibold text-k-text-primary">
                            Você também tem um plano pessoal ativo — {soloPlan.name} · {soloPlan.price}/mês
                        </p>
                        <p className="mt-0.5 text-k-text-tertiary">
                            {soloPlan.privateCount > 0
                                ? `Ele vale para seus ${soloPlan.privateCount} aluno(s) particular(es) — mantenha se quiser continuar com eles.`
                                : 'Com o estúdio ativo, ele só serve para alunos particulares. Se não for usar, cancele para não pagar duas vezes.'}
                        </p>
                    </div>
                    <button
                        onClick={openSoloPortal}
                        disabled={loadingSoloPortal}
                        className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-amber-400/60 px-4 py-2 text-sm font-bold text-amber-700 dark:text-amber-400 hover:bg-amber-100/50 dark:hover:bg-amber-500/10 disabled:opacity-60"
                    >
                        {loadingSoloPortal ? <Loader2 size={14} className="animate-spin" /> : <>Gerenciar plano pessoal <ExternalLink size={14} /></>}
                    </button>
                </div>
            )}

            {/* Faixas: troca in-app com proração (o portal cobre cancelar/cartão/faturas) */}
            <div>
                <h2 className="text-sm font-semibold text-k-text-primary mb-3">Faixas do estúdio</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {STUDIO_TIERS.map(t => {
                        const isCurrent = tier === t.tier
                        const busy = switchingTier === t.tier
                        return (
                            <div key={t.tier} className={`flex flex-col rounded-2xl border p-4 ${isCurrent ? 'border-violet-500 bg-violet-500/5' : 'border-k-border-subtle bg-surface-card'}`}>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-semibold text-k-text-primary">{t.name}</span>
                                    {isCurrent && <span className="text-[10px] font-bold text-violet-500 uppercase">Atual</span>}
                                </div>
                                <p className="mt-1 text-xl font-bold text-k-text-primary">
                                    {t.price}{!t.custom && <span className="text-xs font-normal text-k-text-tertiary">/mês</span>}
                                </p>
                                <p className="mt-1 text-xs text-k-text-tertiary flex-1">{t.blurb}</p>
                                {isCurrent ? (
                                    <span className="mt-3 inline-flex h-8 items-center justify-center rounded-lg bg-glass-bg text-xs font-semibold text-k-text-tertiary">Plano atual</span>
                                ) : t.custom ? (
                                    <a
                                        href="mailto:contato@kinevoapp.com?subject=Kinevo%20Est%C3%BAdio%20200%2B"
                                        className="mt-3 inline-flex h-8 items-center justify-center rounded-lg border border-k-border-primary text-xs font-semibold text-k-text-primary hover:bg-glass-bg"
                                    >
                                        Falar com a gente
                                    </a>
                                ) : (
                                    <button
                                        onClick={() => switchTier(t.tier)}
                                        disabled={switchingTier !== null}
                                        className="mt-3 inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-violet-500 text-xs font-semibold text-white hover:bg-violet-600 disabled:opacity-60"
                                    >
                                        {busy ? <Loader2 size={13} className="animate-spin" /> : 'Mudar para esta'}
                                    </button>
                                )}
                            </div>
                        )
                    })}
                </div>
                <p className="mt-3 text-xs text-k-text-quaternary">A troca de faixa ajusta o valor proporcionalmente na próxima fatura (sem nova cobrança cheia). Cancelar, trocar o cartão ou ver faturas é feito em &ldquo;Gerenciar assinatura&rdquo;.</p>
            </div>
        </div>
    )
}
