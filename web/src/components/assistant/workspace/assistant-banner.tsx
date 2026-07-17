'use client'

/**
 * AssistantBanner — feedback de erro/cota na aba /assistente (B2).
 *
 * Espelha o banner do ⌘K (degrada, não trava): a aba carro-chefe não pode mais
 * engolir 402/403/429/422/500 em silêncio. Cota/tier mostram CTA de upgrade;
 * rate-limit/validação só informam. `role="alert"` + `aria-live` p/ leitor de tela.
 */

import Link from 'next/link'
import { AlertTriangle, X, ArrowUpRight } from 'lucide-react'

export interface AssistantBannerData {
    tone: 'warning' | 'error'
    message: string
    /** CTA: use `href` para navegar ou `onClick` para uma ação (ex.: iniciar checkout). */
    cta?: { label: string; href?: string; onClick?: () => void }
}

/** Deriva o banner do envelope de erro das rotas do assistente. */
export function bannerFromError(status: number, data: unknown): AssistantBannerData {
    const d = (data ?? {}) as { error?: string; message?: string; tier?: string }
    const code = d.error
    const message = d.message || d.error
    const isFree = d.tier === 'free'

    // 402 cobre as variações de cota/free-trial das rotas (chat usa
    // 'ai_quota_exhausted'/'free_trial_used'; ⌘K/workspace usam 'quota_exceeded').
    if (
        status === 402 ||
        code === 'quota_exceeded' ||
        code === 'ai_quota_exhausted' ||
        code === 'free_trial_used'
    ) {
        return {
            tone: 'warning',
            message:
                message ||
                (isFree
                    ? 'Você já testou a IA do plano Gratuito. Assine um plano para usar de verdade.'
                    : 'Sua cota de IA deste ciclo acabou. Continue pela interface normal; os créditos renovam em breve.'),
            cta: { label: isFree ? 'Assinar plano' : 'Ver planos', href: '/settings#planos' },
        }
    }
    if (status === 403 || code === 'tier_locked') {
        return {
            tone: 'warning',
            message: message || 'O Assistente com IA não está disponível no seu plano.',
            cta: { label: 'Ver planos', href: '/settings#planos' },
        }
    }
    if (status === 429 || code === 'rate_limited') {
        return { tone: 'warning', message: message || 'Muitas ações em sequência. Tente de novo em alguns instantes.' }
    }
    if (status === 422 || code === 'validation_failed') {
        return { tone: 'error', message: message || 'Não entendi os dados dessa ação. Revise e tente de novo.' }
    }
    return { tone: 'error', message: message || 'Algo deu errado ao falar com o Assistente. Tente novamente.' }
}

export function AssistantBanner({ data, onDismiss }: { data: AssistantBannerData; onDismiss?: () => void }) {
    const warning = data.tone === 'warning'
    const wrap = warning
        ? 'border-[#F0E0BA] dark:border-amber-500/30 bg-[#FEF9ED] dark:bg-amber-500/10'
        : 'border-[#F5C2C0] dark:border-rose-500/30 bg-[#FEF2F2] dark:bg-rose-500/10'
    const icon = warning ? 'text-[#B45309] dark:text-amber-300' : 'text-[#BE123C] dark:text-rose-300'
    const text = warning ? 'text-[#92580C] dark:text-amber-200' : 'text-[#9F1239] dark:text-rose-200'
    const ctaClass =
        'inline-flex shrink-0 items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-[11.5px] font-semibold text-primary-foreground transition hover:opacity-90'

    return (
        <div
            role="alert"
            aria-live="assertive"
            className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 ${wrap}`}
        >
            <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${icon}`} strokeWidth={2} />
            <p className={`flex-1 text-[12.5px] leading-snug ${text}`}>{data.message}</p>
            {data.cta &&
                (data.cta.onClick ? (
                    <button type="button" onClick={data.cta.onClick} className={ctaClass}>
                        {data.cta.label} <ArrowUpRight className="h-3 w-3" strokeWidth={2.5} />
                    </button>
                ) : (
                    <Link href={data.cta.href ?? '#'} className={ctaClass}>
                        {data.cta.label} <ArrowUpRight className="h-3 w-3" strokeWidth={2.5} />
                    </Link>
                ))}
            {onDismiss && (
                <button
                    type="button"
                    onClick={onDismiss}
                    aria-label="Dispensar aviso"
                    className={`shrink-0 rounded p-0.5 transition hover:opacity-70 ${icon}`}
                >
                    <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                </button>
            )}
        </div>
    )
}
