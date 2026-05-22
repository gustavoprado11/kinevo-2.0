import type { ShareableCardProps } from '../types';

export interface HighlightPR {
  exerciseName: string;
  weight: number;
  reps: number | string;
  /** true = recorde pessoal; false = apenas a maior carga da sessão (fallback). */
  isPr: boolean;
  delta?: number | null;
  previousDate?: string | null;
}

/**
 * Escolhe o destaque do card "Recorde" (T2).
 *  1. PRs com delta → maior delta absoluto (kg).
 *  2. Empate → maior carga.
 *  3. PRs sem delta → maior carga.
 *  4. Sem PR → maior carga da sessão (eyebrow vira "Maior carga da sessão").
 *  5. Sem dados de carga → null (ocultar do segmento).
 */
export function pickHighlightPR(
  maxLoads?: ShareableCardProps['maxLoads'],
  exerciseDetails?: ShareableCardProps['exerciseDetails'],
): HighlightPR | null {
  const loads = maxLoads ?? [];

  const prsWithDelta = loads.filter((m) => m.isPr && m.delta != null);
  if (prsWithDelta.length > 0) {
    const best = prsWithDelta
      .slice()
      .sort((a, b) => Math.abs(b.delta as number) - Math.abs(a.delta as number) || b.weight - a.weight)[0];
    return {
      exerciseName: best.exerciseName,
      weight: best.weight,
      reps: best.reps,
      isPr: true,
      delta: best.delta,
      previousDate: best.previousDate,
    };
  }

  const prs = loads.filter((m) => m.isPr);
  if (prs.length > 0) {
    const best = prs.slice().sort((a, b) => b.weight - a.weight)[0];
    return { exerciseName: best.exerciseName, weight: best.weight, reps: best.reps, isPr: true };
  }

  if (loads.length > 0) {
    const best = loads.slice().sort((a, b) => b.weight - a.weight)[0];
    return { exerciseName: best.exerciseName, weight: best.weight, reps: best.reps, isPr: false };
  }

  const details = (exerciseDetails ?? []).filter((e) => e.weight != null);
  if (details.length > 0) {
    const best = details.slice().sort((a, b) => (b.weight as number) - (a.weight as number))[0];
    return { exerciseName: best.name, weight: best.weight as number, reps: best.reps, isPr: false };
  }

  return null;
}
