'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

/**
 * Update da landing pública do trainer (M4 — campos texto).
 *
 *   Escopo MVP: headline, subheadline, bio, city, cref, certifications[],
 *   specializations[], year_started, price_label.
 *   Stats/testimonials/faq/hero_image_url ficam pra fase 2.
 *
 *   Strings vazias são tratadas como NULL (default semântico: "não
 *   preenchido" → renderiza fallback na landing pública).
 *   Arrays vazios também viram NULL pra evitar `[]` espúrio no DB
 *   (a leitura na landing já trata NULL com defaults).
 */

const ARRAY_MAX = 8

// Exportado pra cobertura em testes (validação isolada do resto da action).
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

export interface UpdateLandingResult {
    success: boolean
    message?: string
}

export function emptyToNull(v: string | null | undefined): string | null {
    if (v === null || v === undefined) return null
    const trimmed = v.trim()
    return trimmed.length === 0 ? null : trimmed
}

export async function updateTrainerLanding(input: UpdateLandingInput): Promise<UpdateLandingResult> {
    const parsed = LANDING_SCHEMA.safeParse(input)
    if (!parsed.success) {
        return { success: false, message: 'Dados inválidos.' }
    }
    const data = parsed.data

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { success: false, message: 'Sessão expirada.' }
    }

    const { data: trainer, error: trainerError } = await supabase
        .from('trainers')
        .select('id, public_slug')
        .eq('auth_user_id', user.id)
        .single()
    if (trainerError || !trainer) {
        return { success: false, message: 'Treinador não encontrado.' }
    }

    const trainerRow = trainer as { id: string; public_slug: string | null }

    /* Normaliza arrays (vazio → null) e strings (vazio → null) */
    const certifications = (data.certifications ?? []).filter((s) => s.trim().length > 0)
    const specializations = (data.specializations ?? []).filter((s) => s.trim().length > 0)

    const patch = {
        landing_headline: emptyToNull(data.headline ?? null),
        landing_subheadline: emptyToNull(data.subheadline ?? null),
        landing_bio: emptyToNull(data.bio ?? null),
        landing_city: emptyToNull(data.city ?? null),
        landing_cref: emptyToNull(data.cref ?? null),
        landing_certifications: certifications.length > 0 ? certifications : null,
        landing_specializations: specializations.length > 0 ? specializations : null,
        landing_year_started: data.yearStarted ?? null,
        landing_price_label: emptyToNull(data.priceLabel ?? null),
    }

    const { error: updateError } = await supabase
        .from('trainers')
        .update(patch as never)
        .eq('id', trainerRow.id)

    if (updateError) {
        console.error('[updateTrainerLanding] error:', updateError)
        return { success: false, message: 'Não foi possível salvar agora.' }
    }

    /* Invalida ISR da landing pública (se já tiver slug) e do editor */
    if (trainerRow.public_slug) {
        revalidatePath(`/com/${trainerRow.public_slug}`)
    }
    revalidatePath('/landing')

    return { success: true }
}
