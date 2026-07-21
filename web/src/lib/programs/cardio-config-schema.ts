import { z } from "zod";
import {
  CARDIO_EQUIPMENT_OPTIONS,
  type CardioConfig,
  type CardioIntensityTarget,
  type CardioSegment,
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
    const segments = (out.segments as CardioSegment[]).map((seg) => {
      if (seg.intensity_target && !seg.intensity) {
        const derived = formatIntensityTarget(seg.intensity_target, maxHrBpm);
        if (derived) return { ...seg, intensity: derived };
      }
      return seg;
    });
    out.segments = segments;
    const totalSeconds = cardioTotalSeconds({ mode: "phased", segments } as CardioConfig);
    if (totalSeconds > 0) out.duration_minutes = Math.max(1, Math.round(totalSeconds / 60));
    const summary = summarizeSegments(segments);
    if (summary) out.intensity = summary;
    return out as T;
  }
  if (out.intensity_target && !out.intensity) {
    const derived = formatIntensityTarget(out.intensity_target as CardioIntensityTarget, maxHrBpm);
    if (derived) out.intensity = derived;
  }
  return out as T;
}
