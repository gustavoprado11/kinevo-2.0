// System prompt + montagem de contexto para o rascunho de WINBACK (plano
// expirado). Reaproveita o parser/validador do retention (parseDraftOutput).
// Lógica pura — sem I/O — para ficar testável.

export interface WinbackContext {
    studentName: string
    planTitle: string | null
    /** Valor do plano em BRL (number) — só para o contexto humano, não p/ inventar cobrança. */
    planPrice: number | null
    /** Intervalo do plano (month/quarter/year…) em linguagem natural. */
    planInterval: string | null
    /** Data de expiração (ISO) do contrato. */
    expiredAt: string | null
    /** Dias desde a expiração (>=0) ou null. */
    daysSinceExpired: number | null
    /** Há quanto tempo era aluno (meses) ou null. */
    tenureMonths: number | null
    /** false quando faltam dados concretos → mensagem genérica + confidence 'low'. */
    hasData: boolean
}

export const WINBACK_SYSTEM_PROMPT = `Você é o assistente do personal trainer escrevendo UMA mensagem curta de WhatsApp (PT-BR), na VOZ DO TREINADOR (1ª pessoa, "eu"/"você"), para reconectar com um aluno cujo plano expirou e convidá-lo a voltar.

REGRAS INVIOLÁVEIS:
- Tom caloroso e pessoal, 2 a 4 frases. Convida, NÃO pressiona; reconecta, não cobra.
- Referencie só o que está no CONTEXTO (nome do plano, há quanto tempo treinava). Sem dado concreto → mensagem genérica e calorosa. NUNCA invente valores, datas ou histórico.
- NÃO escreva link de pagamento nem o valor da cobrança — o link é anexado depois pelo sistema, se o treinador escolher.
- NÃO afirme fato médico nem prescreva treino.

SAÍDA: responda SOMENTE com JSON válido, sem markdown:
{
  "message": "<a mensagem pronta para enviar>",
  "references": ["<cada dado do contexto que você usou para ancorar>"],
  "confidence": "high" | "low"
}
Use "confidence": "low" quando o contexto for pobre ou genérico.`

export function buildWinbackContextBlock(ctx: WinbackContext): string {
    const lines: string[] = []
    lines.push(`Aluno: ${ctx.studentName}`)
    lines.push('')
    lines.push('SITUAÇÃO: o plano dele expirou e queremos convidá-lo a retomar.')
    if (ctx.planTitle) lines.push(`- Plano: ${ctx.planTitle}`)
    if (ctx.planInterval) lines.push(`- Ciclo do plano: ${ctx.planInterval}`)
    if (ctx.expiredAt) {
        const when = new Date(ctx.expiredAt).toLocaleDateString('pt-BR')
        lines.push(`- Expirou em: ${when}${ctx.daysSinceExpired != null ? ` (há ${ctx.daysSinceExpired} dia(s))` : ''}`)
    }
    if (ctx.tenureMonths != null && ctx.tenureMonths > 0) {
        lines.push(`- Era aluno há cerca de ${ctx.tenureMonths} mês(es)`)
    }

    if (!ctx.hasData) {
        lines.push('')
        lines.push('ATENÇÃO: poucos dados concretos. Escreva uma mensagem genérica e calorosa e use "confidence": "low". NÃO invente dados.')
    }

    return lines.join('\n')
}
