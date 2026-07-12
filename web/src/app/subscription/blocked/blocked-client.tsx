'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Check, Lock, AlertCircle, RefreshCw } from 'lucide-react'
import { PAID_TIER_DISPLAY } from '@/lib/billing/tiers'
import type { AiTier } from '@/lib/auth/get-ai-tier'

const stateConfig = {
    no_subscription: {
        icon: <Lock size={28} className="text-violet-400" />,
        title: 'Complete sua assinatura',
        description: 'Para acessar o modo treinador completo, escolha um plano.',
        buttonText: 'Assinar',
        action: 'checkout' as const,
    },
    past_due: {
        icon: <AlertCircle size={28} className="text-amber-400" />,
        title: 'Pagamento pendente',
        description: 'Seu último pagamento falhou. Atualize seu método de pagamento para restaurar o acesso ao Kinevo.',
        buttonText: 'Atualizar pagamento',
        action: 'portal' as const,
    },
    canceled: {
        icon: <RefreshCw size={28} className="text-violet-400" />,
        title: 'Assinatura cancelada',
        description: 'Sua assinatura foi cancelada. Escolha um plano para voltar a gerenciar seus alunos e treinos.',
        buttonText: 'Reativar',
        action: 'checkout' as const,
    },
}

interface BlockedClientProps {
    trainerName: string
    state: 'no_subscription' | 'past_due' | 'canceled'
}

export function BlockedClient({ trainerName, state }: BlockedClientProps) {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    // Default no plano em destaque (Pro IA) — a tela de reativação é ponto de
    // conversão; vender só o Essencial legado desperdiçava upgrade (AC5).
    const [selectedTier, setSelectedTier] = useState<AiTier>(
        () => PAID_TIER_DISPLAY.find((t) => t.featured)?.tier ?? PAID_TIER_DISPLAY[0].tier,
    )

    const config = stateConfig[state]
    const isCheckout = config.action === 'checkout'
    const selectedPlan = PAID_TIER_DISPLAY.find((t) => t.tier === selectedTier)

    const handleAction = async () => {
        setLoading(true)
        setError(null)

        try {
            const res = isCheckout
                ? await fetch('/api/stripe/checkout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    // AC5: tier explícito — o POST sem body caía no price legado.
                    body: JSON.stringify({ tier: selectedTier }),
                })
                : await fetch('/api/stripe/portal', { method: 'POST' })
            const json = await res.json()

            if (!res.ok || !json.url) {
                setError(json?.error || 'Erro ao processar. Tente novamente.')
                setLoading(false)
                return
            }

            window.location.href = json.url
        } catch {
            setError('Erro de conexão. Tente novamente.')
            setLoading(false)
        }
    }

    const handleLogout = async () => {
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()
        await supabase.auth.signOut()
        window.location.href = '/login'
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-surface-bg px-6 py-10">
            {/* Background glows */}
            <div className="fixed top-0 -left-1/4 w-1/2 h-1/2 bg-violet-600/5 blur-[120px] rounded-full pointer-events-none" />
            <div className="fixed bottom-0 -right-1/4 w-1/2 h-1/2 bg-indigo-500/5 blur-[120px] rounded-full pointer-events-none" />

            <div className="relative z-sticky w-full max-w-md text-center">
                {/* Logo */}
                <div className="flex items-center justify-center gap-3 mb-10">
                    <Image
                        src="/logo-icon.png"
                        alt="Kinevo"
                        width={32}
                        height={32}
                        className="rounded-lg"
                    />
                    <span className="text-xl font-black text-white tracking-tight">Kinevo</span>
                </div>

                {/* Card */}
                <div className="bg-glass-bg backdrop-blur-md border border-k-border-primary rounded-2xl p-8">
                    {/* Icon */}
                    <div className="w-16 h-16 rounded-2xl bg-glass-bg border border-k-border-subtle flex items-center justify-center mx-auto mb-6">
                        {config.icon}
                    </div>

                    <h1 className="text-2xl font-black text-white tracking-tight mb-2">{config.title}</h1>
                    <p className="text-k-text-tertiary mb-1">Olá, {trainerName}.</p>
                    <p className="text-k-text-tertiary mb-6">{config.description}</p>

                    {/* Seleção de plano (AC5: antes era 1 botão fixo no price legado
                        prometendo um trial que não existe mais) */}
                    {isCheckout && (
                        <div className="space-y-2 mb-6 text-left">
                            {PAID_TIER_DISPLAY.map((plan) => {
                                const selected = plan.tier === selectedTier
                                return (
                                    <button
                                        key={plan.tier}
                                        type="button"
                                        onClick={() => setSelectedTier(plan.tier)}
                                        aria-pressed={selected}
                                        className={`w-full flex items-center gap-3 rounded-xl border px-4 py-3 transition-all ${
                                            selected
                                                ? 'border-violet-500 bg-violet-500/10'
                                                : 'border-k-border-subtle bg-glass-bg hover:border-k-border-primary'
                                        }`}
                                    >
                                        <span
                                            className={`h-4 w-4 rounded-full border flex items-center justify-center flex-shrink-0 ${
                                                selected ? 'border-violet-400 bg-violet-500' : 'border-k-border-primary'
                                            }`}
                                        >
                                            {selected && <Check size={10} className="text-white" strokeWidth={3} />}
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="flex items-center gap-2">
                                                <span className="text-sm font-bold text-white">{plan.name}</span>
                                                {plan.featured && (
                                                    <span className="text-[9px] font-black uppercase tracking-wider text-violet-300 bg-violet-500/20 px-1.5 py-0.5 rounded">
                                                        Popular
                                                    </span>
                                                )}
                                            </span>
                                            <span className="block text-[11px] text-k-text-quaternary truncate">
                                                {plan.credits}
                                            </span>
                                        </span>
                                        <span className="text-sm font-bold text-white whitespace-nowrap">
                                            {plan.price}
                                            <span className="text-[10px] font-medium text-k-text-quaternary">{plan.priceSuffix}</span>
                                        </span>
                                    </button>
                                )
                            })}
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm mb-4">
                            {error}
                        </div>
                    )}

                    <button
                        onClick={handleAction}
                        disabled={loading}
                        className="w-full py-3 px-4 bg-violet-600 hover:bg-violet-500 disabled:bg-violet-600/50 disabled:cursor-not-allowed text-white text-[11px] font-black rounded-xl transition-all shadow-lg shadow-violet-600/20 hover:shadow-violet-500/30"
                    >
                        {loading
                            ? 'Processando...'
                            : isCheckout && selectedPlan
                                ? `${config.buttonText} ${selectedPlan.name} — ${selectedPlan.price}${selectedPlan.priceSuffix}`
                                : config.buttonText}
                    </button>

                    {isCheckout && (
                        <p className="text-k-text-quaternary text-xs mt-4">
                            Cobrança imediata no cartão · Cancele quando quiser
                        </p>
                    )}
                </div>

                {/* Logout link */}
                <button
                    onClick={handleLogout}
                    className="text-k-text-quaternary hover:text-k-text-tertiary text-sm mt-6 transition-colors"
                >
                    Sair da conta
                </button>
            </div>
        </div>
    )
}
