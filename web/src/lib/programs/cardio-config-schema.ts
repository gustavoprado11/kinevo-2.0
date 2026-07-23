import { z } from "zod";
import {
  CARDIO_EQUIPMENT_OPTIONS,
  type CardioConfig,
  type CardioIntensityTarget,
  type CardioSegment,
  type CardioWeekOverride,
} from "@kinevo/shared/types/workout-items";
import { cardioTotalSeconds, summarizeSegments } from "@kinevo/shared/lib/cardio/segments";
import { formatIntensityTarget } from "@kinevo/shared/lib/cardio/zones";

// ============================================================================
// Zod do CardioConfig (shared/types/workout-items.ts) — validação de runtime
// do item_config de itens cardio vindos de fora do builder (MCP e IA).
// ============================================================================

export const cardioIntervalSchema = z.object({
  work_seconds: z.number().int().min(5).max(3600),
  rest_seconds: z.number().int().min(0).max(3600),
  rounds: z.number().int().min(1).max(100),
});

/** Alvo de intensidade estruturado (zonas/FC/RPE/pace) — pacote 1+2. */
export const cardioIntensityTargetSchema = z
  .object({
    type: z.enum(["zone", "hr", "rpe", "pace"]),
    zone: z.number().int().min(1).max(5).optional(),
    hr_min_bpm: z.number().int().min(60).max(230).optional(),
    hr_max_bpm: z.number().int().min(60).max(230).optional(),
    rpe: z.number().int().min(1).max(10).optional(),
    pace_min_per_km: z.string().max(20).optional(),
  })
  .superRefine((t, ctx) => {
    if (t.type === "zone" && t.zone == null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Alvo tipo 'zone' exige zone (1–5)", path: ["zone"] });
    }
    if (t.type === "hr" && (t.hr_min_bpm == null || t.hr_max_bpm == null)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Alvo tipo 'hr' exige hr_min_bpm e hr_max_bpm", path: ["hr_min_bpm"] });
    }
    if (t.type === "hr" && t.hr_min_bpm != null && t.hr_max_bpm != null && t.hr_min_bpm > t.hr_max_bpm) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "hr_min_bpm deve ser ≤ hr_max_bpm", path: ["hr_min_bpm"] });
    }
    if (t.type === "rpe" && t.rpe == null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Alvo tipo 'rpe' exige rpe (1–10)", path: ["rpe"] });
    }
    if (t.type === "pace" && !t.pace_min_per_km) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Alvo tipo 'pace' exige pace_min_per_km", path: ["pace_min_per_km"] });
    }
  });

/** Um segmento do modo 'phased': fase contínua OU bloco intervalado. */
export const cardioSegmentSchema = z
  .object({
    kind: z.enum(["steady", "interval"]),
    label: z.string().max(60).optional(),
    duration_minutes: z.number().min(0.5).max(600).optional(),
    intervals: cardioIntervalSchema.optional(),
    intensity_target: cardioIntensityTargetSchema.optional(),
    intensity: z.string().max(200).optional(),
  })
  .superRefine((seg, ctx) => {
    if (seg.kind === "steady" && seg.duration_minutes == null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Fase contínua exige duration_minutes", path: ["duration_minutes"] });
    }
    if (seg.kind === "interval" && !seg.intervals) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Bloco intervalado exige intervals { work_seconds, rest_seconds, rounds }", path: ["intervals"] });
    }
  });

/**
 * Override de UMA semana da progressão semanal (CardioWeekOverride).
 * Semântica canônica em shared/lib/cardio/progression.ts: vale A PARTIR da
 * semana `week`; com `mode` = substituição estrutural, sem = merge raso.
 */
export const cardioWeekOverrideSchema = z
  .object({
    week: z.number().int().min(1).max(52),
    label: z.string().max(60).optional(),
    mode: z.enum(["continuous", "interval", "phased"]).optional(),
    objective: z.enum(["time", "distance"]).optional(),
    duration_minutes: z.number().min(1).max(600).optional(),
    distance_km: z.number().min(0.1).max(500).optional(),
    intensity: z.string().max(200).optional(),
    intensity_target: cardioIntensityTargetSchema.optional(),
    intervals: cardioIntervalSchema.optional(),
    protocol_key: z.string().max(40).optional(),
    segments: z.array(cardioSegmentSchema).max(20).optional(),
    notes: z.string().max(2000).optional(),
  })
  .superRefine((o, ctx) => {
    // Com mode = substituição estrutural → mesmas exigências do config base.
    if (o.mode === "interval" && !o.intervals) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Semana ${o.week}: override estrutural 'interval' exige intervals { work_seconds, rest_seconds, rounds }`,
        path: ["intervals"],
      });
    }
    if (o.mode === "phased" && (!o.segments || o.segments.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Semana ${o.week}: override estrutural 'phased' exige segments`,
        path: ["segments"],
      });
    }
    if (o.mode === "continuous" && o.objective === "distance" && o.distance_km == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Semana ${o.week}: objetivo de distância exige distance_km`,
        path: ["distance_km"],
      });
    }
    // Sem mode = merge raso → precisa mudar ao menos UM campo.
    if (
      !o.mode &&
      o.objective == null &&
      o.duration_minutes == null &&
      o.distance_km == null &&
      o.intensity == null &&
      o.intensity_target == null &&
      o.intervals == null &&
      o.protocol_key == null &&
      o.segments == null &&
      o.notes == null &&
      o.label == null
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Semana ${o.week}: override vazio — defina ao menos um campo (distance_km, duration_minutes, intensidade, intervals, segments…)`,
        path: ["week"],
      });
    }
  });

export const cardioConfigSchema = z
  .object({
    mode: z.enum(["continuous", "interval", "phased"]),
    equipment: z.enum(CARDIO_EQUIPMENT_OPTIONS as [string, ...string[]]).optional(),
    objective: z.enum(["time", "distance"]).optional(),
    duration_minutes: z.number().min(1).max(600).optional(),
    distance_km: z.number().min(0.1).max(500).optional(),
    intensity: z.string().max(200).optional(),
    intensity_target: cardioIntensityTargetSchema.optional(),
    intervals: cardioIntervalSchema.optional(),
    protocol_key: z.string().max(40).optional(),
    segments: z.array(cardioSegmentSchema).max(20).optional(),
    progression: z.array(cardioWeekOverrideSchema).max(52).optional(),
    notes: z.string().max(2000).optional(),
  })
  .superRefine((cfg, ctx) => {
    if (cfg.mode === "interval" && !cfg.intervals) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Cardio intervalado exige intervals { work_seconds, rest_seconds, rounds }",
        path: ["intervals"],
      });
    }
    if (cfg.mode === "continuous" && cfg.objective === "distance" && cfg.distance_km == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Objetivo de distância exige distance_km",
        path: ["distance_km"],
      });
    }
    if (cfg.mode === "phased" && (!cfg.segments || cfg.segments.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Modo por fases exige ao menos 1 segmento em segments",
        path: ["segments"],
      });
    }
    if (cfg.progression && cfg.progression.length > 0) {
      const seen = new Set<number>();
      for (const o of cfg.progression) {
        if (seen.has(o.week)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Progressão com semana ${o.week} duplicada — uma entrada por semana`,
            path: ["progression"],
          });
        }
        seen.add(o.week);
      }
    }
  });

export type CardioConfigInput = z.infer<typeof cardioConfigSchema>;

/** Valida e normaliza um item_config de cardio; retorna null se inválido. */
export function parseCardioConfig(value: unknown): CardioConfig | null {
  const parsed = cardioConfigSchema.safeParse(value);
  return parsed.success ? (parsed.data as CardioConfig) : null;
}

/**
 * Deriva os campos LEGADOS de exibição a partir dos estruturados — a espinha
 * da retrocompat (superfícies antigas e o Watch leem intensity/duration_minutes,
 * não intensity_target/segments). Zonas resolvem na FCmáx quando conhecida.
 * - continuous/interval: intensity_target sem intensity → deriva a string.
 * - phased: deriva a intensity de cada segmento + duration_minutes (total) e
 *   intensity (resumo) do bloco.
 */
export function deriveCardioDisplayFields<T extends Record<string, unknown>>(
  cfg: T,
  maxHrBpm: number | null,
): T {
  const out: Record<string, unknown> = { ...cfg };
  if (out.mode === "phased" && Array.isArray(out.segments)) {
    const segments = deriveSegmentList(out.segments as CardioSegment[], maxHrBpm);
    out.segments = segments;
    const totalSeconds = cardioTotalSeconds({ mode: "phased", segments } as CardioConfig);
    if (totalSeconds > 0) out.duration_minutes = Math.max(1, Math.round(totalSeconds / 60));
    const summary = summarizeSegments(segments);
    if (summary) out.intensity = summary;
  } else if (out.intensity_target && !out.intensity) {
    const derived = formatIntensityTarget(out.intensity_target as CardioIntensityTarget, maxHrBpm);
    if (derived) out.intensity = derived;
  }
  // Progressão semanal: deriva os campos de exibição de CADA override, para a
  // resolução em runtime (apps) ser merge puro de estrutura, sem precisar da FCmáx.
  if (Array.isArray(out.progression) && out.progression.length > 0) {
    out.progression = (out.progression as CardioWeekOverride[]).map((o) =>
      deriveOverrideDisplayFields(o, maxHrBpm),
    );
  }
  return out as T;
}

/** Deriva a string de intensidade de cada segmento (fases). */
function deriveSegmentList(segments: CardioSegment[], maxHrBpm: number | null): CardioSegment[] {
  return segments.map((seg) => {
    if (seg.intensity_target && !seg.intensity) {
      const derived = formatIntensityTarget(seg.intensity_target, maxHrBpm);
      if (derived) return { ...seg, intensity: derived };
    }
    return seg;
  });
}

/** Espelho da derivação da base para UM override da progressão. */
function deriveOverrideDisplayFields(
  o: CardioWeekOverride,
  maxHrBpm: number | null,
): CardioWeekOverride {
  const out: CardioWeekOverride = { ...o };
  if (Array.isArray(out.segments) && out.segments.length > 0) {
    out.segments = deriveSegmentList(out.segments, maxHrBpm);
    const totalSeconds = cardioTotalSeconds({ mode: "phased", segments: out.segments } as CardioConfig);
    if (totalSeconds > 0) out.duration_minutes = Math.max(1, Math.round(totalSeconds / 60));
    const summary = summarizeSegments(out.segments);
    if (summary) out.intensity = summary;
    return out;
  }
  if (out.intensity_target && !out.intensity) {
    const derived = formatIntensityTarget(out.intensity_target, maxHrBpm);
    if (derived) out.intensity = derived;
  }
  return out;
}
