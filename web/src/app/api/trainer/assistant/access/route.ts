/**
 * Acesso ao Assistente (MOBILE, Bearer).
 *   GET → { allowed, tier, summary } — o app usa para mostrar/ocultar o modo
 *   Assistente e alimentar o medidor de créditos.
 *
 * allowed = tier ∈ ASSISTANT_TIERS (todos os planos têm o Assistente). O limite
 * por-uso (free: taste; pagos: balde) é aplicado no turno (gateAssistant) e
 * refletido em `summary`. Falha → allowed:false (fail-closed).
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAiTierForTrainer } from '@/lib/auth/get-ai-tier'
import { ASSISTANT_TIERS } from '@/lib/assistant/command-engine'
import { getAiUsageSummary } from '@/lib/ai-usage/usage-summary'
import { resolveTrainerBearer } from '@/lib/assistant/mobile-auth'

export async function GET(req: NextRequest) {
    try {
        const trainer = await resolveTrainerBearer(req)
        if (trainer instanceof NextResponse) return trainer
        const tier = await getAiTierForTrainer(supabaseAdmin, trainer.id)
        // Medidor de créditos do período (mesmo `summary` que volta no fim de cada turno).
        const summary = await getAiUsageSummary(supabaseAdmin, trainer.id).catch(() => null)
        return NextResponse.json({ allowed: ASSISTANT_TIERS.has(tier), tier, summary })
    } catch (error) {
        console.error('[trainer/assistant access GET] error:', error)
        return NextResponse.json({ allowed: false, tier: 'free', summary: null })
    }
}
