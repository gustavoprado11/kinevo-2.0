'use client'

import { useState } from 'react'
import { Building2, Loader2 } from 'lucide-react'
import { createOrganization } from '@/actions/organizations/create-organization'
import { useToast } from '@/components/ui/toast'
import { STUDIO_TIERS, type StudioTier } from '@/lib/studio/studio-tiers'
import { startStudioCheckout } from '../studio-tier-picker'

export function CriarEstudioClient() {
    const { toast } = useToast()
    const [name, setName] = useState('')
    const [tier, setTier] = useState<StudioTier>('studio_50')
    const [loading, setLoading] = useState(false)

    async function submit() {
        const trimmed = name.trim()
        if (trimmed.length < 2) {
            toast({ message: 'Dê um nome ao estúdio', type: 'error' })
            return
        }
        if (tier === 'studio_custom') {
            toast({ message: 'Para 200+ alunos, fale com a gente pela faixa Studio 200+', type: 'error' })
            return
        }
        setLoading(true)
        const res = await createOrganization({ name: trimmed })
        if (!res.success) {
            toast({ message: res.error ?? 'Não foi possível criar o estúdio', type: 'error' })
            setLoading(false)
            return
        }
        // org criada (incomplete) → checkout da faixa escolhida
        const checkout = await startStudioCheckout(tier)
        if (!checkout.ok) {
            toast({ message: checkout.error ?? 'Estúdio criado, mas o checkout falhou. Tente novamente em Estúdio.', type: 'error' })
            setLoading(false)
        }
        // sucesso → redirect ao Stripe
    }

    return (
        <div className="max-w-xl">
            <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-500">
                    <Building2 size={20} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-k-text-primary">Criar estúdio</h1>
                    <p className="text-sm text-k-text-tertiary">Vários treinadores, alunos compartilhados e painel do gestor.</p>
                </div>
            </div>

            <label className="block text-xs font-bold uppercase tracking-wider text-k-text-quaternary mb-1.5">Nome do estúdio</label>
            <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ex.: Estúdio Corpo em Movimento"
                className="w-full rounded-xl border border-k-border-subtle bg-glass-bg px-4 py-2.5 text-sm text-k-text-primary placeholder:text-k-text-quaternary focus:outline-none focus:border-violet-500/40 mb-6"
            />

            <label className="block text-xs font-bold uppercase tracking-wider text-k-text-quaternary mb-2">Faixa (por nº de alunos)</label>
            <div className="space-y-2 mb-8">
                {STUDIO_TIERS.filter(t => !t.custom).map(t => (
                    <button
                        key={t.tier}
                        onClick={() => setTier(t.tier)}
                        className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${
                            tier === t.tier ? 'border-violet-500 bg-violet-500/5' : 'border-k-border-subtle bg-surface-card hover:border-k-border-primary'
                        }`}
                    >
                        <div>
                            <span className="text-sm font-semibold text-k-text-primary">{t.name}</span>
                            <span className="block text-xs text-k-text-tertiary">{t.blurb}</span>
                        </div>
                        <span className="text-sm font-bold text-k-text-primary">{t.price}<span className="text-xs font-normal text-k-text-tertiary">/mês</span></span>
                    </button>
                ))}
            </div>

            <button
                onClick={submit}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 py-3 text-sm font-bold text-white hover:bg-violet-500 disabled:opacity-60"
            >
                {loading ? <Loader2 size={16} className="animate-spin" /> : 'Criar e assinar'}
            </button>
            <p className="mt-3 text-xs text-k-text-quaternary">Você será levado ao pagamento seguro do Stripe. O estúdio ativa assim que o pagamento confirma.</p>
        </div>
    )
}
