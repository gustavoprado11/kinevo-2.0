import { describe, it, expect } from 'vitest';
import { mergedMinutes, type TimeInterval } from './shared';

const MIN = 60_000; // 1 minuto em ms
// Helper: cria intervalo de [startMin, endMin) em minutos a partir de t0.
const iv = (startMin: number, endMin: number): TimeInterval => ({
  start: startMin * MIN,
  end: endMin * MIN,
});

describe('mergedMinutes', () => {
  it('retorna 0 para lista vazia', () => {
    expect(mergedMinutes([])).toBe(0);
  });

  it('conta um único intervalo pela sua duração', () => {
    expect(mergedMinutes([iv(0, 60)])).toBe(60);
  });

  it('mescla intervalos sobrepostos contando o minuto uma vez (fix contagem dupla)', () => {
    // Apple Watch 0-480 + app terceiro 0-480 (mesma noite) → 480, não 960.
    expect(mergedMinutes([iv(0, 480), iv(0, 480)])).toBe(480);
  });

  it('mescla sobreposição parcial', () => {
    // 0-300 e 240-480 sobrepõem em 240-300 → cobertura 0-480 = 480.
    expect(mergedMinutes([iv(0, 300), iv(240, 480)])).toBe(480);
  });

  it('soma intervalos disjuntos (ex: cochilo separado da noite)', () => {
    expect(mergedMinutes([iv(0, 480), iv(600, 660)])).toBe(540);
  });

  it('trata intervalos adjacentes (que se tocam) como contínuos', () => {
    expect(mergedMinutes([iv(0, 60), iv(60, 120)])).toBe(120);
  });

  it('independe da ordem de entrada', () => {
    expect(mergedMinutes([iv(600, 660), iv(0, 480), iv(240, 300)])).toBe(540);
  });

  it('ignora intervalos inválidos (end <= start)', () => {
    expect(mergedMinutes([iv(0, 60), iv(120, 120), iv(200, 100)])).toBe(60);
  });

  it('contém intervalo dentro de outro maior sem inflar', () => {
    expect(mergedMinutes([iv(0, 480), iv(100, 200)])).toBe(480);
  });
});
