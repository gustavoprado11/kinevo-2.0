/**
 * Executor HITL de tool de escrita — MOBILE (Bearer).
 *
 * Espelha /api/assistant/execute-tool, mas autentica via Bearer token. Toda a
 * lógica de segurança (rate-limit, tier/cota, idempotência, validação, trace,
 * metering) vem do núcleo compartilhado executeConfirmedTool. Surface 'mobile'.
 */
import { NextRequest, NextResponse } from 'next/server'
import { executeConfirmedTool } from '@/lib/assistant/execute-confirmed-tool'
import { assistantErrorResponse } from '@/lib/assistant/errors'
import { resolveTrainerBearer } from '@/lib/assistant/mobile-auth'

export const maxDuration = 60

export async function POST(req: NextRequest) {
    try {
        const trainer = await resolveTrainerBearer(req)
        if (trainer instanceof NextResponse) return trainer

        const body = await req.json().catch(() => null)
        const r = await executeConfirmedTool({
            trainerId: trainer.id,
            toolName: body?.toolName,
            args: body?.args,
            surface: 'mobile',
            idempotencyKey: body?.idempotencyKey,
        })
        return NextResponse.json(r.body, { status: r.status })
    } catch (error) {
        return assistantErrorResponse('trainer/assistant execute-tool', error)
    }
}
