// Fase 14d — Tipos compartilhados pra insights heurísticos de saúde.
// Cliente apenas (avaliação heurística é 100% client-side, sem AI).

export type InsightSeverity = 'positive' | 'neutral' | 'caution';

export type InsightCategory =
  | 'hr_trend'
  | 'hrv_drop'
  | 'hrv_streak'
  | 'sleep_pattern'
  | 'sleep_debt'
  | 'sleep_efficiency'
  | 'day_of_week'
  | 'step_streak'
  | 'step_drop'
  | 'recovery';

export interface HealthInsight {
  /** Identificador único da regra que disparou. */
  rule: InsightCategory;
  /** Tom emocional. Usado pra priorização e cor visual. */
  severity: InsightSeverity;
  /** Emoji que precede o texto (visual leve). */
  emoji: string;
  /** Texto renderizado. Já com valores interpolados, sem placeholders.
   *  Pode conter marcação `**negrito**` parseada pelo renderer. */
  text: string;
  /** Valores brutos pra debug e logs. */
  raw: Record<string, number | string | null>;
  /** Timestamp de quando foi gerado (cache invalidation). */
  generatedAt: number;
}

// ──────────────────────────────────────────────────────────────────────────────
// Samples normalizados — input das regras heurísticas.
// Equivalem às tabelas Supabase mas com Date parseado e nomes camelCase.
// ──────────────────────────────────────────────────────────────────────────────

export interface SleepSample {
  sampleDate: string; // YYYY-MM-DD
  durationMinutes: number | null;
  efficiencyPct: number | null;
  deepMinutes?: number | null;
  remMinutes?: number | null;
  lightMinutes?: number | null;
  awakeMinutes?: number | null;
}

export interface HrRestingSample {
  sampleDate: string;
  bpm: number;
}

export interface HrvSample {
  sampleDate: string;
  valueMs: number;
}

export interface StepsSample {
  sampleDate: string;
  steps: number | null;
}

export interface WorkoutSessionSample {
  startedAt: string; // ISO
  status: string;
}

export interface RuleInput {
  /** Últimos 90 dias, mais recente primeiro (idx 0 = ontem ou hoje). */
  sleepSamples: SleepSample[];
  hrSamples: HrRestingSample[];
  hrvSamples: HrvSample[];
  stepsSamples: StepsSample[];
  workoutSessions: WorkoutSessionSample[];
  /** Data de referência ("hoje"). Permite freezing pra testes. */
  today: Date;
  /** Meta de passos diários (default 8000). */
  stepsGoal?: number;
}

export type RuleFn = (input: RuleInput) => HealthInsight | null;
