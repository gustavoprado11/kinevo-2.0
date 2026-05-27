import { z } from 'zod'

/**
 * Schema do update da landing pública (M4 — campos texto).
 *
 *   Escopo MVP: headline, subheadline, bio, city, cref, certifications[],
 *   specializations[], year_started, price_label.
 *   Stats/testimonials/faq/hero_image_url ficam pra fase 2.
 *
 *   Mora fora do arquivo com 'use server' porque Next 16 exige que arquivos
 *   marcados como Server Actions só exportem funções async — schemas e
 *   helpers puros precisam de outro módulo.
 */

const ARRAY_MAX = 8

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
})

export type UpdateLandingInput = z.infer<typeof LANDING_SCHEMA>

/** Converte string vazia/whitespace em null; preserva conteúdo trimado. */
export function emptyToNull(v: string | null | undefined): string | null {
    if (v === null || v === undefined) return null
    const trimmed = v.trim()
    return trimmed.length === 0 ? null : trimmed
}
