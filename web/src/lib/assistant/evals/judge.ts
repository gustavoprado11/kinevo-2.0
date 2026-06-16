/**
 * LLM-as-judge: avalia o TEXTO da resposta do assistente contra uma rubrica.
 *
 * Usado só para o que não dá pra checar deterministicamente (formato, ausência de
 * alucinação, tom). Modelo barato, temperatura 0, saída JSON. Se o juiz falhar
 * (rede/JSON), retorna pass=false com motivo — falha fechada, para não mascarar
 * regressão.
 */

import { generateText } from 'ai'
import { openai } from '@ai-sdk/openai'

export interface JudgeVerdict {
    pass: boolean
    reason: string
}

const JUDGE_MODEL = 'gpt-4.1-mini'

const JUDGE_SYSTEM = `Você é um avaliador rigoroso de respostas de um assistente para personal trainers (app Kinevo).
Receberá um CRITÉRIO, a pergunta do treinador e a resposta do assistente.
Decida se a resposta cumpre o critério. Seja exigente mas justo.
Responda SOMENTE com JSON válido no formato: {"pass": true|false, "reason": "explicação curta"}.`

/** Extrai o primeiro objeto JSON de um texto (o modelo às vezes embrulha em prosa). */
function extractJson(text: string): string {
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start >= 0 && end > start) return text.slice(start, end + 1)
    return text
}

export async function judgeText(
    rubric: string,
    input: string,
    text: string,
): Promise<JudgeVerdict> {
    try {
        const { text: out } = await generateText({
            model: openai(JUDGE_MODEL),
            system: JUDGE_SYSTEM,
            prompt: `CRITÉRIO: ${rubric}\n\nPERGUNTA DO TREINADOR: ${input}\n\nRESPOSTA DO ASSISTENTE:\n${text}\n\nA resposta cumpre o critério?`,
            temperature: 0,
            maxTokens: 200,
        })
        const parsed = JSON.parse(extractJson(out)) as { pass?: unknown; reason?: unknown }
        return {
            pass: parsed.pass === true,
            reason: typeof parsed.reason === 'string' ? parsed.reason : '',
        }
    } catch (e) {
        return { pass: false, reason: `juiz indisponível/JSON inválido: ${e instanceof Error ? e.message : String(e)}` }
    }
}
