'use client'

/**
 * AiPlanSection — tela de planos de IA do treinador (Fase 1).
 *
 * Espelha `ai-trainer-pricing-mock.html`: medidor de créditos do ciclo +
 * 4 tiers (Gratuito, Essencial, Pro IA, Premium IA) + legenda de gastos.
 *
 * Client Component: recebe o resumo de uso via prop (data-fetching fica no
 * Server Component pai). Os botões de upgrade fazem POST para o checkout por
 * tier já existente (`/api/stripe/checkout` aceita `{ tier }`). O tier atual é
 * destacado e não tem botão de ação.
 *
 * Reusa o contrato `<CreditMeter>` (não recria o medidor). Estilo Apple HIG
 * light do Kinevo (bg #F5F5F7, violeta #7C3AED, azul #007AFF).
 */

import { useState } from 'react'
import { Check, ArrowRight, Sparkles } from 'lucide-react'
import { CreditMeter } from '@/components/assistant/credit-meter'
import type { AiUsageSummary } from '@/lib/ai-usage/usage-summary'
import type { AiTier } from '@/lib/auth/get-ai-tier'
import { TIER_DISPLAY, type TierFeature } from '@/lib/billing/tiers'

interface AiPlanSectionProps {
    /** null quando a leitura de uso falhou — render degrada (sem medidor). */
    summary: AiUsageSummary | null
}

/** Legenda "como os créditos são gastos" (espelha o mock). */
const CREDIT_LEGEND: readonly string[] = [
    '1 — pergunta / consulta',
    '1 — ação simples (marcar pago, reagendar…)',
    '2–3 — ação composta (cobrar + avisar)',
    '6 — gerar um programa completo',
    '1 por aluno em envio em massa (máx 10)',
]

function FeatureRow({ feature }: { feature: TierFeature }) {
    const state = feature.state ?? 'on'
    return (
        <li className="flex items-start gap-2 border-b border-[#F4F4F6] dark:border-k-border-subtle py-[5px] text-[12.5px] leading-snug last:border-b-0">
            <span
                className={`mt-[1px] flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-full ${
                    state === 'off'
                        ? 'bg-[#EDEDF0] dark:bg-glass-bg text-[#8A8A8E] dark:text-muted-foreground/80'
                        : state === 'star'
                          ? 'bg-[#EDE9FE] dark:bg-violet-500/15 text-[#7C3AED] dark:text-violet-400'
                          : 'bg-[#DCFCE7] dark:bg-emerald-500/15 text-[#15803D] dark:text-emerald-400'
                }`}
            >
                {state === 'off' ? null : state === 'star' ? (
                    <Sparkles className="h-[9px] w-[9px]" strokeWidth={2.5} />
                ) : (
                    <Check className="h-[10px] w-[10px]" strokeWidth={3} />
                )}
            </span>
            <span className={state === 'off' ? 'text-[#8A8A8E] dark:text-muted-foreground/60' : 'text-[#3A3A40] dark:text-foreground/90'}>{feature.label}</span>
        </li>
    )
}

export function AiPlanSection({ summary }: AiPlanSectionProps) {
    const currentTier = summary?.tier ?? 'free'
    const [loadingTier, setLoadingTier] = useState<AiTier | null>(null)
    const [error, setError] = useState<string | null>(null)

    async function handleSubscribe(tier: AiTier) {
        setError(null)
        setLoadingTier(tier)
        try {
            const res = await fetch('/api/stripe/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tier }),
            })
            const json: { url?: string; error?: string } = await res.json()
            if (json.url) {
                window.location.href = json.url
                return
            }
            setError(json.error ?? 'Não foi possível iniciar o checkout.')
        } catch {
            setError('Não foi possível iniciar o checkout. Tente novamente.')
        } finally {
            setLoadingTier(null)
        }
    }

    return (
        <div>
            {/* Medidor de créditos do ciclo (contrato compartilhado). */}
            {summary && (
                <div className="mb-5">
                    <CreditMeter summary={summary} />
                </div>
            )}

            {/* 4 tiers. */}
            <div className="grid grid-cols-1 gap-[13px] sm:grid-cols-2 xl:grid-cols-4">
                {TIER_DISPLAY.map((card) => {
                    const isCurrent = card.tier === currentTier
                    const isLoading = loadingTier === card.tier

                    return (
                        <div
                            key={card.tier}
                            className={`relative flex flex-col rounded-[15px] border bg-white dark:bg-surface-card p-[17px] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.12)] ${
                                card.featured
                                    ? 'border-[#7C3AED] dark:border-violet-500 shadow-[0_0_0_1px_rgba(124,58,237,0.18),0_18px_44px_-26px_rgba(124,58,237,0.5)]'
                                    : 'border-[#E8E8ED] dark:border-k-border-subtle'
                            } ${card.free ? 'bg-[#FBFBFD] dark:bg-surface-card' : ''}`}
                        >
                            {card.featured && (
                                <span className="absolute -top-[10px] left-4 rounded-[7px] bg-gradient-to-br from-[#7C3AED] to-[#A78BFA] px-[10px] py-[3px] text-[9.5px] font-extrabold uppercase tracking-wider text-white">
                                    Recomendado
                                </span>
                            )}
                            {isCurrent && (
                                <span className="absolute -top-[10px] right-[14px] rounded-[7px] border border-[#D2D2D7] dark:border-k-border-primary bg-white dark:bg-surface-elevated px-[9px] py-[3px] text-[9.5px] font-extrabold uppercase tracking-wider text-[#6E6E73] dark:text-muted-foreground">
                                    Plano atual
                                </span>
                            )}

                            <div
                                className={`text-[12px] font-bold tracking-wide ${
                                    card.free ? 'text-[#8A8A8E] dark:text-muted-foreground/80' : 'text-[#7C3AED] dark:text-violet-400'
                                }`}
                            >
                                {card.name.toUpperCase()}
                            </div>

                            <div className="mb-[1px] mt-[5px] text-[26px] font-extrabold tracking-tight text-[#1D1D1F] dark:text-foreground">
                                {card.price}
                                {card.priceSuffix && (
                                    <small className="text-[12px] font-medium text-[#8A8A8E] dark:text-muted-foreground/80">{card.priceSuffix}</small>
                                )}
                            </div>

                            <div className="mb-3 min-h-[34px] text-[12.5px] text-[#6E6E73] dark:text-muted-foreground">{card.credits}</div>

                            <ul className="mb-[14px] flex-1 list-none p-0">
                                {card.features.map((f) => (
                                    <FeatureRow key={f.label} feature={f} />
                                ))}
                            </ul>

                            {isCurrent ? (
                                <span className="block w-full rounded-[11px] bg-[#F5F5F7] dark:bg-glass-bg py-[10px] text-center text-[13px] font-bold text-[#8A8A8E] dark:text-muted-foreground/80">
                                    {card.free ? 'Plano de teste' : 'Seu plano'}
                                </span>
                            ) : card.free ? (
                                <span className="block w-full rounded-[11px] border border-[#D2D2D7] dark:border-k-border-primary bg-white dark:bg-surface-card py-[10px] text-center text-[13px] font-bold text-[#8A8A8E] dark:text-muted-foreground/80">
                                    Plano de teste
                                </span>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => handleSubscribe(card.tier)}
                                    disabled={isLoading || loadingTier !== null}
                                    className={`inline-flex w-full items-center justify-center gap-1.5 rounded-[11px] py-[10px] text-[13px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                                        card.featured
                                            ? 'bg-[#7C3AED] text-white hover:bg-[#6D28D9]'
                                            : 'border border-[#D2D2D7] dark:border-k-border-primary bg-white dark:bg-surface-card text-[#1D1D1F] dark:text-foreground hover:bg-[#F5F5F7] dark:hover:bg-glass-bg'
                                    }`}
                                >
                                    {isLoading ? 'Abrindo…' : card.cta}
                                    {!isLoading && <ArrowRight className="h-[14px] w-[14px]" strokeWidth={2.5} />}
                                </button>
                            )}
                        </div>
                    )
                })}
            </div>

            {error && (
                <p className="mt-3 rounded-[10px] border border-[#FF3B30]/20 bg-[#FF3B30]/5 px-3 py-2 text-[12.5px] text-[#FF3B30]">
                    {error}
                </p>
            )}

            {/* Legenda: como os créditos são gastos. */}
            <div className="mt-5 rounded-[14px] border border-[#E8E8ED] dark:border-k-border-subtle bg-white dark:bg-surface-card p-[15px_18px] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.12)]">
                <h4 className="mb-[10px] text-[13px] font-semibold text-[#1D1D1F] dark:text-foreground">Como os créditos são gastos</h4>
                <div className="flex flex-wrap gap-[9px]">
                    {CREDIT_LEGEND.map((item) => {
                        const [weight, ...rest] = item.split(' — ')
                        return (
                            <span
                                key={item}
                                className="inline-flex items-center gap-2 rounded-[10px] border border-[#E8E8ED] dark:border-k-border-subtle px-[11px] py-[6px] text-[12px] text-[#3A3A40] dark:text-foreground/90"
                            >
                                <b className="font-extrabold text-[#7C3AED] dark:text-violet-400">{weight}</b>
                                {rest.join(' — ')}
                            </span>
                        )
                    })}
                </div>
                <small className="mt-[10px] block text-[11.5px] text-[#8A8A8E] dark:text-muted-foreground/80">
                    Créditos renovam a cada ciclo e não acumulam. Acabou a cota? O resto do Kinevo continua funcionando
                    normalmente — você só perde o atalho da IA até o próximo ciclo.
                </small>
            </div>
        </div>
    )
}
