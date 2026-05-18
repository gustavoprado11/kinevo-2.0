// ============================================================================
// WalletStatusCard — banner principal da aba Financeiro
// ============================================================================
// Mostra status da Carteira Kinevo + saldo (se ativa) + atalho.
// Substitui o ConnectStatusCard (Stripe) no /financial.
// ============================================================================

import Link from 'next/link'
import {
    Wallet, ArrowRight, Clock3, AlertTriangle, Check, Sparkles, Link2,
} from 'lucide-react'
import type { KinevoWalletStatus, KinevoWalletMode } from '@/lib/asaas'

interface Props {
    status: KinevoWalletStatus
    mode?: KinevoWalletMode
    balance: number | null
    rejectionReason?: string | null
}

const formatBRL = (n: number) =>
    n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function WalletStatusCard({ status, mode, balance, rejectionReason }: Props) {
    // ---- Aprovada: card destaque com saldo ----
    if (status === 'approved') {
        return (
            <Link
                href="/financial/wallet"
                className="block rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-50 to-violet-50 dark:from-emerald-500/5 dark:to-violet-500/5 dark:border-emerald-500/15 p-5 transition-all hover:shadow-md hover:border-emerald-500/40"
            >
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-emerald-100 dark:bg-emerald-500/10 p-2.5">
                            <Wallet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" strokeWidth={1.5} />
                        </div>
                        <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="font-semibold text-[#1D1D1F] dark:text-k-text-primary text-sm">
                                    Carteira Kinevo
                                </p>
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                                    <Check className="w-2.5 h-2.5" strokeWidth={3} />
                                    Ativa
                                </span>
                                {mode === 'linked' && (
                                    <span className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-500/10 text-slate-600 dark:text-slate-400">
                                        <Link2 className="w-2.5 h-2.5" />
                                        Vinculada
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-k-text-tertiary mt-0.5">
                                Saldo disponível: <span className="font-semibold text-k-text-primary tabular-nums">
                                    {balance !== null ? formatBRL(balance) : '—'}
                                </span>
                            </p>
                        </div>
                    </div>
                    <div className="text-emerald-600 dark:text-emerald-400 text-sm font-medium flex items-center gap-1 shrink-0">
                        Ver Carteira
                        <ArrowRight className="w-4 h-4" />
                    </div>
                </div>
            </Link>
        )
    }

    // ---- Em análise (pending/awaiting) ----
    if (status === 'pending' || status === 'awaiting') {
        return (
            <Link
                href="/financial/wallet"
                className="block rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 transition-all hover:border-amber-500/40"
            >
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-amber-500/10 p-2.5">
                            <Clock3 className="w-5 h-5 text-amber-600 dark:text-amber-400" strokeWidth={1.5} />
                        </div>
                        <div>
                            <p className="font-semibold text-[#1D1D1F] dark:text-k-text-primary text-sm">
                                Carteira Kinevo em análise
                            </p>
                            <p className="text-xs text-k-text-tertiary mt-0.5">
                                Estamos validando seus dados. Te avisamos por push assim que liberada.
                            </p>
                        </div>
                    </div>
                    <div className="text-amber-600 dark:text-amber-400 text-sm font-medium flex items-center gap-1 shrink-0">
                        Acompanhar
                        <ArrowRight className="w-4 h-4" />
                    </div>
                </div>
            </Link>
        )
    }

    // ---- Rejeitada / bloqueada ----
    if (status === 'rejected' || status === 'blocked') {
        return (
            <Link
                href="/financial/wallet"
                className="block rounded-2xl border border-red-500/20 bg-red-500/5 p-5 transition-all hover:border-red-500/40"
            >
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-red-500/10 p-2.5">
                            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" strokeWidth={1.5} />
                        </div>
                        <div>
                            <p className="font-semibold text-[#1D1D1F] dark:text-k-text-primary text-sm">
                                Carteira {status === 'rejected' ? 'reprovada' : 'bloqueada'}
                            </p>
                            <p className="text-xs text-k-text-tertiary mt-0.5">
                                {rejectionReason ?? 'Toque pra ver detalhes e seguir os próximos passos.'}
                            </p>
                        </div>
                    </div>
                    <div className="text-red-600 dark:text-red-400 text-sm font-medium flex items-center gap-1 shrink-0">
                        Ver detalhes
                        <ArrowRight className="w-4 h-4" />
                    </div>
                </div>
            </Link>
        )
    }

    // ---- Not started: CTA pra ativar ----
    return (
        <Link
            href="/financial/wallet"
            className="block rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/[0.06] to-blue-500/[0.04] p-5 transition-all hover:shadow-md hover:border-violet-500/40"
        >
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-violet-500/10 p-2.5">
                        <Sparkles className="w-5 h-5 text-violet-600 dark:text-violet-400" strokeWidth={1.5} />
                    </div>
                    <div>
                        <p className="font-semibold text-[#1D1D1F] dark:text-k-text-primary text-sm">
                            Ative sua Carteira Kinevo
                        </p>
                        <p className="text-xs text-k-text-tertiary mt-0.5">
                            Receba alunos via PIX e Cartão direto no app. Sem mensalidade, saque sem taxa.
                        </p>
                    </div>
                </div>
                <div className="bg-violet-500 hover:bg-violet-600 text-white text-sm font-semibold px-4 py-2 rounded-full transition-colors shrink-0 flex items-center gap-1">
                    Começar
                    <ArrowRight className="w-4 h-4" />
                </div>
            </div>
        </Link>
    )
}
