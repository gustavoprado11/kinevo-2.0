/**
 * Executor HITL de tool de escrita (Fase 0 — IA do Treinador).
 *
 * Caminho de confirmação: as CONFIRM_TOOLS chegam ao cliente SEM `execute`
 * (ver mcp-bridge), o cliente renderiza o card e, ao confirmar, chama este
 * endpoint com { toolName, args }. A auth é por cookie (web); toda a lógica de
 * segurança (rate-limit, tier/cota, idempotência, validação, trace, metering)
 * vive em executeConfirmedTool — fonte única compartilhada com a rota mobile.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { executeConfirmedTool } from '@/lib/assistant/execute-confirmed-tool'
import { assistantErrorResponse } from '@/lib/assistant/errors'

export const maxDuration = 60

export async function POST(req: NextRequest) {
    try {
        // 1. Auth (cookie)
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        // 2. Resolve trainer
        const { data: trainer } = await supabase
            .from('trainers')
            .select('id')
            .eq('auth_user_id', user.id)
            .single()
        if (!trainer) return NextResponse.json({ error: 'Trainer not found' }, { status: 404 })

        // 3. Executa via núcleo compartilhado (defense-in-depth lá dentro).
        const body = await req.json().catch(() => null)
        const r = await executeConfirmedTool({
            trainerId: trainer.id,
            toolName: body?.toolName,
            args: body?.args,
            surface: body?.surface,
            idempotencyKey: body?.idempotencyKey,
        })
        return NextResponse.json(r.body, { status: r.status })
    } catch (error) {
        return assistantErrorResponse('execute-tool', error)
    }
}
