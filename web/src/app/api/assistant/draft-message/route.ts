// POST /api/assistant/draft-message
//
// Loop de retenção — camada de AÇÃO. Recebe um insight + aluno, busca o
// contexto factual do aluno, gera UM rascunho de mensagem (gpt-4.1-mini, JSON)
// na voz do treinador e devolve { draft, cost_usd }. NÃO envia — o envio é uma
// ação separada após o treinador editar/aprovar.
//
// Espelha o padrão de auth + rate-limit de /api/assistant/chat.

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { consumeRateLimit } from '@/lib/rate-limit'
import { callLLM, callWithRetry } from '@/lib/prescription/llm-client'
import { buildDraftContext } from '@/lib/assistant/student-context'
import {
    DRAFT_SYSTEM_PROMPT,
    buildContextBlock,
    parseDraftOutput,
    type InsightForDraft,
} from '@/lib/assistant/draft-prompt'

// Pior caso: 2 tentativas × 15s + backoff. Folga para 45s.
export const maxDuration = 45

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(req: Request) {
    try {
        // 1. Auth
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return new Response('Unauthorized', { status: 401 })

        // 2. Resolve trainer
        const { data: trainer } = await supabase
            .from('trainers')
            .select('id, name')
            .eq('auth_user_id', user.id)
            .single()
        if (!trainer) return new Response('Trainer not found', { status: 404 })

        // 3. Rate limit per-trainer (anti cost-amplification)
        const limit = await consumeRateLimit(`assistant:draft:${trainer.id}`, {
            perMinute: 10,
            perDay: 100,
        })
        if (!limit.allowed) {
            return new Response(limit.error || 'Rate limit exceeded', { status: 429 })
        }

        // 4. Validate body
        const body = await req.json().catch(() => null)
        const insightId: string | undefined =
            typeof body?.insight_id === 'string' && UUID_RE.test(body.insight_id)
                ? body.insight_id
                : undefined
        const studentId: string | undefined =
            typeof body?.student_id === 'string' && UUID_RE.test(body.student_id)
                ? body.student_id
                : undefined
        if (!insightId || !studentId) {
            return new Response('insight_id e student_id são obrigatórios', { status: 400 })
        }

        // 5. Load insight scoped to trainer
        const { data: insight } = await supabaseAdmin
            .from('assistant_insights')
            .select('id, title, body, action_type, action_metadata, student_id, insight_key')
            .eq('id', insightId)
            .eq('trainer_id', trainer.id)
            .single()
        if (!insight) return new Response('Insight não encontrado', { status: 404 })
        if (insight.student_id !== studentId) {
            return new Response('Insight não corresponde ao aluno', { status: 403 })
        }

        // 6. Build student context (ownership-checked inside)
        const ctx = await buildDraftContext(supabaseAdmin, trainer.id, studentId)
        if (!ctx) return new Response('Aluno não encontrado', { status: 404 })

        // 7. Generate draft
        const insightForDraft: InsightForDraft = {
            title: insight.title,
            body: insight.body,
            insight_key: insight.insight_key,
            action_metadata: insight.action_metadata,
        }
        const contextBlock = buildContextBlock({
            trainerName: trainer.name,
            insight: insightForDraft,
            ctx,
        })

        const result = await callWithRetry(
            () => callLLM({
                model: 'gpt-4.1-mini',
                system: DRAFT_SYSTEM_PROMPT,
                messages: [{ role: 'user', content: contextBlock }],
                json_object_mode: true,
                max_tokens: 400,
                timeout_ms: 15000,
                temperature: 0.5,
            }),
            { maxAttempts: 2 },
        )

        if (result.status !== 'success' || !result.data) {
            return new Response('Falha ao gerar rascunho', { status: 502 })
        }

        const draft = parseDraftOutput(result.data, ctx.hasData)
        if (!draft) {
            return new Response('Rascunho inválido', { status: 502 })
        }

        // 8. Log usage per trainer (best-effort — o medidor nasce aqui).
        if (result.usage) {
            try {
                await supabaseAdmin
                    // Tabela nova (migration 207) ainda não está nos tipos gerados.
                    .from('assistant_llm_usage' as never)
                    .insert({
                        trainer_id: trainer.id,
                        feature: 'draft_message',
                        model: result.model,
                        input_tokens: result.usage.input_tokens,
                        output_tokens: result.usage.output_tokens,
                        cost_usd: result.usage.cost_usd,
                        insight_id: insightId,
                    } as never)
            } catch (e) {
                console.error('[draft-message] usage log failed:', e)
            }
        }

        // 9. Respond
        return Response.json({
            draft,
            cost_usd: result.usage?.cost_usd ?? 0,
        })
    } catch (e) {
        console.error('[draft-message] unexpected error:', e)
        return new Response('Erro interno', { status: 500 })
    }
}
