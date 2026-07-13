import type { ExerciseData } from '@/stores/training-room-store'
import type { TrainingRoomPreferences } from '@/stores/training-room-preferences-store'

/** Exercício visto pela regra do timer — só o que ela precisa ler. */
type RestTimerExercise = Pick<ExerciseData, 'setsData' | 'setScheme' | 'rest_seconds'>

/**
 * Quantos segundos de descanso iniciar quando o treinador conclui uma série.
 * `null` = não iniciar timer.
 *
 * IMPORTANTE: recebe o snapshot do exercício ANTES do toggle. A série em
 * `setIndex` está sendo concluída agora se `setsData[setIndex].completed` for
 * false neste snapshot (se for true, o treinador está DESmarcando — sem timer).
 *
 * Ordem das regras:
 * 1. Timer automático desligado nas Configurações da Sala → nada.
 * 2. Desmarcar série → nada.
 * 3. Última série pendente do exercício → nada (o descanso é ENTRE séries).
 * 4. Descanso da série (assigned_workout_item_sets) vence o agregado: prescrições
 *    avançadas (drop-set, cluster) trazem descanso por série, e 0 ali significa
 *    "sem descanso por design" — nunca cai no padrão do treinador.
 * 5. Senão, o descanso do exercício.
 * 6. Senão (exercício sem descanso prescrito), a duração padrão do treinador.
 */
export function resolveRestSeconds(
    exercise: RestTimerExercise | undefined,
    setIndex: number,
    prefs: TrainingRoomPreferences,
): number | null {
    if (!prefs.restTimerAuto) return null
    if (!exercise) return null

    const setData = exercise.setsData[setIndex]
    if (!setData || setData.completed) return null

    const hasRemainingSets = exercise.setsData.some((s, i) => i !== setIndex && !s.completed)
    if (!hasRemainingSets) return null

    const perSetRest = exercise.setScheme?.[setIndex]?.rest_seconds
    const rest = perSetRest ?? (exercise.rest_seconds || prefs.defaultRestSeconds)

    return rest > 0 ? rest : null
}

/**
 * Descanso mostrado no card do exercício. O servidor entrega `rest_seconds: 0`
 * quando o treinador não prescreveu descanso; a Sala usa (e exibe) o padrão dele.
 */
export function displayRestSeconds(
    restSeconds: number,
    prefs: Pick<TrainingRoomPreferences, 'defaultRestSeconds'>,
): number {
    return restSeconds > 0 ? restSeconds : prefs.defaultRestSeconds
}
