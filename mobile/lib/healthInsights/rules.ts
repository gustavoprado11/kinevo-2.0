// Fase 14d — 10 regras heurísticas client-side pra gerar HealthInsight[].
// Todas as funções são puras e tipo-seguras. Cada uma retorna 1 insight ou null.
// Lista exata da SPEC §4.3.
import type {
  HealthInsight,
  RuleInput,
  RuleFn,
  SleepSample,
  HrRestingSample,
  HrvSample,
  StepsSample,
  WorkoutSessionSample,
} from '@kinevo/shared/types/healthInsights';

// ──────────────────────────────────────────────────────────────────────────────
// Helpers internos
// ──────────────────────────────────────────────────────────────────────────────

function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((acc, v) => acc + v, 0) / values.length;
}

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysAgo(today: Date, n: number): string {
  return toDateOnly(new Date(today.getTime() - n * 24 * 60 * 60 * 1000));
}

function nonNull(n: number | null | undefined): n is number {
  return n != null && Number.isFinite(n);
}

function formatHm(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h${String(m).padStart(2, '0')}`;
}

const WEEKDAY_NAMES_PT = ['Domingos', 'Segundas', 'Terças', 'Quartas', 'Quintas', 'Sextas', 'Sábados'];

// ──────────────────────────────────────────────────────────────────────────────
// 1. hr_trend — HR caiu nos últimos 30d vs 90d
// ──────────────────────────────────────────────────────────────────────────────
export const hrTrendRule: RuleFn = (input) => {
  const last30 = input.hrSamples.slice(0, 30);
  const last90 = input.hrSamples.slice(0, 90);
  if (last30.length < 14 || last90.length < 60) return null;
  const avg30 = avg(last30.map((s) => s.bpm));
  const avg90 = avg(last90.map((s) => s.bpm));
  if (!nonNull(avg30) || !nonNull(avg90)) return null;
  const delta = avg90 - avg30;
  if (delta <= 3) return null;
  const deltaInt = Math.round(delta);
  return {
    rule: 'hr_trend',
    severity: 'positive',
    emoji: '📉',
    text: `Seu HR repouso caiu **${deltaInt}bpm em 30 dias** — sinal de fitness melhorando.`,
    raw: { avg30: Math.round(avg30), avg90: Math.round(avg90), delta: deltaInt },
    generatedAt: Date.now(),
  };
};

// ──────────────────────────────────────────────────────────────────────────────
// 2. hrv_drop — HRV de hoje 15% abaixo do baseline 30d
// ──────────────────────────────────────────────────────────────────────────────
export const hrvDropRule: RuleFn = (input) => {
  const today = input.hrvSamples[0]?.valueMs;
  const baseline = avg(input.hrvSamples.slice(0, 30).map((s) => s.valueMs));
  if (!nonNull(today) || !nonNull(baseline) || baseline <= 0) return null;
  if (today >= baseline * 0.85) return null;
  const dropPct = Math.round((1 - today / baseline) * 100);
  return {
    rule: 'hrv_drop',
    severity: 'caution',
    emoji: '⚡',
    text: `HRV **${dropPct}% abaixo** do baseline. Recuperação reduzida — considere treino leve.`,
    raw: { today: Math.round(today), baseline: Math.round(baseline), dropPct },
    generatedAt: Date.now(),
  };
};

// ──────────────────────────────────────────────────────────────────────────────
// 3. hrv_streak — 3+ dias seguidos abaixo do baseline
// ──────────────────────────────────────────────────────────────────────────────
export const hrvStreakRule: RuleFn = (input) => {
  const last7 = input.hrvSamples.slice(0, 7);
  const baseline = avg(input.hrvSamples.slice(0, 30).map((s) => s.valueMs));
  if (last7.length < 3 || !nonNull(baseline)) return null;
  let belowCount = 0;
  for (const s of last7) {
    if (s.valueMs < baseline) belowCount += 1;
    else break;
  }
  if (belowCount < 3) return null;
  return {
    rule: 'hrv_streak',
    severity: 'caution',
    emoji: '🟡',
    text: `HRV abaixo da média há **${belowCount} dias seguidos**. Pode ser fadiga acumulada.`,
    raw: { count: belowCount, baseline: Math.round(baseline) },
    generatedAt: Date.now(),
  };
};

// ──────────────────────────────────────────────────────────────────────────────
// 4. sleep_pattern — dorme mais em dias de treino
// ──────────────────────────────────────────────────────────────────────────────
export const sleepPatternRule: RuleFn = (input) => {
  if (input.sleepSamples.length < 14 || input.workoutSessions.length < 3) return null;

  // Set de datas com workout
  const workoutDates = new Set(
    input.workoutSessions
      .filter((w) => w.status === 'completed')
      .map((w) => toDateOnly(new Date(w.startedAt)))
  );

  // Para cada sample de sono, sample_date é a noite que terminou no dia X.
  // Considerar "sleep that prepared for workout day" = sono cuja sample_date == workout_date.
  const onDays: number[] = [];
  const offDays: number[] = [];
  for (const s of input.sleepSamples) {
    if (!nonNull(s.durationMinutes)) continue;
    if (workoutDates.has(s.sampleDate)) onDays.push(s.durationMinutes);
    else offDays.push(s.durationMinutes);
  }
  if (onDays.length < 3 || offDays.length < 3) return null;
  const avgOn = avg(onDays);
  const avgOff = avg(offDays);
  if (!nonNull(avgOn) || !nonNull(avgOff)) return null;
  const delta = avgOn - avgOff;
  if (delta <= 15) return null;
  const deltaInt = Math.round(delta);
  return {
    rule: 'sleep_pattern',
    severity: 'positive',
    emoji: '🌙',
    text: `Você dorme **${deltaInt}min a mais** nos dias de treino. Padrão saudável de recuperação.`,
    raw: { avgOn: Math.round(avgOn), avgOff: Math.round(avgOff), delta: deltaInt },
    generatedAt: Date.now(),
  };
};

// ──────────────────────────────────────────────────────────────────────────────
// 5. sleep_debt — sono médio < 6h E 4+ treinos na semana
// ──────────────────────────────────────────────────────────────────────────────
export const sleepDebtRule: RuleFn = (input) => {
  const last7Sleep = input.sleepSamples.slice(0, 7);
  if (last7Sleep.length < 5) return null;
  const durations = last7Sleep.map((s) => s.durationMinutes).filter(nonNull);
  if (durations.length < 5) return null;
  const avgSleep = avg(durations);
  if (!nonNull(avgSleep) || avgSleep >= 360) return null;

  const sevenAgo = new Date(input.today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const workoutCount = input.workoutSessions.filter((w) => {
    if (w.status !== 'completed') return false;
    return new Date(w.startedAt) >= sevenAgo;
  }).length;
  if (workoutCount < 4) return null;

  return {
    rule: 'sleep_debt',
    severity: 'caution',
    emoji: '😴',
    text: `Sono médio de **${formatHm(avgSleep)}** com ${workoutCount} treinos essa semana. Sleep debt.`,
    raw: { avgMinutes: Math.round(avgSleep), workoutCount },
    generatedAt: Date.now(),
  };
};

// ──────────────────────────────────────────────────────────────────────────────
// 6. day_of_week — dia da semana específico tem piores noites
// ──────────────────────────────────────────────────────────────────────────────
export const dayOfWeekRule: RuleFn = (input) => {
  if (input.sleepSamples.length < 21) return null;
  const byDow: Record<number, number[]> = {};
  for (const s of input.sleepSamples) {
    if (!nonNull(s.durationMinutes)) continue;
    const dow = new Date(s.sampleDate + 'T12:00:00').getDay();
    if (!byDow[dow]) byDow[dow] = [];
    byDow[dow].push(s.durationMinutes);
  }
  const overall = avg(input.sleepSamples.map((s) => s.durationMinutes).filter(nonNull));
  if (!nonNull(overall)) return null;

  let worstDow: number | null = null;
  let worstAvg: number | null = null;
  for (const dowStr of Object.keys(byDow)) {
    const dow = Number(dowStr);
    const samples = byDow[dow];
    if (samples.length < 3) continue;
    const dowAvg = avg(samples);
    if (!nonNull(dowAvg)) continue;
    if (worstAvg === null || dowAvg < worstAvg) {
      worstAvg = dowAvg;
      worstDow = dow;
    }
  }
  if (worstDow === null || worstAvg === null) return null;
  if (overall - worstAvg < 30) return null;

  return {
    rule: 'day_of_week',
    severity: 'neutral',
    emoji: '📅',
    text: `**${WEEKDAY_NAMES_PT[worstDow]}** têm sido suas piores noites (média ${formatHm(worstAvg)}). Alguma rotina?`,
    raw: { weekday: WEEKDAY_NAMES_PT[worstDow], avgMinutes: Math.round(worstAvg), overall: Math.round(overall) },
    generatedAt: Date.now(),
  };
};

// ──────────────────────────────────────────────────────────────────────────────
// 7. step_streak — 5+ dias seguidos batendo a meta
// ──────────────────────────────────────────────────────────────────────────────
export const stepStreakRule: RuleFn = (input) => {
  const goal = input.stepsGoal ?? 8000;
  let streak = 0;
  for (const s of input.stepsSamples) {
    if (!nonNull(s.steps)) break;
    if (s.steps >= goal) streak += 1;
    else break;
  }
  if (streak < 5) return null;
  return {
    rule: 'step_streak',
    severity: 'positive',
    emoji: '🚶',
    text: `Meta de passos no ritmo: **${streak} dias seguidos** acima de ${goal.toLocaleString('pt-BR')}.`,
    raw: { streak, goal },
    generatedAt: Date.now(),
  };
};

// ──────────────────────────────────────────────────────────────────────────────
// 8. step_drop — média 7d < 70% da média 30d
// ──────────────────────────────────────────────────────────────────────────────
export const stepDropRule: RuleFn = (input) => {
  const last7 = input.stepsSamples.slice(0, 7).map((s) => s.steps).filter(nonNull);
  const last30 = input.stepsSamples.slice(0, 30).map((s) => s.steps).filter(nonNull);
  if (last7.length < 5 || last30.length < 21) return null;
  const avg7 = avg(last7);
  const avg30 = avg(last30);
  if (!nonNull(avg7) || !nonNull(avg30) || avg30 <= 0) return null;
  if (avg7 >= avg30 * 0.7) return null;
  const dropPct = Math.round((1 - avg7 / avg30) * 100);
  return {
    rule: 'step_drop',
    severity: 'caution',
    emoji: '🐢',
    text: `Você está **${dropPct}% menos ativo** que o normal essa semana. Tudo bem?`,
    raw: { avg7: Math.round(avg7), avg30: Math.round(avg30), dropPct },
    generatedAt: Date.now(),
  };
};

// ──────────────────────────────────────────────────────────────────────────────
// 9. sleep_efficiency — eficiência média da semana > 90%
// ──────────────────────────────────────────────────────────────────────────────
export const sleepEfficiencyRule: RuleFn = (input) => {
  const last7 = input.sleepSamples.slice(0, 7).map((s) => s.efficiencyPct).filter(nonNull);
  if (last7.length < 5) return null;
  const avgEff = avg(last7);
  if (!nonNull(avgEff) || avgEff <= 90) return null;
  return {
    rule: 'sleep_efficiency',
    severity: 'positive',
    emoji: '✨',
    text: `Eficiência de sono em **${Math.round(avgEff)}% essa semana** — qualidade alta consistente.`,
    raw: { avgEfficiency: Math.round(avgEff) },
    generatedAt: Date.now(),
  };
};

// ──────────────────────────────────────────────────────────────────────────────
// 10. recovery — sono ontem > média semanal + HRV hoje > baseline
// ──────────────────────────────────────────────────────────────────────────────
export const recoveryRule: RuleFn = (input) => {
  const yesterdaySleep = input.sleepSamples[0]?.durationMinutes;
  const avg7Sleep = avg(input.sleepSamples.slice(1, 8).map((s) => s.durationMinutes).filter(nonNull));
  const hrvToday = input.hrvSamples[0]?.valueMs;
  const baseline = avg(input.hrvSamples.slice(0, 30).map((s) => s.valueMs));
  if (!nonNull(yesterdaySleep) || !nonNull(avg7Sleep) || !nonNull(hrvToday) || !nonNull(baseline)) return null;
  if (yesterdaySleep <= avg7Sleep) return null;
  if (hrvToday <= baseline) return null;
  return {
    rule: 'recovery',
    severity: 'positive',
    emoji: '💪',
    text: 'Boa noite de sono + HRV acima do baseline = corpo pronto pra treinar forte.',
    raw: {
      sleepYesterday: Math.round(yesterdaySleep),
      avgSleep7d: Math.round(avg7Sleep),
      hrvToday: Math.round(hrvToday),
      baseline: Math.round(baseline),
    },
    generatedAt: Date.now(),
  };
};

export const ALL_RULES: RuleFn[] = [
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
];

// Re-export pra reuso no evaluate.ts
export type {
  HealthInsight,
  RuleInput,
  RuleFn,
  SleepSample,
  HrRestingSample,
  HrvSample,
  StepsSample,
  WorkoutSessionSample,
};
