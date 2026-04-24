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

    const date = new Date(input)
    if (Number.isNaN(date.getTime())) return ''

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

    const date = new Date(input)
    if (Number.isNaN(date.getTime())) return ''

    return new Intl.DateTimeFormat('pt-BR', {
        timeZone: TIMEZONE,
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    }).format(date)
}
