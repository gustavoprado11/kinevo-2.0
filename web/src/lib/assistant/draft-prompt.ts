// System prompt + montagem de contexto + parser de saída para o rascunho de
// mensagem do loop de retenção. Mantido separado do route handler para ficar
// testável (lógica pura, sem I/O).

import type { DraftContext } from './student-context'

export type DraftConfidence = 'high' | 'low'

export interface DraftOutput {
    message: string
    references: string[]
    confidence: DraftConfidence
}

export interface InsightForDraft {
    title: string
    body: string
    insight_key: string | null
    action_metadata: unknown
}

// ── System prompt (regras invioláveis: CREF/LGPD) ──

export const DRAFT_SYSTEM_PROMPT = `Você é o assistente de retenção de um personal trainer. Escreva UMA mensagem curta de WhatsApp, em português do Brasil, na VOZ DO TREINADOR (1ª pessoa, "eu"/"você"), para reconectar com o aluno.

REGRAS INVIOLÁVEIS:
- Você PERGUNTA, não conclui. PODE perguntar sobre algo que o aluno relatou (ex.: "vi que marcou energia baixa no último check-in, como você tá?"), mas NUNCA afirma fato médico, diagnóstico ou causa.
- Só referencie o que está no CONTEXTO abaixo. Se o contexto não trouxer um dado concreto, escreva uma mensagem genérica e calorosa — NUNCA invente números, datas, dores, exercícios ou check-ins.
- NÃO prescreva treino, carga, série ou exercício.
- Tom de WhatsApp: 2 a 4 frases, caloroso e direto, sem formalidade.
- Reconecte, não cobre. Convide, não pressione.

SAÍDA: responda SOMENTE com JSON válido, sem markdown:
{
  "message": "<a mensagem pronta para enviar>",
  "references": ["<cada dado do contexto que você usou para ancorar>"],
  "confidence": "high" | "low"
}
Use "confidence": "low" quando o contexto for pobre ou genérico (sem dados concretos do aluno).`

// ── Montagem do bloco de contexto ──

function summarizeAnswers(answers: unknown): string {
    if (answers == null) return '(sem respostas)'
    try {
        const json = JSON.stringify(answers)
        return json.length > 500 ? json.slice(0, 500) + '…' : json
    } catch {
        return '(respostas ilegíveis)'
    }
}

export function buildContextBlock(args: {
    trainerName: string
    insight: InsightForDraft
    ctx: DraftContext
}): string {
    const { trainerName, insight, ctx } = args
    const lines: string[] = []

    lines.push(`Treinador (você): ${trainerName}`)
    lines.push(`Aluno: ${ctx.studentName}`)
    lines.push('')
    lines.push('O QUE O ASSISTENTE DETECTOU:')
    lines.push(`- ${insight.title}`)
    if (insight.body) lines.push(`- ${insight.body}`)
    lines.push('')

    lines.push('PROGRESSO RECENTE (últimos 30 dias):')
    if (ctx.sessionsLast30d > 0) {
        lines.push(`- ${ctx.sessionsLast30d} treino(s) concluído(s)`)
        if (ctx.daysSinceLast != null) {
            lines.push(`- Último treino há ${ctx.daysSinceLast} dia(s)`)
        }
        if (ctx.avgRpe != null) {
            lines.push(`- RPE médio (esforço percebido): ${ctx.avgRpe}`)
        }
    } else if (ctx.daysSinceLast != null) {
        lines.push(`- Sem treinos nos últimos 30 dias (último há ${ctx.daysSinceLast} dia(s))`)
    } else {
        lines.push('- Sem treinos concluídos registrados')
    }
    lines.push('')

    lines.push('CHECK-INS RECENTES:')
    if (ctx.checkins.length > 0) {
        for (const c of ctx.checkins) {
            const when = c.date ? new Date(c.date).toLocaleDateString('pt-BR') : 's/ data'
            lines.push(`- [${when}] ${c.formTitle} (${c.context ?? 'check-in'}): ${summarizeAnswers(c.answers)}`)
        }
    } else {
        lines.push('- Nenhum check-in recente')
    }

    if (!ctx.hasData) {
        lines.push('')
        lines.push('ATENÇÃO: não há dados concretos recentes deste aluno. Escreva uma mensagem genérica e calorosa e use "confidence": "low". NÃO invente dados.')
    }

    return lines.join('\n')
}

// ── Parser da saída do LLM ──

/**
 * Parseia o JSON retornado pelo modelo (json_object mode → string JSON) e valida
 * a forma. Retorna `null` se não houver mensagem utilizável. Força
 * confidence='low' quando não havia dados no contexto, independentemente do que
 * o modelo respondeu (rede de segurança contra "high" otimista sem âncora).
 */
export function parseDraftOutput(raw: string, hasData: boolean): DraftOutput | null {
    let parsed: unknown
    try {
        parsed = JSON.parse(raw)
    } catch {
        return null
    }

    if (typeof parsed !== 'object' || parsed === null) return null
    const obj = parsed as Record<string, unknown>

    const message = typeof obj.message === 'string' ? obj.message.trim() : ''
    if (!message) return null

    const references = Array.isArray(obj.references)
        ? obj.references.filter((r): r is string => typeof r === 'string')
        : []

    const confidence: DraftConfidence =
        !hasData || obj.confidence === 'low' ? 'low' : 'high'

    return { message, references, confidence }
}
