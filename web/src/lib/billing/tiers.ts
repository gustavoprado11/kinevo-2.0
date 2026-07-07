/**
 * Fonte ÚNICA de exibição dos tiers de IA do treinador (Caminho B — escada de 4).
 *
 * Antes, a landing (`landing-pricing.tsx`) e o /settings (`ai-plan-section.tsx`)
 * descreviam o produto de formas DIFERENTES — a landing vendia 1 plano "tudo
 * incluso" enquanto o backend já tinha 4 tiers com cotas distintas (promessa
 * falsa: o `essencial` que o R$39,90 compra é 403 no Assistente). Este módulo
 * centraliza preço/cota/features para que TODA superfície (landing, settings,
 * signup) conte a MESMA história, sempre coerente com o código (PLAN_AI_QUOTA,
 * STUDENT_CAP, gateAssistant por uso).
 *
 * Modelo (decisão Gustavo, jun/2026 — atualizado 26/jun): IA em TODOS os planos,
 * escalada por COTA de créditos. TODOS os pagos têm o Assistente COMPLETO
 * (⌘K + voz + aba /assistente). Únicos perks NÃO-crédito: briefing proativo (Pro+)
 * e suporte exclusivo (Premium).
 *   - free:       1 aluno (você); IA "taste" (25 créditos/mês + 1× cada ação pesada).
 *   - essencial:  alunos ∞ + 20 créditos/mês + Assistente completo (⌘K + voz).
 *   - pro_ia:     alunos ∞ + 300 créditos + Resumo da manhã (briefing proativo).
 *   - premium_ia: alunos ∞ + 1.000 créditos + suporte exclusivo.
 *
 * Os números batem com `lib/ai-usage/quota.ts` (20/300/1000) e `lib/limits/
 * student-cap.ts` (free=1, pagos=∞). O tier→price (Stripe) vive em
 * `lib/auth/get-ai-tier.ts` (priceIdForTier). NÃO mudar as chaves de `tier` nem
 * `creditsPerMonth` sem alinhar PLAN_AI_QUOTA (load-bearing p/ checkout/cota).
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
    /** Landing (marketing): eyebrow curto sob o nome do plano. */
    tagline?: string
    /** Landing: tradução do crédito em trabalho real ("≈ uns 30 treinos montados com a IA"). */
    creditsHint?: string
    /** Landing: nota ao lado do preço (ex.: free "pra sempre"). */
    priceNote?: string
    /** Landing: rodapé do card (ex.: free "Mais de 1 aluno? A partir do Essencial."). */
    footnote?: string
}

export const TIER_DISPLAY: readonly TierDisplay[] = [
    {
        tier: 'free',
        name: 'Free',
        tagline: 'Pra testar com calma',
        price: 'R$ 0',
        priceNote: 'pra sempre',
        monthlyBrl: 0,
        creditsPerMonth: null,
        credits: 'Experimente a IA: 25 créditos/mês',
        free: true,
        cta: 'Começar grátis',
        features: [
            { label: '1 aluno (você, como aluno-teste)' },
            { label: 'Treino, agenda e financeiro' },
            { label: 'App do aluno + Apple Watch' },
        ],
        footnote: 'Mais de 1 aluno? A partir do plano Essencial.',
    },
    {
        tier: 'essencial',
        name: 'Essencial',
        tagline: 'Pra rodar sua carteira',
        price: 'R$ 39,90',
        priceSuffix: '/mês',
        monthlyBrl: 39.9,
        creditsPerMonth: 20,
        credits: 'Alunos ilimitados + 20 créditos de IA/mês',
        creditsHint: '≈ uns 2 treinos montados com a IA',
        cta: 'Assinar Essencial',
        features: [
            { label: 'Alunos ilimitados' },
            { label: 'Treino, agenda e financeiro' },
            { label: 'Assistente de IA completo (⌘K + voz)' },
        ],
    },
    {
        tier: 'pro_ia',
        name: 'Pro IA',
        tagline: 'A IA trabalhando por você',
        price: 'R$ 79,90',
        priceSuffix: '/mês',
        monthlyBrl: 79.9,
        creditsPerMonth: 300,
        credits: 'Alunos ilimitados + 300 créditos de IA/mês',
        creditsHint: '≈ uns 30 treinos montados com a IA',
        featured: true,
        cta: 'Assinar Pro IA',
        features: [
            { label: 'Tudo do Essencial (Assistente completo incluído)' },
            { label: 'Resumo da manhã: briefing proativo' },
        ],
    },
    {
        tier: 'premium_ia',
        name: 'Premium IA',
        tagline: 'Tudo, no automático',
        price: 'R$ 129,90',
        priceSuffix: '/mês',
        monthlyBrl: 129.9,
        creditsPerMonth: 1000,
        credits: 'Alunos ilimitados + 1.000 créditos de IA/mês',
        creditsHint: '≈ uns 100 treinos montados com a IA',
        cta: 'Assinar Premium',
        features: [
            { label: 'Tudo do Pro IA' },
            { label: 'Suporte exclusivo', state: 'star' },
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
