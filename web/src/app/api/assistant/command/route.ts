/**
 * ⌘K Command Bar — handler (Fase 1 · IA do Treinador, Trilha 1).
 *
 * A barra de comando opera a TELA ATUAL: o treinador digita uma intenção em
 * linguagem natural e a IA entende, executa as leituras/ações simples
 * automaticamente e PAUSA nas ações que exigem confirmação humana (HITL),
 * devolvendo um ToolConfirmationRequest que o cliente confirma via
 * POST /api/assistant/execute-tool (já existente).
 *
 * O núcleo do turno (subsetting + tools MCP + HITL + metering) vive em
 * `lib/assistant/command-engine.ts` e é compartilhado com a aba dedicada
 * conversacional (/assistente, surface 'workspace').
 *
 * Gate em 2 níveis (defense-in-depth):
 *   - GET: informa a UI se o tier libera a superfície (Pro+) + medidor de cota.
 *   - POST: revalida tier (Pro+) e cota antes de gastar LLM. Cota esgotada →
 *     402 amigável (a UI degrada pra GUI; nunca trava o app).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAiUsageSummary } from '@/lib/ai-usage/usage-summary'
import { PRO_TIERS, gateAssistant, runAssistantTurn, UUID_RE } from '@/lib/assistant/command-engine'

export const maxDuration = 60

const SURFACE = 'command_bar' as const
const MAX_INPUT_CHARS = 2000

// ----------------------------------------------------------------------------
// GET — acesso/medidor (gate de UI). Não gasta LLM.
// ----------------------------------------------------------------------------
export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { data: trainer } = await supabase
            .from('trainers')
            .select('id')
            .eq('auth_user_id', user.id)
            .single()
        if (!trainer) return NextResponse.json({ error: 'Trainer not found' }, { status: 404 })

        const summary = await getAiUsageSummary(supabaseAdmin, trainer.id)
        return NextResponse.json({
            tier: summary.tier,
            allowed: PRO_TIERS.has(summary.tier),
            summary,
        })
    } catch (error) {
        console.error('[command GET] error:', error)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}

// ----------------------------------------------------------------------------
// POST — entende a intenção, executa o que pode e pausa nas confirmações.
// ----------------------------------------------------------------------------
export async function POST(req: NextRequest) {
    try {
        // 1. Auth
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        // 2. Resolve trainer
        const { data: trainer } = await supabase
            .from('trainers')
            .select('id, name')
            .eq('auth_user_id', user.id)
            .single()
        if (!trainer) return NextResponse.json({ error: 'Trainer not found' }, { status: 404 })

        // 3. Gate (Pro+ + cota) — compartilhado com a aba dedicada.
        const gate = await gateAssistant(supabaseAdmin, trainer.id)
        if (!gate.allowed) {
            const { status, ...body } = gate
            return NextResponse.json(body, { status })
        }

        // 4. Parse + sanitização.
        const body = await req.json().catch(() => null)
        const rawInput: unknown = body?.input
        const input = typeof rawInput === 'string' ? rawInput.trim().slice(0, MAX_INPUT_CHARS) : ''
        if (input.length === 0) {
            return NextResponse.json({ error: 'Comando vazio.' }, { status: 400 })
        }
        const route: string | undefined = typeof body?.route === 'string' ? body.route : undefined
        const studentId: string | undefined =
            typeof body?.studentId === 'string' && UUID_RE.test(body.studentId)
                ? body.studentId
                : undefined

        // 5. Turno (núcleo compartilhado). ⌘K opera a tela atual, sem histórico.
        const turn = await runAssistantTurn({
            admin: supabaseAdmin,
            trainerId: trainer.id,
            trainerName: trainer.name,
            input,
            surface: SURFACE,
            periodType: gate.period,
            route,
            studentId,
        })

        return NextResponse.json({
            text: turn.text,
            confirmation: turn.confirmation,
            executed: turn.executed,
            credits: turn.credits,
            summary: turn.summary,
        })
    } catch (error) {
        console.error('[command POST] error:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal error' },
            { status: 500 },
        )
    }
}
