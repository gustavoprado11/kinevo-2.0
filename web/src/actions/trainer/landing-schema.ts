import { z } from 'zod'

/**
 * Schema do update da landing pública.
 *
 *   Campos texto (M4): headline, subheadline, bio, city, cref,
 *   certifications[], specializations[], year_started, price_label.
 *   Conteúdo rico (Fase 1): stats, testimonials, faq.
 *   Foto do hero sobe por ação própria (FormData), não aqui.
 *
 *   Mora fora do arquivo com 'use server' porque Next 16 exige que arquivos
 *   marcados como Server Actions só exportem funções async — schemas e
 *   helpers puros precisam de outro módulo.
 */

const ARRAY_MAX = 8
const TESTIMONIALS_MAX = 6
const FAQ_MAX = 10
const PLANS_MAX = 4
const PLAN_FEATURES_MAX = 10

const STATS_SCHEMA = z.object({
    students_count: z.number().int().min(0).max(100000).nullable().optional(),
    rating: z.number().min(0).max(5).nullable().optional(),
    reviews_count: z.number().int().min(0).max(100000).nullable().optional(),
})

const TESTIMONIAL_SCHEMA = z.object({
    name: z.string().trim().min(1).max(80),
    quote: z.string().trim().min(1).max(500),
    role: z.string().trim().max(80).nullable().optional(),
    goal: z.string().trim().max(80).nullable().optional(),
    photo_url: z.string().trim().url().max(500).nullable().optional(),
})

const FAQ_ITEM_SCHEMA = z.object({
    question: z.string().trim().min(1).max(200),
    answer: z.string().trim().min(1).max(800),
})

const PLAN_SCHEMA = z.object({
    name: z.string().trim().min(1).max(60),
    price: z.string().trim().min(1).max(40),
    period: z.string().trim().max(20).nullable().optional(),
    features: z.array(z.string().trim().min(1).max(120)).max(PLAN_FEATURES_MAX),
    highlight: z.boolean().nullable().optional(),
})

export const LANDING_SCHEMA = z.object({
    headline: z.string().trim().max(200).optional().nullable(),
    subheadline: z.string().trim().max(280).optional().nullable(),
    bio: z.string().trim().max(800).optional().nullable(),
    city: z.string().trim().max(80).optional().nullable(),
    cref: z.string().trim().max(40).optional().nullable(),
    certifications: z.array(z.string().trim().min(1).max(80)).max(ARRAY_MAX).optional().nullable(),
    specializations: z.array(z.string().trim().min(1).max(40)).max(ARRAY_MAX).optional().nullable(),
    yearStarted: z.number().int().min(1970).max(new Date().getFullYear()).optional().nullable(),
    priceLabel: z.string().trim().max(80).optional().nullable(),
    stats: STATS_SCHEMA.optional().nullable(),
    testimonials: z.array(TESTIMONIAL_SCHEMA).max(TESTIMONIALS_MAX).optional().nullable(),
    faq: z.array(FAQ_ITEM_SCHEMA).max(FAQ_MAX).optional().nullable(),
    plans: z.array(PLAN_SCHEMA).max(PLANS_MAX).optional().nullable(),
    // Visibilidade de seções: { credenciais, metodo, app, ... } → bool.
    sections: z.record(z.enum([
        'credenciais', 'metodo', 'app', 'depoimentos', 'processo', 'planos', 'faq',
    ]), z.boolean()).optional().nullable(),
})

export type UpdateLandingInput = z.infer<typeof LANDING_SCHEMA>

/** Converte string vazia/whitespace em null; preserva conteúdo trimado. */
export function emptyToNull(v: string | null | undefined): string | null {
    if (v === null || v === undefined) return null
    const trimmed = v.trim()
    return trimmed.length === 0 ? null : trimmed
}
