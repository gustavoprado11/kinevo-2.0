/**
 * Voz do Assistente (Fase C) — turno por voz.
 *
 * Aceita dois formatos de entrada:
 *   - multipart/form-data com um arquivo `audio` (+ `studentId`/`route` opcionais)
 *     → transcreve no servidor (OpenAI) antes do turno;
 *   - application/json `{ input, studentId?, route? }` quando o cliente já fez o
 *     STT on-device (browser/mobile).
 *
 * Em ambos: gate (Pro+ + cota) + rate-limit de turno, depois `runAssistantTurn`
 * com `surface:'voice'` (resposta curta e falável pelo system-prompt v2).
 * Devolve `{ transcript, text, confirmation, executed, credits, summary }`.
 *
 * HITL: assim como nas outras superfícies, ações sensíveis PARAM num
 * `confirmation` — o cliente de voz deve ler o resumo e pedir o "ok" antes de
 * chamar /api/assistant/execute-tool.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { gateAssistant, runAssistantTurn, UUID_RE } from '@/lib/assistant/command-engine'
import { limitTurn } from '@/lib/assistant/rate-limits'
import { transcribeAudio } from '@/lib/assistant/voice'
import { assistantErrorResponse } from '@/lib/assistant/errors'

export const maxDuration = 60

const SURFACE = 'voice' as const
const MAX_INPUT_CHARS = 2000
const MAX_AUDIO_BYTES = 20 * 1024 * 1024 // 20 MB

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

        // 2b. Rate-limit de turno (G6).
        const rl = await limitTurn(trainer.id)
        if (!rl.allowed) {
            return NextResponse.json({ error: 'rate_limited', message: rl.error }, { status: 429 })
        }

        // 3. Gate (Pro+ + cota).
        const gate = await gateAssistant(supabaseAdmin, trainer.id)
        if (!gate.allowed) {
            const { status, ...body } = gate
            return NextResponse.json(body, { status })
        }

        // 4. Extrai input — áudio (transcreve) ou texto (STT do cliente).
        let input = ''
        let route: string | undefined
        let studentId: string | undefined
        let transcribeOnly = false
        const contentType = req.headers.get('content-type') ?? ''

        if (contentType.includes('multipart/form-data')) {
            const form = await req.formData()
            const audio = form.get('audio')
            if (!(audio instanceof Blob)) {
                return NextResponse.json({ error: 'Áudio ausente.' }, { status: 400 })
            }
            if (audio.size === 0 || audio.size > MAX_AUDIO_BYTES) {
                return NextResponse.json({ error: 'Áudio vazio ou grande demais.' }, { status: 400 })
            }
            const r = form.get('route')
            const s = form.get('studentId')
            route = typeof r === 'string' ? r : undefined
            studentId = typeof s === 'string' && UUID_RE.test(s) ? s : undefined
            // transcribeOnly=1 → o composer só quer o texto ditado para revisão; NÃO
            // roda o turno aqui (o turno roda no fluxo normal da conversa/⌘K).
            transcribeOnly = form.get('transcribeOnly') === '1'
            try {
                input = (await transcribeAudio(audio, { filename: (audio as File).name })).slice(0, MAX_INPUT_CHARS)
            } catch (e) {
                console.error('[voice] transcription error:', e)
                return NextResponse.json(
                    { error: 'transcription_failed', message: 'Não consegui entender o áudio. Tente de novo.' },
                    { status: 502 },
                )
            }
        } else {
            const body = await req.json().catch(() => null)
            const rawInput: unknown = body?.input
            input = typeof rawInput === 'string' ? rawInput.trim().slice(0, MAX_INPUT_CHARS) : ''
            route = typeof body?.route === 'string' ? body.route : undefined
            studentId =
                typeof body?.studentId === 'string' && UUID_RE.test(body.studentId) ? body.studentId : undefined
        }

        if (input.length === 0) {
            return NextResponse.json({ error: 'empty_input', message: 'Não captei nenhuma fala.' }, { status: 400 })
        }

        // Só transcrição: devolve o texto ditado sem rodar o turno (o composer
        // preenche o input e o usuário revisa/envia pelo fluxo normal).
        if (transcribeOnly) {
            return NextResponse.json({ transcript: input })
        }

        // 5. Turno por voz (resposta curta/falável vem do system-prompt v2).
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
            transcript: input,
            text: turn.text,
            confirmation: turn.confirmation,
            executed: turn.executed,
            credits: turn.credits,
            summary: turn.summary,
        })
    } catch (error) {
        return assistantErrorResponse('voice POST', error)
    }
}
