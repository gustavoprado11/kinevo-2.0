import { z } from 'zod'

/**
 * Schema do submit público de lead (landing /com/[slug] → trainer_leads).
 *
 * Mora fora da action porque actions com `'use server'` arrastam o
 * supabaseAdmin (que precisa de SUPABASE_SERVICE_ROLE_KEY) só em
 * tempo de import — impossível cobrir o schema isoladamente sem env.
 */
export const LEAD_SCHEMA = z.object({
    slug: z.string().min(3).max(40),
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().email().max(200),
    whatsapp: z.string().trim().min(8).max(30),
    goal: z.string().trim().max(50).nullable().optional(),
    level: z.string().trim().max(50).nullable().optional(),
    message: z.string().trim().max(1000).nullable().optional(),
    hp: z.string().max(200).optional(),
})

export type LeadSchemaInput = z.infer<typeof LEAD_SCHEMA>
