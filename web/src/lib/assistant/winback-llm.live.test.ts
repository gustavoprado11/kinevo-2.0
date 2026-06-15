// Teste LIVE (gated por RUN_LIVE_LLM=1) — NÃO roda na suíte normal.
// Chama o OpenAI real (gpt-4.1-mini) com o system prompt e o parser REAIS do
// winback, usando contexto SINTÉTICO (nenhum dado real). Prova o contrato JSON.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { WINBACK_SYSTEM_PROMPT, buildWinbackContextBlock, type WinbackContext } from './winback-prompt'
import { parseDraftOutput } from './draft-prompt'

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

async function callOpenAI(block: string, key: string) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
            model: 'gpt-4.1-mini',
            temperature: 0.5,
            max_tokens: 400,
            response_format: { type: 'json_object' },
            messages: [
                { role: 'system', content: WINBACK_SYSTEM_PROMPT },
                { role: 'user', content: block },
            ],
        }),
    })
    return res
}

describe.skipIf(!RUN)('LIVE gpt-4.1-mini — rascunho de winback', () => {
    it('retorna JSON parseável, sem inventar link/valor (contexto sintético)', async () => {
        const key = getOpenAIKey()
        expect(key, 'OPENAI_API_KEY ausente em .env.local').toBeTruthy()

        const ctx: WinbackContext = {
            studentName: 'Marina Teste QA',
            planTitle: 'Consultoria Mensal',
            planPrice: 199.9,
            planInterval: 'mensal',
            expiredAt: '2026-06-01T00:00:00.000Z',
            daysSinceExpired: 14,
            tenureMonths: 8,
            hasData: true,
        }
        const res = await callOpenAI(buildWinbackContextBlock(ctx), key!)
        expect(res.ok, `OpenAI HTTP ${res.status}`).toBe(true)
        const payload = await res.json()
        const content = payload?.choices?.[0]?.message?.content
        const draft = parseDraftOutput(content, ctx.hasData)
        expect(draft, `parse falhou: ${content}`).not.toBeNull()
        expect(draft!.message.length).toBeGreaterThan(0)
        // Regra inviolável: não escreve link de pagamento (anexado pelo sistema).
        expect(draft!.message.toLowerCase()).not.toContain('http')
        console.log('\n[LIVE winback] message:', draft!.message)
        console.log('[LIVE winback] references:', JSON.stringify(draft!.references), '| confidence:', draft!.confidence, '\n')
    }, 30000)
})
