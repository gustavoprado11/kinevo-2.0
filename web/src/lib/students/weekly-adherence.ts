/**
 * Aderência da SEMANA ATUAL (segunda→domingo) de um aluno.
 *
 * Extraído de `students/[id]/page.tsx` (F0) para ser reusado pela página do
 * aluno e pela coluna de contexto do assistente (`student-panel-data`), sem
 * duplicar a fórmula. É um refactor puro: reproduz exatamente o cálculo que a
 * página fazia inline (`completedThisWeek` / `expectedPerWeek`).
 *
 * - `done`     = sessões concluídas cujo `completed_at` cai na semana atual
 *                (janela via `getWeekRange`, segunda-âncora e timezone-aware).
 * - `expected` = soma de `scheduled_days.length` de cada treino do programa
 *                (mesma semântica da página — NÃO deduplica dias; a página
 *                soma o comprimento por treino).
 * - `pct`      = fórmula canônica do dashboard `min(100, round(done/expected*100))`,
 *                0 quando `expected` é 0. A página do aluno não consome `pct`.
 */

import { getWeekRange } from '@kinevo/shared/utils/schedule-projection'

export interface WeeklyAdherence {
    done: number
    expected: number
    pct: number
}

interface CompletedSession {
    completed_at: string | null
}

interface ScheduledWorkout {
    scheduled_days: number[] | null
}

export function computeWeeklyAdherence(
    completedSessions: ReadonlyArray<CompletedSession> | null | undefined,
    scheduledWorkouts: ReadonlyArray<ScheduledWorkout> | null | undefined,
    opts?: { now?: Date; timeZone?: string },
): WeeklyAdherence {
    const now = opts?.now ?? new Date()
    const range = getWeekRange(now, opts?.timeZone)

    let done = 0
    for (const s of completedSessions ?? []) {
        if (!s.completed_at) continue
        const d = new Date(s.completed_at)
        if (d >= range.start && d <= range.end) done++
    }

    let expected = 0
    for (const w of scheduledWorkouts ?? []) {
        expected += w.scheduled_days?.length ?? 0
    }

    const pct = expected > 0 ? Math.min(100, Math.round((done / expected) * 100)) : 0
    return { done, expected, pct }
}
