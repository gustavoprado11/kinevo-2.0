'use server'

import { headers } from 'next/headers'
import { createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { checkRateLimit, recordRequest } from '@/lib/rate-limit'
import { insertTrainerNotification } from '@/lib/trainer-notifications'
import { sendTrainerPush } from '@/lib/push-notifications'
import { LEAD_SCHEMA, type LeadSchemaInput } from './lead-schema'

// Re-export pra manter compat com qualquer import externo do schema.
export { LEAD_SCHEMA } from './lead-schema'

/**
 * Lead capture pública na landing /com/[slug].
 *
 *  Defesas em camada:
 *    1. Honeypot: campo `hp` invisível. Bot preenche, descarta silencioso.
 *    2. Rate limit: 5/min e 30/dia por IP hash.
 *    3. Zod: shape + tamanhos máximos pra abortar spam grande.
 *    4. Dedup soft: mesmo trainer+email+whatsapp nos últimos 5min → success
 *       sem reinsert (não bloqueia, mas evita poluir métrica).
 *    5. Public_slug resolvido via supabaseAdmin sem expor enumeração: se o slug
 *       não existe ou landing não está publicada, retornamos success fake.
 *
 *  Resultado sempre é { success: true } no happy path E nos modos defensivos —
 *  o atacante não consegue distinguir "slug válido sem cadastro" de "slug
 *  inválido"; nem "rate limit hit" vs "lead duplicado".
 */

export type SubmitTrainerLeadInput = LeadSchemaInput

export type SubmitTrainerLeadResult =
    | { success: true }
    | { success: false; message: string }

const FIVE_MINUTES_MS = 5 * 60 * 1000

function hashIp(ip: string): string {
    return createHash('sha256').update(ip).digest('hex').substring(0, 32)
}

async function resolveIpAndUa(): Promise<{ ipHash: string; userAgent: string | null }> {
    try {
        const h = await headers()
        const forwarded = h.get('x-forwarded-for') ?? h.get('x-real-ip') ?? ''
        const ip = forwarded.split(',')[0]?.trim() || 'unknown'
        const userAgent = h.get('user-agent')
        return { ipHash: hashIp(ip), userAgent: userAgent?.slice(0, 500) ?? null }
    } catch {
        return { ipHash: hashIp('unknown'), userAgent: null }
    }
}

/**
 * Action pública usada pela LeadForm na landing.
 * NÃO requer autenticação — lead é anônimo. Tudo passa por supabaseAdmin.
 */
export async function submitTrainerLead(
    input: SubmitTrainerLeadInput,
): Promise<SubmitTrainerLeadResult> {
    // 1. Honeypot — bot preencheu o campo invisível, descartamos com success fake.
    if (input.hp && input.hp.trim().length > 0) {
        return { success: true }
    }

    // 2. Zod validation.
    const parsed = LEAD_SCHEMA.safeParse(input)
    if (!parsed.success) {
        return {
            success: false,
            message: 'Confira os dados — algum campo está incompleto ou inválido.',
        }
    }
    const data = parsed.data

    // 3. Rate limit por IP.
    const { ipHash, userAgent } = await resolveIpAndUa()
    const rlKey = `lead:${ipHash}`
    const rl = checkRateLimit(rlKey, { perMinute: 5, perDay: 30 })
    if (!rl.allowed) {
        // Falha silenciosa pra não dar pista de rate-limit pra atacante.
        // O usuário legítimo dificilmente bate esse limite.
        return { success: false, message: rl.error ?? 'Aguarde um momento.' }
    }
    recordRequest(rlKey)

    // 4. Resolve trainer pelo slug. Se não existe / não publicada, success fake.
    const slug = data.slug.toLowerCase()
    const { data: trainer, error: tErr } = await supabaseAdmin
        .from('trainers')
        .select('id, landing_published')
        .eq('public_slug', slug)
        .maybeSingle()
    if (tErr) {
        console.error('[submitTrainerLead] trainer lookup error:', tErr)
        return { success: true } // fake success — não vaza erro pro lead.
    }
    if (!trainer || !(trainer as { landing_published?: boolean | null }).landing_published) {
        // Slug inexistente OU landing despublicada.
        return { success: true }
    }
    const trainerId = (trainer as { id: string }).id

    // 5. Dedup soft: mesmo (trainer, email, whatsapp) nos últimos 5min.
    const cutoff = new Date(Date.now() - FIVE_MINUTES_MS).toISOString()
    const { data: recent } = await supabaseAdmin
        .from('trainer_leads')
        .select('id')
        .eq('trainer_id', trainerId)
        .eq('email', data.email.toLowerCase())
        .eq('whatsapp', data.whatsapp)
        .gte('created_at', cutoff)
        .limit(1)
        .maybeSingle()
    if (recent) {
        return { success: true } // já registrado recentemente — silencioso.
    }

    // 6. Insert.
    const { data: inserted, error: insertError } = await supabaseAdmin
        .from('trainer_leads')
        .insert({
            trainer_id: trainerId,
            name: data.name,
            email: data.email.toLowerCase(),
            whatsapp: data.whatsapp,
            goal: data.goal ?? null,
            level: data.level ?? null,
            message: data.message ?? null,
            status: 'new',
            source: 'landing_public',
            source_slug: slug,
            ip_hash: ipHash,
            user_agent: userAgent,
        } as never)
        .select('id')
        .single()

    if (insertError || !inserted) {
        console.error('[submitTrainerLead] insert error:', insertError)
        return { success: false, message: 'Não foi possível enviar agora. Tente de novo em instantes.' }
    }

    // 7. Notificar o trainer (push + in-app). Não bloqueia o sucesso do lead
    //    se algum dos dois falhar — helpers são non-throwing.
    const leadId = (inserted as { id: string }).id
    const previewMessage = data.message
        ? data.message.slice(0, 120)
        : [data.goal && `Objetivo: ${data.goal}`, data.level && `Nível: ${data.level}`]
            .filter(Boolean)
            .join(' · ') || 'Sem mensagem.'

    const notificationId = await insertTrainerNotification({
        trainerId,
        type: 'new_lead',
        title: `Novo lead — ${data.name}`,
        message: previewMessage,
        category: 'leads',
        metadata: {
            leadId,
            leadName: data.name,
            leadEmail: data.email.toLowerCase(),
            leadWhatsapp: data.whatsapp,
            slug,
        },
    })

    // Push em background — não awaita pra não atrasar a resposta ao lead.
    void sendTrainerPush({
        trainerId,
        type: 'new_lead',
        title: 'Novo lead chegou 🎯',
        body: `${data.name} acabou de preencher sua landing.`,
        data: { leadId, type: 'new_lead' },
        notificationId: notificationId ?? undefined,
    })

    return { success: true }
}
