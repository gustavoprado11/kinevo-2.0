// Fix discrepância #2: HRV não é uma métrica única.
//   iOS / Apple Watch  → SDNN  (HKQuantityTypeIdentifierHeartRateVariabilitySDNN)
//   Android / HealthConnect → RMSSD (HeartRateVariabilityRmssd)
// SDNN e RMSSD medem fenômenos diferentes e NÃO são comparáveis entre si.
// A coluna `source` de hrv_samples já identifica unicamente a métrica, então
// derivamos dela (sem precisar de coluna nova). Consumidores devem rotular o
// valor e nunca misturar as duas métricas num mesmo baseline.
export type HrvMetric = 'sdnn' | 'rmssd';

export function hrvMetricFromSource(source: string | null | undefined): HrvMetric | null {
  if (source === 'healthkit') return 'sdnn';
  if (source === 'health_connect') return 'rmssd';
  return null;
}

export function hrvMetricLabel(metric: HrvMetric | null | undefined): string {
  if (metric === 'sdnn') return 'SDNN';
  if (metric === 'rmssd') return 'RMSSD';
  return '';
}
