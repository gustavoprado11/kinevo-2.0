/** Utilitários de UI compartilhados pelo shell/sidebar/home/conversa do Assistente. */

/** Tiles suaves (bg) + iniciais coloridas (fg) — paleta sóbria on-brand Kinevo. */
export const AV_TINTS = [
    { bg: '#EDE9FE', fg: '#6D28D9' }, // violeta (marca)
    { bg: '#EFF6FF', fg: '#2563EB' }, // azul
    { bg: '#ECFDF5', fg: '#15803D' }, // verde
    { bg: '#FFFBEB', fg: '#B45309' }, // âmbar
    { bg: '#FEF2F2', fg: '#BE123C' }, // rosa/erro (uso raro)
    { bg: '#EEF2FF', fg: '#4338CA' }, // índigo
] as const

export function avatarFor(name: string | null): { initials: string; bg: string; fg: string } {
    const n = (name ?? '').trim()
    const initials = n
        ? n.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('')
        : '?'
    let hash = 0
    for (let i = 0; i < n.length; i++) hash = (hash * 31 + n.charCodeAt(i)) >>> 0
    const t = AV_TINTS[hash % AV_TINTS.length]
    return { initials: initials || '?', bg: t.bg, fg: t.fg }
}

function startOfDay(d: Date): number {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

export const GROUP_ORDER = ['Hoje', 'Ontem', 'Semana passada', 'Anteriores'] as const

export function groupLabel(iso: string): string {
    const today = startOfDay(new Date())
    const diff = Math.round((today - startOfDay(new Date(iso))) / 86400000)
    if (diff <= 0) return 'Hoje'
    if (diff === 1) return 'Ontem'
    if (diff <= 7) return 'Semana passada'
    return 'Anteriores'
}

export function timeShort(iso: string): string {
    const d = new Date(iso)
    const today = startOfDay(new Date())
    const day = startOfDay(d)
    if (day === today) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    if (Math.round((today - day) / 86400000) === 1) return 'ontem'
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export function greeting(): string {
    // Fuso fixo: no SSR getHours() é UTC e a saudação sai errada no primeiro paint
    // (mesmo bug do dashboard-header). Espelha o fuso do restante da UI.
    const h = Number(
        new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: 'America/Sao_Paulo' })
            .format(new Date())
    )
    if (h < 12) return 'Bom dia'
    if (h < 18) return 'Boa tarde'
    return 'Boa noite'
}
