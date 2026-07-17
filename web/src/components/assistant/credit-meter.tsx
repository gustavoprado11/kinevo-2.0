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
import { Sparkles, Coins } from 'lucide-react'
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
    /**
     * Variante "pill" coesa (ícone Coins + texto ACIMA da barra) p/ o header da
     * conversa — uma moldura própria que não "vaza" colada ao topo como o compact.
     */
    pill?: boolean
}

export function CreditMeter({ summary, compact = false, pill = false }: CreditMeterProps) {
    const { tier, creditsUsed, creditsTotal, creditsRemaining, periodEnd, exhausted } = summary

    const pct = creditsTotal > 0 ? Math.min(100, Math.round((creditsUsed / creditsTotal) * 100)) : 0
    const warning = pct > 80
    const days = daysUntil(periodEnd)

    // Esgotado → vermelho; >80% → âmbar; senão violeta (identidade Kinevo).
    const fillStyle: CSSProperties = exhausted
        ? { width: `${pct}%`, background: 'linear-gradient(90deg, #EF4444, #F87171)' }
        : warning
          ? { width: `${pct}%`, background: 'linear-gradient(90deg, #F59E0B, #FBBF6B)' }
          : { width: `${pct}%`, background: 'var(--primary)' }

    const isFree = tier === 'free'
    const unitLabel = 'créditos'
    const renewalLabel = isFree
        ? 'no plano gratuito'
        : days <= 0
          ? 'renova hoje'
          : `renova em ${days} ${days === 1 ? 'dia' : 'dias'}`

    const subLine = (
        <p className="text-[12.5px] text-k-text-secondary dark:text-muted-foreground">
            <b className="font-semibold text-k-text-primary dark:text-foreground [font-variant-numeric:tabular-nums]">
                {creditsUsed.toLocaleString('pt-BR')} de {creditsTotal.toLocaleString('pt-BR')} {unitLabel}
            </b>{' '}
            usados neste ciclo · {renewalLabel}
        </p>
    )

    const bar = (
        <div className="my-2 h-[9px] overflow-hidden rounded-full bg-[#F5F3FF] dark:bg-glass-bg">
            <div className="h-full rounded-full transition-[width] duration-300" style={fillStyle} />
        </div>
    )

    if (pill) {
        return (
            <div
                className="flex items-center gap-[11px] rounded-[12px] border border-k-border-subtle dark:border-k-border-subtle bg-white dark:bg-surface-card px-[14px] py-2 shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
                aria-label={`${creditsUsed} de ${creditsTotal} ${unitLabel} usados`}
            >
                <Coins className="h-4 w-4 shrink-0 text-[#F59E0B]" strokeWidth={1.8} />
                <div className="flex min-w-[172px] flex-col gap-[5px]">
                    <span className="text-[11.5px] text-k-text-tertiary dark:text-muted-foreground">
                        <b className="font-semibold text-k-text-primary dark:text-foreground [font-variant-numeric:tabular-nums]">
                            {creditsUsed.toLocaleString('pt-BR')}
                        </b>{' '}
                        de {creditsTotal.toLocaleString('pt-BR')} {unitLabel} · {renewalLabel}
                    </span>
                    <div className="h-[5px] overflow-hidden rounded-full bg-[#F1F0F5] dark:bg-glass-bg">
                        <div className="h-full rounded-full transition-[width] duration-300" style={fillStyle} />
                    </div>
                </div>
            </div>
        )
    }

    if (compact) {
        return (
            <div aria-label={`${creditsUsed} de ${creditsTotal} ${unitLabel} usados`}>
                {bar}
                {subLine}
            </div>
        )
    }

    return (
        <div className="rounded-[14px] border border-k-border-subtle dark:border-k-border-subtle bg-white dark:bg-surface-card p-[15px_18px] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.12)]">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-[200px] flex-1">
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-[#EDE9FE] dark:bg-violet-500/15 px-2.5 py-1 text-xs font-bold text-primary dark:text-violet-400">
                        <Sparkles className="h-[13px] w-[13px]" strokeWidth={2} />
                        {TIER_LABEL[tier]}
                    </span>
                    <h3 className="mt-2 text-[15px] font-semibold text-k-text-primary dark:text-foreground">
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
                    <div className="text-[28px] font-extrabold leading-none tracking-tight text-k-text-primary dark:text-foreground [font-variant-numeric:tabular-nums]">
                        {creditsRemaining.toLocaleString('pt-BR')}
                        <span className="ml-1 text-[13px] font-medium text-[#8A8A8E] dark:text-muted-foreground/80">
                            {isFree ? 'restantes' : 'créditos'}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    )
}
