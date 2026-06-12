// Padrões de movimento (coluna `movement_pattern` em `exercises`).
// Rótulos PT + ordem canônica, usados para filtrar e agrupar a biblioteca de
// exercícios por Padrão de Movimento. Os 4 últimos (mobility/locomotion/jump/
// integrated) foram adicionados na migration 189 para treino funcional.

export const MOVEMENT_PATTERN_LABELS: Record<string, string> = {
    squat: 'Agachamento',
    hinge: 'Dobradiça',
    lunge: 'Afundo',
    push_h: 'Empurrar horizontal',
    push_v: 'Empurrar vertical',
    pull_h: 'Puxar horizontal',
    pull_v: 'Puxar vertical',
    core: 'Core',
    isolation: 'Isolado',
    mobility: 'Mobilidade',
    locomotion: 'Deslocamento',
    jump: 'Salto',
    integrated: 'Integrado',
    carry: 'Transporte',
}

export const NO_PATTERN_LABEL = 'Sem padrão'

// Ordem de exibição (sequência lógica de treino).
export const MOVEMENT_PATTERN_ORDER: string[] = [
    'squat', 'hinge', 'lunge', 'push_h', 'push_v', 'pull_h', 'pull_v',
    'core', 'isolation', 'mobility', 'locomotion', 'jump', 'integrated', 'carry',
]

/** Rótulo PT de um padrão; null/desconhecido caem em "Sem padrão". */
export function patternLabel(key?: string | null): string {
    if (!key) return NO_PATTERN_LABEL
    return MOVEMENT_PATTERN_LABELS[key] ?? key
}

const LABEL_ORDER: string[] = MOVEMENT_PATTERN_ORDER.map(k => MOVEMENT_PATTERN_LABELS[k])

/** Ordena rótulos pela sequência canônica; "Sem padrão" sempre por último. */
export function sortPatternLabels(labels: string[]): string[] {
    const idx = (l: string) => {
        if (l === NO_PATTERN_LABEL) return 999
        const i = LABEL_ORDER.indexOf(l)
        return i === -1 ? 998 : i
    }
    return [...labels].sort((a, b) => idx(a) - idx(b))
}
