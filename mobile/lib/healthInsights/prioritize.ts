// Fase 14d — prioritize: filtra/ordena insights raw e retorna top 3.
// Estratégia: prioriza positivos pro engagement, mas sempre inclui 1 caution
// se existir (não quer ficar empoado).
import type { HealthInsight } from '@kinevo/shared/types/healthInsights';

export function prioritize(insights: HealthInsight[]): HealthInsight[] {
  if (insights.length === 0) return [];

  const positive = insights.filter((i) => i.severity === 'positive');
  const caution = insights.filter((i) => i.severity === 'caution');
  const neutral = insights.filter((i) => i.severity === 'neutral');

  const result: HealthInsight[] = [];

  // Mix preferencial: 2 positivos + 1 caution
  if (positive.length > 0) result.push(positive[0]);
  if (positive.length > 1) result.push(positive[1]);
  if (caution.length > 0) result.push(caution[0]);

  // Se ainda < 3, preenche com neutral, depois com caution remanescente
  while (result.length < 3) {
    const usedNeutral = result.filter((i) => i.severity === 'neutral').length;
    if (neutral.length > usedNeutral) {
      result.push(neutral[usedNeutral]);
      continue;
    }
    const usedCaution = result.filter((i) => i.severity === 'caution').length;
    if (caution.length > usedCaution) {
      result.push(caution[usedCaution]);
      continue;
    }
    const usedPositive = result.filter((i) => i.severity === 'positive').length;
    if (positive.length > usedPositive) {
      result.push(positive[usedPositive]);
      continue;
    }
    break;
  }

  return result.slice(0, 3);
}
