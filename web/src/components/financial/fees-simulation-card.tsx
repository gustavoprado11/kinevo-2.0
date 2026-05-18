// ============================================================================
// FeesSimulationCard — mostra ao trainer quanto ele recebe líquido por método
// ============================================================================
// Usado no form de criação de plano e no modal de cobrança via Carteira.
// Pega o valor digitado + lista de métodos aceitos e roda simulateNet.
// ============================================================================

'use client'

import { useMemo } from 'react'
import { simulateNet, formatBRL, PAYMENT_METHOD_LABELS, type PaymentMethod } from '@/lib/asaas/fees'
import { Sparkles } from 'lucide-react'

interface Props {
    /** Valor da cobrança em BRL (number ou string aceitando vírgula/ponto). */
    value: number | string
    /** Métodos a simular. Default: PIX + Crédito + Débito. */
    methods?: PaymentMethod[]
    /** Modo compacto pra ocupar menos espaço no form. */
    compact?: boolean
    /** Override pra exibir o título do card (default: "Você recebe líquido"). */
    title?: string
}

function parseValue(v: number | string): number {
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0
    const cleaned = v.replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')
    const n = parseFloat(cleaned)
    return Number.isFinite(n) ? n : 0
}

export function FeesSimulationCard({
    value,
    methods = ['PIX', 'CREDIT_CARD', 'DEBIT_CARD'],
    compact = false,
    title = 'Você recebe líquido',
}: Props) {
    const num = parseValue(value)
    const rows = useMemo(() => methods.map(m => simulateNet(num, m)), [num, methods])

    if (num <= 0) {
        return (
            <div className="rounded-xl border border-dashed border-k-border-subtle bg-surface-inset/40 p-4 text-center">
                <p className="text-xs text-k-text-quaternary">
                    Informe o preço para ver quanto você recebe líquido em cada método.
                </p>
            </div>
        )
    }

    return (
        <div className={`rounded-xl border border-k-border-subtle bg-gradient-to-br from-violet-500/[0.04] to-blue-500/[0.04] ${compact ? 'p-3' : 'p-4'}`}>
            <div className="flex items-center gap-1.5 mb-2.5">
                <Sparkles className="w-3.5 h-3.5 text-violet-500" strokeWidth={2} />
                <p className="text-[11px] font-semibold uppercase tracking-wider text-k-text-tertiary">
                    {title}
                </p>
            </div>
            <ul className="space-y-1.5">
                {rows.map(r => (
                    <li key={r.method} className="flex items-center justify-between gap-2 text-sm">
                        <span className="text-k-text-secondary">
                            {PAYMENT_METHOD_LABELS[r.method]}
                        </span>
                        <span className="flex items-baseline gap-1.5 tabular-nums">
                            <span className="text-[11px] text-k-text-quaternary">
                                taxa {formatBRL(r.asaasFee)}
                            </span>
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                {formatBRL(r.trainerNet)}
                            </span>
                        </span>
                    </li>
                ))}
            </ul>
            {!compact && (
                <p className="text-[10.5px] text-k-text-quaternary mt-2.5 leading-snug">
                    Taxas Asaas. Saque para sua conta em PIX, sem custo. Atualizado em 05/2026.
                </p>
            )}
        </div>
    )
}
