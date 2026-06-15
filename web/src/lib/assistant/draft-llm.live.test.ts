// Teste LIVE (gated por RUN_LIVE_LLM=1) — NÃO roda na suíte normal.
// Chama o OpenAI real (gpt-4.1-mini) com o system prompt e o parser REAIS,
// usando contexto SINTÉTICO (nenhum dado de aluno real → sem exposição LGPD).
// Objetivo: provar que o modelo honra o contrato JSON {message, references, confidence}.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { DRAFT_SYSTEM_PROMPT, buildContextBlock, parseDraftOutput } from './draft-prompt'
import type { DraftContext } from './student-context'

const RUN = process.env.RUN_LIVE_LLM === '1'

function getOpenAIKey(): string | null {
    try {
        const env = readFileSync(resolve(import.meta.dirname, '../../../.env.local'), 'utf8')
        const m = env.match(/^OPENAI_API_KEY=(.+)$/m)
        return m ? m[1].trim().replace(/^["']|["']$/g, '') : null
    } catch {
        return null
    }
}

describe.skipIf(!RUN)('LIVE gpt-4.1-mini — rascunho de retenção', () => {
    it('retorna JSON parseável {message, references, confidence} (contexto sintético)', async () => {
        const key = getOpenAIKey()
        expect(key, 'OPENAI_API_KEY ausente em .env.local').toBeTruthy()

        const ctx: DraftContext = {
            studentName: 'Aluno Teste QA',
            sessionsLast30d: 2,
            lastSessionAt: '2026-06-08T10:00:00.000Z',
            daysSinceLast: 7,
            avgRpe: 6,
            checkins: [{
                date: '2026-06-08T10:00:00.000Z',
                context: 'post_workout',
                formTitle: 'Check-in pós-treino',
                answers: { energia: 2, motivacao: 'baixa' },
            }],
            hasData: true,
        }
        const block = buildContextBlock({
            trainerName: 'Treinador QA',
            insight: { title: 'Aluno Teste QA sem treinar há 7 dias', body: 'Última sessão há uma semana.', insight_key: 'gap_alert:qa', action_metadata: {} },
            ctx,
        })

        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
            body: JSON.stringify({
                model: 'gpt-4.1-mini',
                temperature: 0.5,
                max_tokens: 400,
                response_format: { type: 'json_object' },
                messages: [
                    { role: 'system', content: DRAFT_SYSTEM_PROMPT },
                    { role: 'user', content: block },
                ],
            }),
        })
        expect(res.ok, `OpenAI HTTP ${res.status}`).toBe(true)

        const payload = await res.json()
        const content = payload?.choices?.[0]?.message?.content
        expect(typeof content, 'sem content na resposta').toBe('string')

        const draft = parseDraftOutput(content, ctx.hasData)
        expect(draft, `parseDraftOutput falhou para: ${content}`).not.toBeNull()
        expect(draft!.message.length).toBeGreaterThan(0)
        expect(['high', 'low']).toContain(draft!.confidence)

        console.log('\n[LIVE] message:', draft!.message)
        console.log('[LIVE] references:', JSON.stringify(draft!.references))
        console.log('[LIVE] confidence:', draft!.confidence, '| tokens:', JSON.stringify(payload?.usage), '\n')
    }, 30000)

    it('com contexto pobre, gera mensagem genérica e parseDraftOutput força confidence=low', async () => {
        const key = getOpenAIKey()
        expect(key).toBeTruthy()

        const ctx: DraftContext = {
            studentName: 'Aluno Sem Dados',
            sessionsLast30d: 0,
            lastSessionAt: null,
            daysSinceLast: null,
            avgRpe: null,
            checkins: [],
            hasData: false,
        }
        const block = buildContextBlock({
            trainerName: 'Treinador QA',
            insight: { title: 'Reconectar com o aluno', body: '', insight_key: 'gap_alert:qa2', action_metadata: {} },
            ctx,
        })

        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
            body: JSON.stringify({
                model: 'gpt-4.1-mini',
                temperature: 0.5,
                max_tokens: 400,
                response_format: { type: 'json_object' },
                messages: [
                    { role: 'system', content: DRAFT_SYSTEM_PROMPT },
                    { role: 'user', content: block },
                ],
            }),
        })
        expect(res.ok).toBe(true)
        const payload = await res.json()
        const content = payload?.choices?.[0]?.message?.content
        const draft = parseDraftOutput(content, ctx.hasData)
        expect(draft).not.toBeNull()
        expect(draft!.confidence).toBe('low')
        console.log('\n[LIVE pobre] message:', draft!.message, '| confidence:', draft!.confidence, '\n')
    }, 30000)
})
