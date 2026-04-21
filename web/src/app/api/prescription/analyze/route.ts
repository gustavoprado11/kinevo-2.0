import { NextRequest, NextResponse } from 'next/server'

import { createServerClientFromToken } from '@/lib/supabase/server-from-token'
import { analyzeStudentContext } from '@/actions/prescription/analyze-context'
import { checkPrescriptionRateLimit } from '@/lib/rate-limit/prescription'

/**
 * POST /api/prescription/analyze
 *
 * Thin HTTP wrapper around the server action `analyzeStudentContext`. Used by
 * the mobile app, which authenticates via Supabase JWT (Bearer token) instead
 * of cookies. Mirrors the auth/ownership/rate-limit/feature-flag prelude of
 * `POST /api/prescription/generate` so both endpoints share the same envelope.
 *
 * Body: `{ studentId: string, selectedFormIds?: string[] }`.
 * Returns the full `AnalyzeContextResult` from the server action on 200.
 *
 * Rate limit is shared with /generate via `checkPrescriptionRateLimit` —
 * analyze + generate consume the same upstream LLM budget per trainer, so
 * we don't separate the windows.
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

        const parsed = parseAnalyzeBody(body)
        if (!parsed.ok) {
            return NextResponse.json({ error: parsed.error }, { status: 400 })
        }
        const { studentId, selectedFormIds } = parsed.value

        // 3. Trainer + AI feature flag
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

        // 4. Ownership: student must belong to the calling trainer
        const { data: student } = await supabase
            .from('students')
            .select('id')
            .eq('id', studentId)
            .eq('coach_id', (trainer as { id: string }).id)
            .single()

        if (!student) {
            return NextResponse.json({ error: 'Student not found' }, { status: 404 })
        }

        // 5. Rate limit (shared with /generate)
        const rl = await checkPrescriptionRateLimit(supabase, (trainer as { id: string }).id)
        if (!rl.allowed) {
            return NextResponse.json({ error: rl.error }, { status: rl.status ?? 429 })
        }

        // 6. Delegate. The server action does its own RLS-respecting fetches.
        const result = await analyzeStudentContext(studentId, selectedFormIds ?? [])
        if (!result.success) {
            return NextResponse.json(
                { error: result.error ?? 'Erro ao analisar contexto.' },
                { status: 500 },
            )
        }

        return NextResponse.json(result)
    } catch (error) {
        console.error('[Route/analyze] unexpected error:', error)
        return NextResponse.json(
            { error: 'Erro ao analisar contexto.' },
            { status: 500 },
        )
    }
}

interface AnalyzeBody {
    studentId: string
    selectedFormIds?: string[]
}

type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string }

function parseAnalyzeBody(body: unknown): ParseResult<AnalyzeBody> {
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
    return { ok: true, value: { studentId: b.studentId, selectedFormIds } }
}
