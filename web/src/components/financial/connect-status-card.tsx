'use client'

import { useState } from 'react'
import { CheckCircle2, AlertCircle, ExternalLink, Loader2 } from 'lucide-react'

interface ConnectStatusCardProps {
    connected: boolean
    chargesEnabled: boolean
    detailsSubmitted: boolean
    payoutsEnabled: boolean
}

export function ConnectStatusCard({
    connected,
    chargesEnabled,
    detailsSubmitted,
    payoutsEnabled,
}: ConnectStatusCardProps) {
    const [loading, setLoading] = useState(false)

    const handleConnect = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/stripe/connect/onboard', { method: 'POST' })
            const data = await res.json()
            if (data.url) {
                window.location.href = data.url
            }
        } catch {
            setLoading(false)
        }
    }

    // Not connected at all
    if (!connected) {
        return (
            <div className="rounded-2xl border border-k-border-primary bg-surface-card p-6">
                <div className="flex items-start gap-4">
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-violet-500/10">
                        <ExternalLink size={20} className="text-violet-400" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-base font-semibold text-k-text-primary">
                            Conectar com Stripe
                        </h3>
                        <p className="text-sm text-k-text-secondary mt-1">
                            Conecte sua conta Stripe para receber pagamentos automáticos dos seus alunos via cartão ou Pix.
                        </p>
                        <button
                            onClick={handleConnect}
                            disabled={loading}
                            className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-xl bg-violet-600 hover:bg-violet-500 text-white transition-colors disabled:opacity-50"
                        >
                            {loading ? (
                                <Loader2 size={16} className="animate-spin" />
                            ) : (
                                <ExternalLink size={16} />
                            )}
                            Conectar com Stripe
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    // Connected but onboarding incomplete
    if (!detailsSubmitted || !chargesEnabled) {
        return (
            <div className="rounded-2xl border border-amber-500/20 bg-surface-card p-6">
                <div className="flex items-start gap-4">
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-500/10">
                        <AlertCircle size={20} className="text-amber-400" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-base font-semibold text-k-text-primary">
                            Completar cadastro no Stripe
                        </h3>
                        <p className="text-sm text-k-text-secondary mt-1">
                            Sua conta Stripe está conectada, mas você precisa completar o cadastro para receber pagamentos.
                        </p>
                        <button
                            onClick={handleConnect}
                            disabled={loading}
                            className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-xl bg-amber-600 hover:bg-amber-500 text-white transition-colors disabled:opacity-50"
                        >
                            {loading ? (
                                <Loader2 size={16} className="animate-spin" />
                            ) : (
                                <ExternalLink size={16} />
                            )}
                            Completar Cadastro
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    // Fully connected
    return (
        <div className="rounded-2xl border border-emerald-500/20 bg-surface-card p-6">
            <div className="flex items-start gap-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-500/10">
                    <CheckCircle2 size={20} className="text-emerald-400" />
                </div>
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold text-k-text-primary">
                            Stripe Conectado
                        </h3>
                        <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
                            Ativo
                        </span>
                    </div>
                    <p className="text-sm text-k-text-secondary mt-1">
                        Sua conta está pronta para receber pagamentos.
                    </p>
                    <div className="mt-3 flex gap-4 text-xs text-k-text-secondary">
                        <span className="flex items-center gap-1">
                            <CheckCircle2 size={12} className="text-emerald-400" />
                            Pagamentos habilitados
                        </span>
                        {payoutsEnabled && (
                            <span className="flex items-center gap-1">
                                <CheckCircle2 size={12} className="text-emerald-400" />
                                Transferências habilitadas
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
