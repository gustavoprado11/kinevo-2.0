export type CelebrationVariant = 'fitness' | 'editorial' | 'receipt';

const ORDER: CelebrationVariant[] = ['fitness', 'editorial', 'receipt'];

/**
 * Rotação diária determinística por dia-do-ano (UTC — evita desalinho de fuso).
 * Mesmo dia → mesma variante (2 treinos no mesmo dia veem a mesma animação).
 */
export function pickCelebrationVariant(workoutEndDate: Date = new Date()): CelebrationVariant {
  const start = Date.UTC(workoutEndDate.getUTCFullYear(), 0, 0);
  const today = Date.UTC(
    workoutEndDate.getUTCFullYear(),
    workoutEndDate.getUTCMonth(),
    workoutEndDate.getUTCDate(),
  );
  const dayOfYear = Math.floor((today - start) / (1000 * 60 * 60 * 24));
  return ORDER[dayOfYear % ORDER.length];
}

// Override em memória p/ dev/QA (o app proíbe AsyncStorage; persistência via
// MMKV seria o próximo passo se precisar sobreviver a reload).
let forced: CelebrationVariant | null = null;
export function __forceCelebrationVariant(v: CelebrationVariant | null) {
  if (__DEV__) forced = v;
}

export function getCelebrationVariant(workoutEndDate?: Date): CelebrationVariant {
  if (__DEV__ && forced && ORDER.includes(forced)) return forced;
  return pickCelebrationVariant(workoutEndDate);
}
