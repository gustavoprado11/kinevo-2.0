// LEGACY — defaults de motion. Não havia tokens explícitos no mobile.
// Valores conservadores (Apple-style spring). Migrar pra v2 em Fases 1+.

export const easings = {
  spring: [0.32, 0.72, 0, 1] as const,
  standard: [0.4, 0, 0.2, 1] as const,
} as const;

export const durations = {
  micro: 120,
  default: 240,
  page: 320,
} as const;

export const motion = { easings, durations } as const;
export type Motion = typeof motion;
