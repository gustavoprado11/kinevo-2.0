import { NextRequest, NextResponse } from 'next/server'

import { createServerClientFromToken } from '@/lib/supabase/server-from-token'
import { generateProgram } from '@/actions/prescription/generate-program'
import { checkPrescriptionRateLimit } from '@/lib/rate-limit/prescription'
import type { PrescriptionAgentState } from '@kinevo/shared/types/prescription'

/**
 * POST /api/prescription/generate
 *
 * Thin HTTP wrapper around the server action `generateProgram`. Used by the
 * mobile app which authenticates via Supabase JWT (Bearer token) instead of
 * cookies. Mobile inherits smart-v2, retry/fallback, telemetry and the
 * rules-validator automatically because the pipeline lives entirely in the
 * server action.
 *
 * Body (backward compat — Fase 2a):
 *  - `studentId: string` (required).
 *  - `agentState?: PrescriptionAgentState` — optional. When the mobile flow
 *    runs the agent (analyze → questions → generate), it sends back the same
 *    state shape the web's `usePrescriptionAgent` produces. When absent the
 *    server action skips the multi-turn agent path and runs the standard
 *    pipeline, identical to pre-Fase-2a calls.
 *  - `selectedFormIds?: string[]` — optional. Form submissions to inject as
 *    questionnaire context.
 *
 * Route-local responsibilities (kept here intentionally):
 *  - Bearer JWT auth + supabase client injection.
 *  - Trainer lookup + student ownership check (defense in depth; RLS already
 *    covers this but a fast 403/404 avoids the heavier generate pipeline).
 *  - Rate limiting (5/min, 20/day per trainer) — shared with /analyze via
 *    `checkPrescriptionRateLimit`. The two endpoints draw from the same
 *    upstream LLM budget, so they share one window per trainer.
 *  - `outputSnapshot` hydration — the mobile client consumes this field from
 *    the HTTP response to render the preview. The server action returns the
 *    `generationId` only, so we SELECT the row back to expose the snapshot.
 */
export async function POST(request: NextRequest) {
    try {
        // 1. Bearer JWT
        const authHeader = request.headers.get('Authorization')
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Missing authorization' }, { status: 401 })
        }
        const token = authHeader.slice(7)
        const supabase = createServerClientFromToken(token)

        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // 2. Body
        let body: unknown
        try {
            body = await request.json()
        } catch {
            return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
        }

        const parsed = parseGenerateBody(body)
        if (!parsed.ok) {
            return NextResponse.json({ error: parsed.error }, { status: 400 })
        }
        const { studentId, agentState, selectedFormIds } = parsed.value

        // 3. Trainer + ownership
        const { data: trainer } = await supabase
            .from('trainers')
            .select('id, ai_prescriptions_enabled')
            .eq('auth_user_id', user.id)
            .single()

        if (!trainer) {
            return NextResponse.json({ error: 'Trainer not found' }, { status: 403 })
        }
        if (!(trainer as { ai_prescriptions_enabled?: boolean }).ai_prescriptions_enabled) {
            return NextResponse.json({ error: 'AI prescriptions not enabled' }, { status: 403 })
        }
        const trainerId = (trainer as { id: string }).id

        const { data: student } = await supabase
            .from('students')
            .select('id')
            .eq('id', studentId)
            .eq('coach_id', trainerId)
            .single()

        if (!student) {
            return NextResponse.json({ error: 'Student not found' }, { status: 404 })
        }

        // 4. Rate limit (shared with /analyze)
        const rl = await checkPrescriptionRateLimit(supabase, trainerId)
        if (!rl.allowed) {
            return NextResponse.json({ error: rl.error }, { status: rl.status ?? 429 })
        }

        // 5. Delegate to the shared pipeline. When `agentState` is omitted the
        //    behavior matches pre-Fase-2a (`null, []`).
        const result = await generateProgram(
            studentId,
            agentState ?? null,
            selectedFormIds ?? [],
            { supabase },
        )
        if (!result.success || !result.generationId) {
            return NextResponse.json(
                { error: result.error ?? 'Erro ao gerar programa' },
                { status: 500 },
            )
        }

        // 6. Hydrate output_snapshot for the mobile client, which reads
        //    result.outputSnapshot to render the preview. Single read; no retry
        //    because the action just inserted this row on the same connection.
        //    If null comes back, log structured warning and fail loud so the
        //    condition surfaces instead of the mobile freezing at "generating".
        const { data: row } = await supabase
            .from('prescription_generations')
            .select('output_snapshot')
            .eq('id', result.generationId)
            .single()

        const outputSnapshot = (row as { output_snapshot?: unknown } | null)?.output_snapshot ?? null
        if (!outputSnapshot) {
            console.warn(
                `[Route/generate] output_snapshot null after generateProgram succeeded — generationId=${result.generationId} trainerId=${trainerId}`,
            )
            return NextResponse.json(
                { error: 'Geração salva sem snapshot. Contate o suporte.' },
                { status: 500 },
            )
        }

        return NextResponse.json({
            success: true,
            generationId: result.generationId,
            aiMode: result.aiMode,
            source: result.source,
            llmStatus: result.llmStatus,
            outputSnapshot,
            violations: result.violations,
        })
    } catch (error) {
        console.error('[Route/generate] unexpected error:', error)
        return NextResponse.json(
            { error: 'Erro ao gerar programa.' },
            { status: 500 },
        )
    }
}

interface GenerateBody {
    studentId: string
    agentState?: PrescriptionAgentState
    selectedFormIds?: string[]
}

type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string }

function parseGenerateBody(body: unknown): ParseResult<GenerateBody> {
    if (!body || typeof body !== 'object') {
        return { ok: false, error: 'Body must be an object' }
    }
    const b = body as Record<string, unknown>
    if (typeof b.studentId !== 'string' || b.studentId.length === 0) {
        return { ok: false, error: 'studentId is required' }
    }
    let selectedFormIds: string[] | undefined
    if (b.selectedFormIds !== undefined) {
        if (!Array.isArray(b.selectedFormIds) || !b.selectedFormIds.every((x) => typeof x === 'string')) {
            return { ok: false, error: 'selectedFormIds must be an array of strings' }
        }
        selectedFormIds = b.selectedFormIds as string[]
    }
    let agentState: PrescriptionAgentState | undefined
    if (b.agentState !== undefined && b.agentState !== null) {
        const validated = validateAgentState(b.agentState)
        if (!validated.ok) {
            return { ok: false, error: validated.error }
        }
        agentState = validated.value
    }
    return { ok: true, value: { studentId: b.studentId, agentState, selectedFormIds } }
}

const ALLOWED_PHASES: ReadonlyArray<PrescriptionAgentState['phase']> = [
    'analyzing',
    'questions',
    'generating',
    'complete',
]
const ALLOWED_QUESTION_TYPES = ['single_choice', 'multi_choice', 'text'] as const

function validateAgentState(input: unknown): ParseResult<PrescriptionAgentState> {
    if (!input || typeof input !== 'object') {
        return { ok: false, error: 'agentState must be an object' }
    }
    const s = input as Record<string, unknown>

    if (!Array.isArray(s.conversation_messages)) {
        return { ok: false, error: 'agentState.conversation_messages must be an array' }
    }
    for (const m of s.conversation_messages) {
        if (!m || typeof m !== 'object') {
            return { ok: false, error: 'agentState.conversation_messages items must be objects' }
        }
        const mm = m as Record<string, unknown>
        if (mm.role !== 'user' && mm.role !== 'assistant') {
            return { ok: false, error: 'agentState.conversation_messages[].role must be user|assistant' }
        }
        if (typeof mm.content !== 'string') {
            return { ok: false, error: 'agentState.conversation_messages[].content must be a string' }
        }
    }

    if (s.context_analysis !== null && (typeof s.context_analysis !== 'object' || s.context_analysis === undefined)) {
        return { ok: false, error: 'agentState.context_analysis must be an object or null' }
    }

    if (!Array.isArray(s.questions)) {
        return { ok: false, error: 'agentState.questions must be an array' }
    }
    for (const q of s.questions) {
        if (!q || typeof q !== 'object') {
            return { ok: false, error: 'agentState.questions items must be objects' }
        }
        const qq = q as Record<string, unknown>
        if (typeof qq.id !== 'string' || typeof qq.question !== 'string' || typeof qq.context !== 'string') {
            return { ok: false, error: 'agentState.questions items missing id/question/context' }
        }
        if (!ALLOWED_QUESTION_TYPES.includes(qq.type as typeof ALLOWED_QUESTION_TYPES[number])) {
            return { ok: false, error: 'agentState.questions[].type invalid' }
        }
    }

    if (!Array.isArray(s.answers)) {
        return { ok: false, error: 'agentState.answers must be an array' }
    }
    for (const a of s.answers) {
        if (!a || typeof a !== 'object') {
            return { ok: false, error: 'agentState.answers items must be objects' }
        }
        const aa = a as Record<string, unknown>
        if (typeof aa.question_id !== 'string' || typeof aa.answer !== 'string') {
            return { ok: false, error: 'agentState.answers items must have question_id+answer strings' }
        }
    }

    if (!ALLOWED_PHASES.includes(s.phase as PrescriptionAgentState['phase'])) {
        return { ok: false, error: 'agentState.phase invalid' }
    }

    return { ok: true, value: input as PrescriptionAgentState }
}
