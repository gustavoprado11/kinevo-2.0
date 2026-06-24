/**
 * Fonte ÚNICA de exibição dos tiers de IA do treinador (Caminho B — escada de 4).
 *
 * Antes, a landing (`landing-pricing.tsx`) e o /settings (`ai-plan-section.tsx`)
 * descreviam o produto de formas DIFERENTES — a landing vendia 1 plano "tudo
 * incluso" enquanto o backend já tinha 4 tiers com cotas distintas (promessa
 * falsa: o `essencial` que o R$39,90 compra é 403 no Assistente). Este módulo
 * centraliza preço/cota/features para que TODA superfície (landing, settings,
 * signup) conte a MESMA história, sempre coerente com o código (PLAN_AI_QUOTA,
 * STUDENT_CAP, gateAssistant Pro+).
 *
 * Modelo (decisão Gustavo, jun/2026):
 *   - free:       1 aluno (você), IA "1× cada ação" para experimentar.
 *   - essencial:  alunos ∞ + 20 créditos/mês de IA LEVE (rascunhos/winback) —
 *                 SEM o Assistente agêntico (⌘K/voz/canvas são Pro+).
 *   - pro_ia:     alunos ∞ + 300 créditos + Assistente completo (⌘K, briefing…).
 *   - premium_ia: alunos ∞ + 1.000 créditos + voz no mobile + relatórios de IA.
 *
 * Os números batem com `lib/ai-usage/quota.ts` (20/300/1000) e `lib/limits/
 * student-cap.ts` (free=1, pagos=∞). O tier→price (Stripe) vive em
 * `lib/auth/get-ai-tier.ts` (priceIdForTier).
 */

import type { AiTier } from '@/lib/auth/get-ai-tier'

/** Uma linha de feature do card. `off`=indisponível, `star`=destaque premium. */
export interface TierFeature {
    label: string
    state?: 'on' | 'off' | 'star'
}

export interface TierDisplay {
    tier: AiTier
    name: string
    /** Preço formatado para exibição (ex.: 'R$ 39,90'). */
    price: string
    priceSuffix?: string
    /** Valor mensal em BRL (cálculos / JSON-LD). 0 = gratuito. */
    monthlyBrl: number
    /** Cota de crédito/mês (espelha PLAN_AI_QUOTA). null = free (1× cada ação). */
    creditsPerMonth: number | null
    /** Headline curta sob o preço. */
    credits: string
    features: TierFeature[]
    featured?: boolean
    free?: boolean
    /** Rótulo do botão de assinatura. */
    cta: string
}

export const TIER_DISPLAY: readonly TierDisplay[] = [
    {
        tier: 'free',
        name: 'Gratuito',
        price: 'R$ 0',
        monthlyBrl: 0,
        creditsPerMonth: null,
        credits: '1× cada ação de IA, para testar',
        free: true,
        cta: 'Começar grátis',
        features: [
            { label: 'Conhecer o Kinevo' },
            { label: 'Provar a IA uma vez cada ação' },
            { label: 'Adicionar alunos', state: 'off' },
            { label: 'Uso recorrente de IA', state: 'off' },
        ],
    },
    {
        tier: 'essencial',
        name: 'Essencial',
        price: 'R$ 39,90',
        priceSuffix: '/mês',
        monthlyBrl: 39.9,
        creditsPerMonth: 20,
        credits: 'Alunos ilimitados + 20 créditos de IA/mês',
        cta: 'Assinar Essencial',
        features: [
            { label: 'Alunos ilimitados' },
            { label: 'Treinos, agenda, financeiro' },
            { label: 'IA: 20 ações/mês (um gostinho)' },
            { label: '⌘K + UI generativa', state: 'off' },
            { label: 'Briefing & voz', state: 'off' },
        ],
    },
    {
        tier: 'pro_ia',
        name: 'Pro IA',
        price: 'R$ 79,90',
        priceSuffix: '/mês',
        monthlyBrl: 79.9,
        creditsPerMonth: 300,
        credits: 'Alunos ilimitados + 300 créditos de IA/mês',
        featured: true,
        cta: 'Assinar Pro IA',
        features: [
            { label: 'Tudo do Essencial' },
            { label: 'Barra de comando ⌘K' },
            { label: 'Treino/cobrança editáveis pela IA' },
            { label: 'Briefing matinal + fila de aprovação' },
            { label: '300 ações de IA/mês' },
        ],
    },
    {
        tier: 'premium_ia',
        name: 'Premium IA',
        price: 'R$ 129,90',
        priceSuffix: '/mês',
        monthlyBrl: 129.9,
        creditsPerMonth: 1000,
        credits: 'Alunos ilimitados + 1.000 créditos de IA/mês',
        cta: 'Assinar Premium',
        features: [
            { label: 'Tudo do Pro IA' },
            { label: 'Suporte exclusivo', state: 'star' },
            { label: 'Acesso prioritário a novidades', state: 'star' },
            { label: 'Voz no mobile + relatórios de IA' },
            { label: '1.000 ações de IA/mês' },
        ],
    },
]

/** Tiers pagos (essencial/pro/premium) — os que passam pelo checkout. */
export const PAID_TIER_DISPLAY: readonly TierDisplay[] = TIER_DISPLAY.filter((t) => !t.free)

/** Display de um tier por chave. */
export function tierDisplay(tier: AiTier): TierDisplay | undefined {
    return TIER_DISPLAY.find((t) => t.tier === tier)
}

/** Tier pago a partir de um slug de querystring (ex.: ?tier=pro_ia). null se inválido. */
export function paidTierFromParam(value: string | null | undefined): AiTier | null {
    if (!value) return null
    const found = PAID_TIER_DISPLAY.find((t) => t.tier === value)
    return found ? found.tier : null
}
