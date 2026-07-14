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
 *   - GET: informa a UI se o tier tem o Assistente (hoje: todos) + medidor de cota.
 *   - POST: gateAssistant (uso/cota, todos os tiers) antes de gastar LLM. Cota esgotada →
 *     402 amigável (a UI degrada pra GUI; nunca trava o app).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAiUsageSummary } from '@/lib/ai-usage/usage-summary'
import { ASSISTANT_TIERS, gateAssistant, runAssistantTurn, UUID_RE } from '@/lib/assistant/command-engine'
import { limitTurn } from '@/lib/assistant/rate-limits'
import { assistantErrorResponse } from '@/lib/assistant/errors'
import { isAssistantDisabled } from '@/lib/assistant/kill-switch'

export const maxDuration = 300 // build Sonnet pode passar de 60s (C5)

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

        // home_style (migration 210) ainda não está no database.ts gerado → generic
        // explícito no single<T>() para evitar o SelectQueryError do inferidor.
        const { data: trainer } = await supabase
            .from('trainers')
            .select('id, home_style, consultoria_enabled')
            .eq('auth_user_id', user.id)
            .single<{ id: string; home_style: string | null; consultoria_enabled: boolean | null }>()
        if (!trainer) return NextResponse.json({ error: 'Trainer not found' }, { status: 404 })

        const homeStyle = trainer.home_style === 'assistant' ? 'assistant' : 'classic'
        // Beta fechado da Consultoria IA (migration 251). Viaja junto porque as duas
        // sidebars já leem este GET a cada carga — nenhum request novo. Só esconde o
        // item; o gate real é /consultoria + resolveTrainer.
        const consultoriaAllowed = trainer.consultoria_enabled === true

        // Kill-switch: some com as superfícies web (⌘K, aba, sidebar) sem deploy.
        if (isAssistantDisabled()) {
            return NextResponse.json({ tier: 'free', allowed: false, homeStyle, consultoriaAllowed, summary: null })
        }

        const summary = await getAiUsageSummary(supabaseAdmin, trainer.id)
        return NextResponse.json({
            tier: summary.tier,
            allowed: ASSISTANT_TIERS.has(summary.tier),
            homeStyle,
            consultoriaAllowed,
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

        // 2b. Rate-limit de turno (G6) — anti-amplificação de custo.
        const rl = await limitTurn(trainer.id)
        if (!rl.allowed) {
            return NextResponse.json({ error: 'rate_limited', message: rl.error }, { status: 429 })
        }

        // 3. Gate (uso/cota, todos os tiers) — compartilhado com a aba dedicada.
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
            tier: gate.tier,
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
        return assistantErrorResponse('command POST', error)
    }
}
