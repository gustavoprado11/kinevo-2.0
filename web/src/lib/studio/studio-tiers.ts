/**
 * Estúdios — faixas de billing por nº de alunos (fonte ÚNICA).
 *
 * O estúdio é cobrado na ORGANIZAÇÃO (não por treinador). Treinadores são
 * ilimitados em todas as faixas; o que varia é o teto de alunos. IA fica FORA
 * do preço no v1 ("acesso ≠ IA"). Só mensal.
 *
 * price_id ↔ tier vem de env (mesmo padrão de buildPriceTierMap do solo).
 * O tier resolvido é gravado em organizations.plan_tier pelo webhook, e o teto
 * de alunos deriva do plan_tier (studioLimitForOrg) — não há coluna de limite.
 */

export type StudioTier = 'studio_50' | 'studio_100' | 'studio_200' | 'studio_custom'

export interface StudioTierDisplay {
    tier: StudioTier
    name: string
    /** Teto de alunos do estúdio. Infinity = negociado (studio_custom). */
    studentLimit: number
    /** Valor mensal em BRL (0 = sob consulta). */
    monthlyBrl: number
    /** Preço formatado. */
    price: string
    /** Nome da env com o price_id do Stripe (undefined = não-comprável). */
    priceEnv?: string
    /** true = não passa por checkout (contato). */
    custom?: boolean
    /** Rótulo curto sob o preço. */
    blurb: string
}

export const STUDIO_TIERS: readonly StudioTierDisplay[] = [
    {
        tier: 'studio_50',
        name: 'Studio 50',
        studentLimit: 50,
        monthlyBrl: 219.9,
        price: 'R$ 219,90',
        priceEnv: 'STRIPE_PRICE_STUDIO_50',
        blurb: 'Até 50 alunos · treinadores ilimitados',
    },
    {
        tier: 'studio_100',
        name: 'Studio 100',
        studentLimit: 100,
        monthlyBrl: 379.9,
        price: 'R$ 379,90',
        priceEnv: 'STRIPE_PRICE_STUDIO_100',
        blurb: 'Até 100 alunos · treinadores ilimitados',
    },
    {
        tier: 'studio_200',
        name: 'Studio 200',
        studentLimit: 200,
        monthlyBrl: 649.9,
        price: 'R$ 649,90',
        priceEnv: 'STRIPE_PRICE_STUDIO_200',
        blurb: 'Até 200 alunos · treinadores ilimitados',
    },
    {
        tier: 'studio_custom',
        name: 'Studio 200+',
        studentLimit: Infinity,
        monthlyBrl: 0,
        price: 'Sob consulta',
        custom: true,
        blurb: 'Mais de 200 alunos · fale com a gente',
    },
]

/** Faixas realmente compráveis (com price no Stripe). */
export const PURCHASABLE_STUDIO_TIERS = STUDIO_TIERS.filter(t => !t.custom)

const VALID_TIERS: ReadonlySet<string> = new Set(STUDIO_TIERS.map(t => t.tier))

export function isStudioTier(v: unknown): v is StudioTier {
    return typeof v === 'string' && VALID_TIERS.has(v)
}

export function studioTierDisplay(tier: StudioTier): StudioTierDisplay | undefined {
    return STUDIO_TIERS.find(t => t.tier === tier)
}

/** Mapa price_id → StudioTier, lido de env (só faixas compráveis). */
export function buildStudioPriceTierMap(): Record<string, StudioTier> {
    const map: Record<string, StudioTier> = {}
    for (const t of PURCHASABLE_STUDIO_TIERS) {
        const id = t.priceEnv ? process.env[t.priceEnv] : undefined
        if (id) map[id] = t.tier
    }
    return map
}

/** Deriva o tier a partir do price do Stripe. Null se não mapeado. */
export function studioPriceToTier(priceId: string | null | undefined): StudioTier | null {
    if (!priceId) return null
    return buildStudioPriceTierMap()[priceId] ?? null
}

/** price_id do Stripe para uma faixa comprável. Null se não configurado/custom. */
export function studioPriceIdForTier(tier: StudioTier): string | null {
    const t = studioTierDisplay(tier)
    if (!t?.priceEnv) return null
    return process.env[t.priceEnv] ?? null
}

/**
 * Teto de alunos de uma org a partir do plan_tier gravado.
 * - plan_tier vazio/null (provisionamento manual/comp) → Infinity (ilimitado).
 * - plan_tier de faixa conhecida → o teto da faixa.
 * - plan_tier desconhecido → Infinity (fail-open: nunca bloquear por dado ruim).
 */
export function studioLimitForOrg(planTier: string | null | undefined): number {
    if (!planTier) return Infinity
    const t = studioTierDisplay(planTier as StudioTier)
    return t ? t.studentLimit : Infinity
}
