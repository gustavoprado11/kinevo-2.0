/** Utilitários de UI compartilhados pelo shell/sidebar/home/conversa do Assistente. */

export const AV_GRADIENTS = [
    'linear-gradient(135deg,#FF6482,#FF2D92)',
    'linear-gradient(135deg,#0A84FF,#06B6D4)',
    'linear-gradient(135deg,#30D158,#A3E635)',
    'linear-gradient(135deg,#FF9F0A,#FF6482)',
    'linear-gradient(135deg,#7C3AED,#A78BFA)',
    'linear-gradient(135deg,#5E5CE6,#0A84FF)',
] as const

export function avatarFor(name: string | null): { initials: string; bg: string } {
    const n = (name ?? '').trim()
    const initials = n
        ? n.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('')
        : '?'
    let hash = 0
    for (let i = 0; i < n.length; i++) hash = (hash * 31 + n.charCodeAt(i)) >>> 0
    return { initials: initials || '?', bg: AV_GRADIENTS[hash % AV_GRADIENTS.length] }
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
    const h = new Date().getHours()
    if (h < 12) return 'Bom dia'
    if (h < 18) return 'Boa tarde'
    return 'Boa noite'
}
