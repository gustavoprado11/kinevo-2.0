/**
 * Helpers de formatação compartilhados entre listagens de leads
 * (LeadsClient web, dashboard de marketing, futuras telas).
 */

/**
 * Tempo relativo curto em pt-BR.
 *
 *   < 1 min   → "agora"
 *   < 1 h     → "há N min"
 *   < 24 h    → "há Nh"
 *   < 7 dias  → "há Nd"
 *   ≥ 7 dias  → "23 mai"
 *
 * `now` é injetado pra os testes terem determinismo.
 */
export function relativeTime(iso: string, now: number = Date.now()): string {
    const then = new Date(iso).getTime()
    const diff = Math.max(0, now - then)
    const m = Math.floor(diff / 60_000)
    if (m < 1) return 'agora'
    if (m < 60) return `há ${m} min`
    const h = Math.floor(m / 60)
    if (h < 24) return `há ${h}h`
    const d = Math.floor(h / 24)
    if (d < 7) return `há ${d}d`
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

/**
 * Constrói o link `wa.me` com a mensagem inicial pré-preenchida.
 *
 *   - Mantém só dígitos no número.
 *   - Se vier sem DDI, prefixa BR (55).
 *   - Greeting usa o primeiro nome do lead.
 *
 * Não valida tamanho — números inválidos viram links que o WhatsApp rejeita
 * com mensagem clara; melhor isso do que silenciar.
 */
export function whatsappLink(whatsapp: string, firstName: string): string {
    const digits = whatsapp.replace(/\D/g, '')
    const number = digits.length === 11 || digits.length === 10 ? `55${digits}` : digits
    const greeting = `Oi ${firstName}, aqui é da landing — vi que você quer treinar comigo. Bora conversar?`
    return `https://wa.me/${number}?text=${encodeURIComponent(greeting)}`
}
