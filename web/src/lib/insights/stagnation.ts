// Heurística de detecção de estagnação de carga (lógica pura, testável).
//
// Critério acordado com o treinador (jun/2026) para reduzir ruído:
//  - Estagnação = carga máxima no TOPO por >= 4 semanas CONSECUTIVAS (com dados)
//    E sem progresso de repetições nesse período (reps da última semana do platô
//    não maiores que as da primeira). Reps subindo na mesma carga é PROGRESSO,
//    não estagnação.
//  - Exige amostra mínima (>= 4 sessões no exercício) para não disparar com
//    poucos dados.
//  - Ignora acessórios de carga baixa (a carga raramente é a alavanca ali).
//  - Não marca quem já está no topo do range de reps — isso é "ready_to_progress",
//    tratado por outro detector.

export const STAGNATION_MIN_WEEKS = 4
export const STAGNATION_MIN_SESSIONS = 4
export const STAGNATION_MIN_LOAD_KG = 10
export const READY_TO_PROGRESS_TOP_RATIO = 0.7

export interface WeeklyLift {
    /** Início da semana ISO (segunda), YYYY-MM-DD. */
    weekStart: string
    /** Maior carga registrada na semana. */
    maxWeight: number
    /** Melhor (maior) reps registrado nas séries feitas na carga máxima da semana. */
    bestRepsAtMax: number
}

export interface StagnationInput {
    weeks: WeeklyLift[]
    /** Total de sessões distintas do exercício no período (amostra). */
    totalSessions: number
    /** Séries recentes vs. teto prescrito — para excluir "ready_to_progress". */
    recentRepsAtTop?: Array<{ repsCompleted: number; maxPrescribed: number }>
}

export interface StagnationVerdict {
    topWeight: number
    /** Quantas semanas consecutivas no topo (>= STAGNATION_MIN_WEEKS). */
    weeksAtTop: number
}

/**
 * Avalia estagnação para UM par aluno+exercício. Retorna o veredito quando há
 * estagnação real pelos critérios acima, ou `null` caso contrário.
 */
export function evaluateStagnation(input: StagnationInput): StagnationVerdict | null {
    const weeks = [...input.weeks].sort((a, b) => a.weekStart.localeCompare(b.weekStart))

    // Amostra mínima de semanas e de sessões.
    if (weeks.length < STAGNATION_MIN_WEEKS) return null
    if (input.totalSessions < STAGNATION_MIN_SESSIONS) return null

    const topWeight = Math.max(...weeks.map(w => w.maxWeight))

    // Acessório de carga baixa — a carga não é a alavanca; suprime ruído.
    if (topWeight < STAGNATION_MIN_LOAD_KG) return null

    // Run consecutivo mais RECENTE no topWeight (em semanas-com-dados).
    let run = 0
    for (let i = weeks.length - 1; i >= 0; i--) {
        if (weeks[i].maxWeight === topWeight) run++
        else break
    }
    if (run < STAGNATION_MIN_WEEKS) return null

    // Janela do platô = últimas `run` semanas. Reps progredindo → não é estagnação.
    const plateau = weeks.slice(weeks.length - run)
    const firstReps = plateau[0].bestRepsAtMax
    const lastReps = plateau[plateau.length - 1].bestRepsAtMax
    if (lastReps > firstReps) return null

    // Já no topo do range prescrito → é "ready_to_progress", não estagnação.
    if (input.recentRepsAtTop && input.recentRepsAtTop.length > 0) {
        const lastSets = input.recentRepsAtTop.slice(-6)
        const atTopCount = lastSets.filter(s => s.repsCompleted >= s.maxPrescribed).length
        if (atTopCount / lastSets.length >= READY_TO_PROGRESS_TOP_RATIO) return null
    }

    return { topWeight, weeksAtTop: run }
}
