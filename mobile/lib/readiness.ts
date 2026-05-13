// Fase 14a — Algoritmo de Readiness.
// 70% sono útil + 30% HR repouso vs baseline 30d. Fallback neutro 0.6.

export interface ReadinessInputs {
  sleepMinutes: number | null;
  hrRestingToday: number | null;
  hrBaseline30d: number | null;
}

export type ReadinessCategory = 'otimo' | 'bom' | 'regular' | 'reduzido';

export interface ReadinessResult {
  score: number;
  category: ReadinessCategory;
  sleepComponent: number;
  hrComponent: number;
  sleepMinutesUsed: number | null;
  hrBaselineUsed: number | null;
}

export const SLEEP_TARGET_MINUTES = 480; // 8h
export const HR_TOLERANCE_BPM = 15;
export const FALLBACK_COMPONENT = 0.6;

export function computeReadiness(inputs: ReadinessInputs): ReadinessResult {
  const sleepComponent = inputs.sleepMinutes != null
    ? Math.min(1, inputs.sleepMinutes / SLEEP_TARGET_MINUTES)
    : FALLBACK_COMPONENT;

  let hrComponent: number;
  if (inputs.hrRestingToday != null && inputs.hrBaseline30d != null) {
    const delta = inputs.hrRestingToday - inputs.hrBaseline30d;
    hrComponent = Math.max(0, Math.min(1, 1 - delta / HR_TOLERANCE_BPM));
  } else {
    hrComponent = FALLBACK_COMPONENT;
  }

  const rawScore = (sleepComponent * 0.7 + hrComponent * 0.3) * 100;
  const score = Math.round(Math.max(0, Math.min(100, rawScore)));

  let category: ReadinessCategory;
  if (score >= 80) category = 'otimo';
  else if (score >= 60) category = 'bom';
  else if (score >= 40) category = 'regular';
  else category = 'reduzido';

  return {
    score,
    category,
    sleepComponent,
    hrComponent,
    sleepMinutesUsed: inputs.sleepMinutes,
    hrBaselineUsed: inputs.hrBaseline30d,
  };
}

export function getReadinessRecommendation(result: ReadinessResult): string {
  if (result.category === 'otimo') {
    return 'Você está pronto. Bom momento pra dar tudo no treino de hoje.';
  }
  if (result.category === 'bom') {
    return 'Recuperação boa. Treino normal recomendado.';
  }
  if (result.category === 'regular') {
    return 'Recuperação parcial. Considere reduzir 10% da carga ou manter intensidade moderada.';
  }
  return 'Recuperação reduzida. Considere treino mais leve, mobilidade ou descanso ativo hoje.';
}
