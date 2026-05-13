// Fase 14d — Unit tests das 10 regras heurísticas.
// 1 cenário positivo + 1 negativo por regra.
import { describe, it, expect } from 'vitest';
import {
  hrTrendRule,
  hrvDropRule,
  hrvStreakRule,
  sleepPatternRule,
  sleepDebtRule,
  dayOfWeekRule,
  stepStreakRule,
  stepDropRule,
  sleepEfficiencyRule,
  recoveryRule,
} from './rules';
import type {
  RuleInput,
  SleepSample,
  HrRestingSample,
  HrvSample,
  StepsSample,
  WorkoutSessionSample,
} from '@kinevo/shared/types/healthInsights';

const TODAY = new Date('2026-05-13T12:00:00Z');

function dayBack(n: number): string {
  return new Date(TODAY.getTime() - n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function emptyInput(overrides: Partial<RuleInput> = {}): RuleInput {
  return {
    sleepSamples: [],
    hrSamples: [],
    hrvSamples: [],
    stepsSamples: [],
    workoutSessions: [],
    today: TODAY,
    ...overrides,
  };
}

// ─── 1. hr_trend ───
describe('hrTrendRule', () => {
  it('returns positive insight when 30d avg is 4bpm lower than 90d', () => {
    const hrSamples: HrRestingSample[] = [];
    // 30 dias recentes: bpm = 56
    for (let i = 0; i < 30; i++) hrSamples.push({ sampleDate: dayBack(i), bpm: 56 });
    // 60 dias anteriores: bpm = 62
    for (let i = 30; i < 90; i++) hrSamples.push({ sampleDate: dayBack(i), bpm: 62 });
    const result = hrTrendRule(emptyInput({ hrSamples }));
    expect(result).not.toBeNull();
    expect(result?.severity).toBe('positive');
    expect(result?.text).toContain('caiu');
  });

  it('returns null when delta is small', () => {
    const hrSamples: HrRestingSample[] = [];
    for (let i = 0; i < 90; i++) hrSamples.push({ sampleDate: dayBack(i), bpm: 62 });
    expect(hrTrendRule(emptyInput({ hrSamples }))).toBeNull();
  });
});

// ─── 2. hrv_drop ───
describe('hrvDropRule', () => {
  it('returns caution when today is 20% below 30d baseline', () => {
    const hrvSamples: HrvSample[] = [{ sampleDate: dayBack(0), valueMs: 40 }];
    for (let i = 1; i < 30; i++) hrvSamples.push({ sampleDate: dayBack(i), valueMs: 60 });
    const result = hrvDropRule(emptyInput({ hrvSamples }));
    expect(result?.severity).toBe('caution');
    expect(result?.text).toMatch(/\d+% abaixo/);
  });

  it('returns null when within 15% range', () => {
    const hrvSamples: HrvSample[] = [{ sampleDate: dayBack(0), valueMs: 55 }];
    for (let i = 1; i < 30; i++) hrvSamples.push({ sampleDate: dayBack(i), valueMs: 60 });
    expect(hrvDropRule(emptyInput({ hrvSamples }))).toBeNull();
  });
});

// ─── 3. hrv_streak ───
describe('hrvStreakRule', () => {
  it('returns caution when 3+ days in a row below baseline', () => {
    const hrvSamples: HrvSample[] = [
      { sampleDate: dayBack(0), valueMs: 40 },
      { sampleDate: dayBack(1), valueMs: 42 },
      { sampleDate: dayBack(2), valueMs: 38 },
    ];
    for (let i = 3; i < 30; i++) hrvSamples.push({ sampleDate: dayBack(i), valueMs: 60 });
    const result = hrvStreakRule(emptyInput({ hrvSamples }));
    expect(result?.severity).toBe('caution');
    expect(result?.text).toContain('seguidos');
  });

  it('returns null when only 2 days below', () => {
    const hrvSamples: HrvSample[] = [
      { sampleDate: dayBack(0), valueMs: 40 },
      { sampleDate: dayBack(1), valueMs: 42 },
      { sampleDate: dayBack(2), valueMs: 65 }, // quebra streak
    ];
    for (let i = 3; i < 30; i++) hrvSamples.push({ sampleDate: dayBack(i), valueMs: 60 });
    expect(hrvStreakRule(emptyInput({ hrvSamples }))).toBeNull();
  });
});

// ─── 4. sleep_pattern ───
describe('sleepPatternRule', () => {
  it('returns positive when sleep on training days is 30min+ longer', () => {
    const sleepSamples: SleepSample[] = [];
    const workoutSessions: WorkoutSessionSample[] = [];
    // 7 dias de treino: dorme 450min
    for (let i = 0; i < 7; i++) {
      const day = dayBack(i);
      sleepSamples.push({ sampleDate: day, durationMinutes: 450, efficiencyPct: 88 });
      workoutSessions.push({ startedAt: new Date(day + 'T10:00:00Z').toISOString(), status: 'completed' });
    }
    // 7 dias sem treino: dorme 400min
    for (let i = 7; i < 14; i++) {
      sleepSamples.push({ sampleDate: dayBack(i), durationMinutes: 400, efficiencyPct: 85 });
    }
    const result = sleepPatternRule(emptyInput({ sleepSamples, workoutSessions }));
    expect(result?.severity).toBe('positive');
    expect(result?.text).toMatch(/\d+min a mais/);
  });

  it('returns null when no clear pattern', () => {
    const sleepSamples: SleepSample[] = [];
    for (let i = 0; i < 14; i++) sleepSamples.push({ sampleDate: dayBack(i), durationMinutes: 420, efficiencyPct: 85 });
    const workoutSessions: WorkoutSessionSample[] = [
      { startedAt: new Date(dayBack(0) + 'T10:00:00Z').toISOString(), status: 'completed' },
      { startedAt: new Date(dayBack(2) + 'T10:00:00Z').toISOString(), status: 'completed' },
      { startedAt: new Date(dayBack(4) + 'T10:00:00Z').toISOString(), status: 'completed' },
    ];
    expect(sleepPatternRule(emptyInput({ sleepSamples, workoutSessions }))).toBeNull();
  });
});

// ─── 5. sleep_debt ───
describe('sleepDebtRule', () => {
  it('returns caution when avg sleep < 6h + 4+ workouts', () => {
    const sleepSamples: SleepSample[] = [];
    for (let i = 0; i < 7; i++) sleepSamples.push({ sampleDate: dayBack(i), durationMinutes: 330, efficiencyPct: 80 });
    const workoutSessions: WorkoutSessionSample[] = [];
    for (let i = 0; i < 5; i++) {
      workoutSessions.push({ startedAt: new Date(dayBack(i) + 'T10:00:00Z').toISOString(), status: 'completed' });
    }
    const result = sleepDebtRule(emptyInput({ sleepSamples, workoutSessions }));
    expect(result?.severity).toBe('caution');
    expect(result?.text).toContain('Sleep debt');
  });

  it('returns null with adequate sleep', () => {
    const sleepSamples: SleepSample[] = [];
    for (let i = 0; i < 7; i++) sleepSamples.push({ sampleDate: dayBack(i), durationMinutes: 480, efficiencyPct: 85 });
    const workoutSessions: WorkoutSessionSample[] = [];
    for (let i = 0; i < 5; i++) {
      workoutSessions.push({ startedAt: new Date(dayBack(i) + 'T10:00:00Z').toISOString(), status: 'completed' });
    }
    expect(sleepDebtRule(emptyInput({ sleepSamples, workoutSessions }))).toBeNull();
  });
});

// ─── 6. day_of_week ───
describe('dayOfWeekRule', () => {
  it('returns neutral when a weekday consistently has lower sleep', () => {
    const sleepSamples: SleepSample[] = [];
    // 21 dias: domingos dormindo 5h, resto 7.5h
    for (let i = 0; i < 21; i++) {
      const date = new Date(TODAY.getTime() - i * 24 * 60 * 60 * 1000);
      const dow = date.getDay();
      sleepSamples.push({
        sampleDate: dayBack(i),
        durationMinutes: dow === 0 ? 300 : 450,
        efficiencyPct: 85,
      });
    }
    const result = dayOfWeekRule(emptyInput({ sleepSamples }));
    expect(result?.severity).toBe('neutral');
    expect(result?.text).toContain('Domingos');
  });

  it('returns null when sleep is uniform across week', () => {
    const sleepSamples: SleepSample[] = [];
    for (let i = 0; i < 21; i++) {
      sleepSamples.push({ sampleDate: dayBack(i), durationMinutes: 450, efficiencyPct: 85 });
    }
    expect(dayOfWeekRule(emptyInput({ sleepSamples }))).toBeNull();
  });
});

// ─── 7. step_streak ───
describe('stepStreakRule', () => {
  it('returns positive when 5+ days in a row above goal', () => {
    const stepsSamples: StepsSample[] = [];
    for (let i = 0; i < 7; i++) stepsSamples.push({ sampleDate: dayBack(i), steps: 9500 });
    const result = stepStreakRule(emptyInput({ stepsSamples, stepsGoal: 8000 }));
    expect(result?.severity).toBe('positive');
    expect(result?.text).toContain('dias seguidos');
  });

  it('returns null when streak < 5', () => {
    const stepsSamples: StepsSample[] = [];
    for (let i = 0; i < 4; i++) stepsSamples.push({ sampleDate: dayBack(i), steps: 9500 });
    stepsSamples.push({ sampleDate: dayBack(4), steps: 3000 });
    expect(stepStreakRule(emptyInput({ stepsSamples, stepsGoal: 8000 }))).toBeNull();
  });
});

// ─── 8. step_drop ───
describe('stepDropRule', () => {
  it('returns caution when 7d avg < 70% of 30d avg', () => {
    const stepsSamples: StepsSample[] = [];
    for (let i = 0; i < 7; i++) stepsSamples.push({ sampleDate: dayBack(i), steps: 3000 });
    for (let i = 7; i < 30; i++) stepsSamples.push({ sampleDate: dayBack(i), steps: 9000 });
    const result = stepDropRule(emptyInput({ stepsSamples }));
    expect(result?.severity).toBe('caution');
    expect(result?.text).toMatch(/\d+% menos ativo/);
  });

  it('returns null with consistent activity', () => {
    const stepsSamples: StepsSample[] = [];
    for (let i = 0; i < 30; i++) stepsSamples.push({ sampleDate: dayBack(i), steps: 8500 });
    expect(stepDropRule(emptyInput({ stepsSamples }))).toBeNull();
  });
});

// ─── 9. sleep_efficiency ───
describe('sleepEfficiencyRule', () => {
  it('returns positive when 7d avg efficiency > 90%', () => {
    const sleepSamples: SleepSample[] = [];
    for (let i = 0; i < 7; i++) sleepSamples.push({ sampleDate: dayBack(i), durationMinutes: 450, efficiencyPct: 92 });
    const result = sleepEfficiencyRule(emptyInput({ sleepSamples }));
    expect(result?.severity).toBe('positive');
    expect(result?.text).toContain('qualidade alta');
  });

  it('returns null when efficiency is mediocre', () => {
    const sleepSamples: SleepSample[] = [];
    for (let i = 0; i < 7; i++) sleepSamples.push({ sampleDate: dayBack(i), durationMinutes: 450, efficiencyPct: 80 });
    expect(sleepEfficiencyRule(emptyInput({ sleepSamples }))).toBeNull();
  });
});

// ─── 10. recovery ───
describe('recoveryRule', () => {
  it('returns positive when sleep yesterday > week avg + HRV today > baseline', () => {
    const sleepSamples: SleepSample[] = [
      { sampleDate: dayBack(0), durationMinutes: 480, efficiencyPct: 88 },
    ];
    for (let i = 1; i < 8; i++) sleepSamples.push({ sampleDate: dayBack(i), durationMinutes: 420, efficiencyPct: 80 });
    const hrvSamples: HrvSample[] = [{ sampleDate: dayBack(0), valueMs: 70 }];
    for (let i = 1; i < 30; i++) hrvSamples.push({ sampleDate: dayBack(i), valueMs: 60 });
    const result = recoveryRule(emptyInput({ sleepSamples, hrvSamples }));
    expect(result?.severity).toBe('positive');
    expect(result?.text).toContain('corpo pronto');
  });

  it('returns null when HRV below baseline', () => {
    const sleepSamples: SleepSample[] = [
      { sampleDate: dayBack(0), durationMinutes: 480, efficiencyPct: 88 },
    ];
    for (let i = 1; i < 8; i++) sleepSamples.push({ sampleDate: dayBack(i), durationMinutes: 420, efficiencyPct: 80 });
    const hrvSamples: HrvSample[] = [{ sampleDate: dayBack(0), valueMs: 50 }];
    for (let i = 1; i < 30; i++) hrvSamples.push({ sampleDate: dayBack(i), valueMs: 60 });
    expect(recoveryRule(emptyInput({ sleepSamples, hrvSamples }))).toBeNull();
  });
});
