// Fase 14d — evaluator: chama todas as 10 regras e retorna array de insights raw.
// Função pura. Testável.
import type { HealthInsight, RuleInput } from '@kinevo/shared/types/healthInsights';
import { ALL_RULES } from './rules';

export function evaluateInsights(input: RuleInput): HealthInsight[] {
  const results: HealthInsight[] = [];
  for (const rule of ALL_RULES) {
    try {
      const insight = rule(input);
      if (insight !== null) results.push(insight);
    } catch (e) {
      // Rule individual não pode quebrar o evaluator inteiro
      if (__DEV__) console.warn('[evaluateInsights] rule threw:', e);
    }
  }
  return results;
}
