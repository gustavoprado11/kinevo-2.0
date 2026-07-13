// ============================================================================
// exercise-history — histórico de execução de um exercício (últimas N sessões)
// ============================================================================
// Transforma as linhas cruas do RPC `get_exercise_history` (uma por série) no
// que as telas mostram: sessões agrupadas, melhor carga, última execução e a
// variação entre as duas últimas. Puro — a Sala de Treino e a tela do aluno
// consomem o mesmo resultado.

/** Linha crua do RPC: uma série de uma sessão. */
export interface ExerciseHistoryRow {
    session_id: string
    completed_at: string | null
    workout_name: string | null
    set_number: number
    /** `numeric` do Postgres chega como string no supabase-js. */
    weight: number | string | null
    reps: number | null
}

export interface ExerciseHistorySet {
    setNumber: number
    weight: number
    reps: number
}

export interface ExerciseHistorySession {
    sessionId: string
    completedAt: string | null
    workoutName: string | null
    sets: ExerciseHistorySet[]
    /** Série mais pesada da sessão (empate na carga → a de mais reps). */
    topSet: ExerciseHistorySet | null
    /** Tonelagem da sessão (Σ carga × reps). */
    volume: number
}

export interface ExerciseHistorySummary {
    /** Da mais recente para a mais antiga. */
    sessions: ExerciseHistorySession[]
    /** Maior carga de todo o histórico carregado (a "melhor série"). */
    best: { set: ExerciseHistorySet; sessionId: string; completedAt: string | null } | null
    /** Sessão mais recente. */
    last: ExerciseHistorySession | null
    /** Carga da melhor série da última sessão menos a da penúltima. null com < 2 sessões. */
    deltaKg: number | null
}

function toNumber(value: number | string | null | undefined): number {
    const n = typeof value === 'string' ? parseFloat(value) : value
    return typeof n === 'number' && Number.isFinite(n) ? n : 0
}

/** Mais pesada vence; empate na carga, mais reps vence. */
function pickTopSet(sets: ExerciseHistorySet[]): ExerciseHistorySet | null {
    return sets.reduce<ExerciseHistorySet | null>((best, s) => {
        if (!best) return s
        if (s.weight > best.weight) return s
        if (s.weight === best.weight && s.reps > best.reps) return s
        return best
    }, null)
}

/**
 * Agrupa as linhas do RPC por sessão, preservando a ordem que o banco devolve
 * (mais recente primeiro) e ordenando as séries por número.
 */
export function groupExerciseHistory(rows: ExerciseHistoryRow[]): ExerciseHistorySession[] {
    const bySession = new Map<string, ExerciseHistorySession>()

    for (const row of rows) {
        let session = bySession.get(row.session_id)
        if (!session) {
            session = {
                sessionId: row.session_id,
                completedAt: row.completed_at,
                workoutName: row.workout_name,
                sets: [],
                topSet: null,
                volume: 0,
            }
            bySession.set(row.session_id, session)
        }
        session.sets.push({
            setNumber: row.set_number,
            weight: toNumber(row.weight),
            reps: toNumber(row.reps),
        })
    }

    const sessions = [...bySession.values()]
    for (const session of sessions) {
        session.sets.sort((a, b) => a.setNumber - b.setNumber)
        session.topSet = pickTopSet(session.sets)
        session.volume = session.sets.reduce((total, s) => total + s.weight * s.reps, 0)
    }
    return sessions
}

/** Resumo que o sheet mostra antes da lista: melhor carga, última vez e variação. */
export function summarizeExerciseHistory(
    sessions: ExerciseHistorySession[],
): ExerciseHistorySummary {
    const last = sessions[0] ?? null

    let best: ExerciseHistorySummary['best'] = null
    for (const session of sessions) {
        const top = session.topSet
        if (!top) continue
        if (
            !best ||
            top.weight > best.set.weight ||
            (top.weight === best.set.weight && top.reps > best.set.reps)
        ) {
            best = { set: top, sessionId: session.sessionId, completedAt: session.completedAt }
        }
    }

    const previous = sessions[1] ?? null
    const deltaKg =
        last?.topSet && previous?.topSet ? last.topSet.weight - previous.topSet.weight : null

    return { sessions, best, last, deltaKg }
}
