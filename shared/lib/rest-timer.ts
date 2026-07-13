// ============================================================================
// rest-timer — quando (e por quanto tempo) o descanso dispara ao concluir uma série
// ============================================================================
// Fonte única da regra para a Sala de Treino (web e mobile). O app do aluno
// (mobile/app/workout/[id].tsx) implementa a mesma semântica inline.
//
// Modelo do superset (decidido em 24/jun/2026 a partir do feedback do treinador
// Lucas Martins): descanso é POR EXERCÍCIO, não único do grupo. Cada filho tem o
// seu `rest_seconds` — 0 significa "emenda direto no próximo" — e o descanso do
// ÚLTIMO filho é o descanso APÓS A RODADA.
//
// Semântica do rest_seconds vinda do banco:
//   null  → não prescrito        → cai na duração padrão do treinador
//   0     → sem descanso (escolha do treinador, ex.: emenda do superset, drop-set)
//   > 0   → o valor prescrito
// O `|| 60` que existia nas bordas matava o 0 do treinador — é o bug que o Lucas
// reportou. Não reintroduzir.

export interface RestTimerPreferences {
    /** Preferência do treinador: iniciar o descanso ao concluir cada série. */
    restTimerAuto: boolean
    /** Descanso usado quando o exercício não tem descanso prescrito (null). */
    defaultRestSeconds: number
}

interface RestTimerSet {
    completed: boolean
}

/** O que a regra precisa ler de um exercício. Web e mobile satisfazem estruturalmente. */
export interface RestTimerExercise {
    id: string
    rest_seconds: number | null
    setsData: RestTimerSet[]
    /** Prescrição por série (assigned_workout_item_sets). Vazio em programas
     *  legados e sempre vazio em filho de superset (regra V1 do builder). */
    setScheme?: { rest_seconds: number }[] | null
    /** parent_item_id — presente quando o exercício está dentro de um superset. */
    supersetId?: string | null
}

/** Descanso efetivo de um exercício: null (não prescrito) vira o padrão do
 *  treinador; 0 continua 0 (sem descanso). */
export function effectiveRestSeconds(
    restSeconds: number | null | undefined,
    prefs: Pick<RestTimerPreferences, 'defaultRestSeconds'>,
): number {
    return restSeconds === null || restSeconds === undefined
        ? prefs.defaultRestSeconds
        : restSeconds
}

/**
 * Quantos segundos de descanso iniciar quando uma série é concluída.
 * `null` = não iniciar timer.
 *
 * IMPORTANTE: recebe o snapshot ANTES do toggle. A série em `setIndex` está
 * sendo concluída agora se `setsData[setIndex].completed` for false aqui (se for
 * true, está sendo DESmarcada — sem timer).
 *
 * Regras:
 * 1. Timer automático desligado → nunca dispara.
 * 2. Desmarcar série → nunca dispara.
 * 3. Filho de superset: usa o descanso DELE. Nos exercícios do meio da rodada
 *    sempre pode descansar (vem outro exercício em seguida); no último do grupo
 *    o descanso é "após a rodada", então só dispara se ainda houver rodada
 *    pendente — senão sobraria um timer no fim do superset.
 * 4. Exercício solto: descanso da série (drop-set/cluster) vence o do exercício,
 *    e não dispara depois da última série.
 * 5. Descanso 0 (do exercício ou da série) → sem timer.
 */
export function resolveRestSeconds(
    exercises: RestTimerExercise[],
    exerciseIndex: number,
    setIndex: number,
    prefs: RestTimerPreferences,
): number | null {
    if (!prefs.restTimerAuto) return null

    const exercise = exercises[exerciseIndex]
    if (!exercise) return null

    const setData = exercise.setsData[setIndex]
    if (!setData || setData.completed) return null

    if (exercise.supersetId) {
        const rest = effectiveRestSeconds(exercise.rest_seconds, prefs)
        if (rest <= 0) return null

        const group = exercises.filter((e) => e.supersetId === exercise.supersetId)
        const isLastInGroup = group[group.length - 1]?.id === exercise.id
        const hasRemainingRounds = group.some((e) =>
            e.setsData.some((s, i) => i > setIndex && !s.completed),
        )

        return !isLastInGroup || hasRemainingRounds ? rest : null
    }

    const perSetRest = exercise.setScheme?.[setIndex]?.rest_seconds
    const rest =
        typeof perSetRest === 'number'
            ? perSetRest
            : effectiveRestSeconds(exercise.rest_seconds, prefs)
    if (rest <= 0) return null

    const hasRemainingSets = exercise.setsData.some((s, i) => i > setIndex && !s.completed)
    return hasRemainingSets ? rest : null
}
