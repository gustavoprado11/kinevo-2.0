import { z } from "zod";
import {
  CARDIO_EQUIPMENT_OPTIONS,
  type CardioConfig,
} from "@kinevo/shared/types/workout-items";

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

export const cardioConfigSchema = z
  .object({
    mode: z.enum(["continuous", "interval"]),
    equipment: z.enum(CARDIO_EQUIPMENT_OPTIONS as [string, ...string[]]).optional(),
    objective: z.enum(["time", "distance"]).optional(),
    duration_minutes: z.number().min(1).max(600).optional(),
    distance_km: z.number().min(0.1).max(500).optional(),
    intensity: z.string().max(200).optional(),
    intensity_target: cardioIntensityTargetSchema.optional(),
    intervals: cardioIntervalSchema.optional(),
    protocol_key: z.string().max(40).optional(),
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
  });

export type CardioConfigInput = z.infer<typeof cardioConfigSchema>;

/** Valida e normaliza um item_config de cardio; retorna null se inválido. */
export function parseCardioConfig(value: unknown): CardioConfig | null {
  const parsed = cardioConfigSchema.safeParse(value);
  return parsed.success ? (parsed.data as CardioConfig) : null;
}
