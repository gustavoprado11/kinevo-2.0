'use client'

/**
 * CreditMeter — medidor de créditos de IA do ciclo (CONTRATO compartilhado, F1).
 *
 * Client Component puro de apresentação: recebe o resumo via prop (SEM
 * data-fetching aqui) e desenha a barra de progresso + label do ciclo. Fiel ao
 * mock `ai-trainer-pricing-mock.html` (.meter). Cor âmbar quando >80% de uso,
 * vermelho quando esgotado.
 *
 * Reutilizável em todas as superfícies: configurações (full) e barras/headers
 * de IA (compact).
 */

import type { CSSProperties } from 'react'
import { Sparkles } from 'lucide-react'
import type { AiUsageSummary } from '@/lib/ai-usage/usage-summary'
import type { AiTier } from '@/lib/auth/get-ai-tier'

const TIER_LABEL: Record<AiTier, string> = {
    free: 'Kinevo Gratuito',
    essencial: 'Kinevo Essencial',
    pro_ia: 'Kinevo Pro IA',
    premium_ia: 'Kinevo Premium IA',
}

const DAY_MS = 24 * 60 * 60 * 1000

function daysUntil(isoDate: string): number {
    const end = new Date(`${isoDate}T00:00:00Z`).getTime()
    const diff = end - Date.now()
    return Math.max(0, Math.ceil(diff / DAY_MS))
}

interface CreditMeterProps {
    summary: AiUsageSummary
    /** Versão enxuta (sem cabeçalho), p/ headers/barras estreitas. */
    compact?: boolean
}

export function CreditMeter({ summary, compact = false }: CreditMeterProps) {
    const { tier, creditsUsed, creditsTotal, creditsRemaining, periodEnd, exhausted } = summary

    const pct = creditsTotal > 0 ? Math.min(100, Math.round((creditsUsed / creditsTotal) * 100)) : 0
    const warning = pct > 80
    const days = daysUntil(periodEnd)

    // Esgotado → vermelho; >80% → âmbar; senão violeta (identidade Kinevo).
    const fillStyle: CSSProperties = exhausted
        ? { width: `${pct}%`, background: 'linear-gradient(90deg, #FF3B30, #FF6B61)' }
        : warning
          ? { width: `${pct}%`, background: 'linear-gradient(90deg, #F59E0B, #FBBF6B)' }
          : { width: `${pct}%`, background: 'linear-gradient(90deg, #7C3AED, #A78BFA)' }

    const isFree = tier === 'free'
    const unitLabel = isFree ? 'ações testadas' : 'créditos'
    const renewalLabel = isFree
        ? 'no plano gratuito'
        : days <= 0
          ? 'renova hoje'
          : `renova em ${days} ${days === 1 ? 'dia' : 'dias'}`

    const subLine = (
        <p className="text-[12.5px] text-[#6E6E73]">
            <b className="font-semibold text-[#1D1D1F]">
                {creditsUsed} de {creditsTotal} {unitLabel}
            </b>{' '}
            usados neste ciclo · {renewalLabel}
        </p>
    )

    const bar = (
        <div className="my-2 h-[9px] overflow-hidden rounded-full bg-[#EDEDF0]">
            <div className="h-full rounded-full transition-[width] duration-300" style={fillStyle} />
        </div>
    )

    if (compact) {
        return (
            <div aria-label={`${creditsUsed} de ${creditsTotal} ${unitLabel} usados`}>
                {bar}
                {subLine}
            </div>
        )
    }

    return (
        <div className="rounded-[14px] border border-[#E8E8ED] bg-white p-[15px_18px] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.12)]">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-[200px] flex-1">
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-[#EDE9FE] px-2.5 py-1 text-xs font-bold text-[#7C3AED]">
                        <Sparkles className="h-[13px] w-[13px]" strokeWidth={2} />
                        {TIER_LABEL[tier]}
                    </span>
                    <h3 className="mt-2 text-[15px] font-semibold text-[#1D1D1F]">
                        {exhausted
                            ? isFree
                                ? 'Você testou tudo do plano gratuito'
                                : 'Seus créditos de IA acabaram'
                            : warning
                              ? 'Seus créditos de IA estão acabando'
                              : 'Seus créditos de IA'}
                    </h3>
                    {bar}
                    {subLine}
                </div>
                <div className="text-right">
                    <div className="text-[28px] font-extrabold leading-none tracking-tight text-[#1D1D1F]">
                        {creditsRemaining}
                        <span className="ml-1 text-[13px] font-medium text-[#8A8A8E]">
                            {isFree ? 'restantes' : 'créditos'}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    )
}
