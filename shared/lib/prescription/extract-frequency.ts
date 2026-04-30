// Extração de dia da semana embutido no nome do workout.
// Exs.: "Superior A - segunda" → name="Superior A", frequency=['mon']
//       "Push A: mon, wed, fri" → name="Push A", frequency=['mon','wed','fri']
//       "Treino A - foco peito" → name="Treino A - foco peito", frequency=[]

export const DAY_KEY_BY_TOKEN: Record<string, string> = {
    // PT-BR (sem acentos — comparamos após NFD strip)
    'segunda': 'mon', 'segundafeira': 'mon', 'seg': 'mon', '2a': 'mon',
    'terca': 'tue', 'tercafeira': 'tue', 'ter': 'tue', '3a': 'tue',
    'quarta': 'wed', 'quartafeira': 'wed', 'qua': 'wed', '4a': 'wed',
    'quinta': 'thu', 'quintafeira': 'thu', 'qui': 'thu', '5a': 'thu',
    'sexta': 'fri', 'sextafeira': 'fri', 'sex': 'fri', '6a': 'fri',
    'sabado': 'sat', 'sab': 'sat',
    'domingo': 'sun', 'dom': 'sun',
    // EN
    'monday': 'mon', 'mon': 'mon',
    'tuesday': 'tue', 'tue': 'tue', 'tues': 'tue',
    'wednesday': 'wed', 'wed': 'wed',
    'thursday': 'thu', 'thu': 'thu', 'thur': 'thu', 'thurs': 'thu',
    'friday': 'fri', 'fri': 'fri',
    'saturday': 'sat', 'sat': 'sat',
    'sunday': 'sun', 'sun': 'sun',
}

export function normalizeDayToken(s: string): string {
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/-/g, '')
}

/**
 * Tenta extrair dia(s) da semana do nome do workout. Só dispara quando o
 * sufixo após " - " / " – " / " — " / ":" / "(...)" é COMPOSTO APENAS POR
 * dias (separados por vírgula, "/", "e", "and"). Se há um único token que
 * não é dia, devolve o nome original — preserva semântica de "Treino A -
 * foco peito".
 */
export function extractFrequencyFromName(name: string): { name: string; frequency: string[] } {
    const trimmed = name.trim()
    let prefix: string | null = null
    let suffix: string | null = null
    const dashMatch = trimmed.match(/^(.+?)\s*[-–—:]\s*(.+)$/)
    const parenMatch = trimmed.match(/^(.+?)\s*\(\s*(.+?)\s*\)\s*$/)
    if (dashMatch) {
        prefix = dashMatch[1]
        suffix = dashMatch[2]
    } else if (parenMatch) {
        prefix = parenMatch[1]
        suffix = parenMatch[2]
    }
    if (!prefix || !suffix) return { name: trimmed, frequency: [] }

    const rawTokens = suffix
        .split(/[,/]+|\se\s|\sand\s|\s+/)
        .map(t => normalizeDayToken(t))
        .filter(Boolean)

    if (rawTokens.length === 0) return { name: trimmed, frequency: [] }

    const days: string[] = []
    for (const tok of rawTokens) {
        const day = DAY_KEY_BY_TOKEN[tok]
        if (!day) {
            return { name: trimmed, frequency: [] }
        }
        if (!days.includes(day)) days.push(day)
    }

    return { name: prefix.trim(), frequency: days }
}
