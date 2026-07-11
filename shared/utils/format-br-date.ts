/**
 * Format BR Date — formatadores seguros contra o timezone-shift bug
 *
 * O problema que este módulo resolve:
 *
 *   new Date('2026-04-28').toLocaleDateString('pt-BR', {
 *       timeZone: 'America/Sao_Paulo',
 *   })
 *   // => '27/04/2026'  ← shiftou 1 dia pra trás
 *
 * Porque `new Date('YYYY-MM-DD')` interpreta a string como **UTC 00:00**, e
 * America/Sao_Paulo (UTC−3) projeta pro dia anterior (21:00 do dia -1).
 *
 * Solução: quando a string bate o pattern `YYYY-MM-DD` (date-only), fazemos
 * parse manual sem criar `Date` nenhum. Pra ISO completa (com `T` e hora),
 * continuamos delegando ao `toLocaleDateString` — que aí sim deve respeitar
 * o timezone da conversão.
 */

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

const TIMEZONE = 'America/Sao_Paulo'

const NOON_MS = 12 * 60 * 60 * 1000

/**
 * Resolve um valor de data vindo do banco num `Date` seguro pra formatar com
 * qualquer Intl/`toLocaleDateString`, SEM shift de dia:
 *
 * - `"YYYY-MM-DD"` (date-only) → ancorado ao MEIO-DIA UTC. O dia do calendário
 *   fica idêntico em qualquer fuso entre UTC−11 e UTC+11.
 * - ISO exatamente à MEIA-NOITE UTC (ex.: `2026-09-15T00:00:00+00:00`) →
 *   é a convenção de valor "ancorado em data" (Asaas grava
 *   `new Date(payment.dueDate)` com dueDate `YYYY-MM-DD`); re-ancoramos ao
 *   meio-dia UTC pelo mesmo motivo. Sem isto, exibir em BRT mostra o dia
 *   anterior ("vence 14/set" para vencimento 15/set).
 * - ISO com hora real → passa intacto (timestamp de verdade, ex.: Stripe).
 * - Inválido/vazio → `null`.
 */
export function parseAnchoredDate(input: string): Date | null {
    if (!input) return null

    if (DATE_ONLY_PATTERN.test(input)) {
        return new Date(`${input}T12:00:00Z`)
    }

    const date = new Date(input)
    if (Number.isNaN(date.getTime())) return null

    const isUtcMidnight =
        date.getUTCHours() === 0 &&
        date.getUTCMinutes() === 0 &&
        date.getUTCSeconds() === 0 &&
        date.getUTCMilliseconds() === 0
    if (isUtcMidnight) {
        return new Date(date.getTime() + NOON_MS)
    }

    return date
}

/**
 * Formata como "DD/MM".
 *
 * - Se `input` é "YYYY-MM-DD": retorna dia/mês direto do split, sem criar Date.
 * - Se `input` é ISO com hora (ex: "2026-04-28T12:00:00Z"): converte pra TZ
 *   São Paulo e formata. Comportamento "esperado" de timestamp real.
 * - Se `input` é inválido ou string vazia: retorna string vazia.
 */
export function formatBrDateShort(input: string): string {
    if (!input) return ''

    if (DATE_ONLY_PATTERN.test(input)) {
        const [, month, day] = input.split('-')
        return `${day}/${month}`
    }

    const date = parseAnchoredDate(input)
    if (!date) return ''

    return new Intl.DateTimeFormat('pt-BR', {
        timeZone: TIMEZONE,
        day: '2-digit',
        month: '2-digit',
    }).format(date)
}

/**
 * Formata como "DD/MM/YYYY".
 *
 * Mesmas regras de `formatBrDateShort`: date-only via split manual, ISO via
 * DateTimeFormat com timezone São Paulo.
 */
export function formatBrDate(input: string): string {
    if (!input) return ''

    if (DATE_ONLY_PATTERN.test(input)) {
        const [year, month, day] = input.split('-')
        return `${day}/${month}/${year}`
    }

    const date = parseAnchoredDate(input)
    if (!date) return ''

    return new Intl.DateTimeFormat('pt-BR', {
        timeZone: TIMEZONE,
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    }).format(date)
}
