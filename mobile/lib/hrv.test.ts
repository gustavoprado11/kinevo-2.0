import { describe, it, expect } from 'vitest';
import { hrvMetricFromSource, hrvMetricLabel } from './hrv';

describe('hrvMetricFromSource', () => {
  it('mapeia healthkit → sdnn (iOS/Apple Watch)', () => {
    expect(hrvMetricFromSource('healthkit')).toBe('sdnn');
  });
  it('mapeia health_connect → rmssd (Android)', () => {
    expect(hrvMetricFromSource('health_connect')).toBe('rmssd');
  });
  it('mapeia wearables dedicados (Oura/Whoop) → rmssd', () => {
    expect(hrvMetricFromSource('oura')).toBe('rmssd');
    expect(hrvMetricFromSource('whoop')).toBe('rmssd');
  });
  it('retorna null para fonte desconhecida/ausente', () => {
    expect(hrvMetricFromSource('strava')).toBeNull();
    expect(hrvMetricFromSource(null)).toBeNull();
    expect(hrvMetricFromSource(undefined)).toBeNull();
  });
});

describe('hrvMetricLabel', () => {
  it('rotula as métricas em maiúsculas', () => {
    expect(hrvMetricLabel('sdnn')).toBe('SDNN');
    expect(hrvMetricLabel('rmssd')).toBe('RMSSD');
  });
  it('retorna string vazia quando métrica é null/undefined', () => {
    expect(hrvMetricLabel(null)).toBe('');
    expect(hrvMetricLabel(undefined)).toBe('');
  });
});
