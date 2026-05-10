// Kinevo Premium DS v2 — motion tokens.
// Source of truth: Kinevo_Mobile_Trainer_Redesign_v2.md §4.6.

export const easings = {
  // Apple-style spring (cubic-bezier; aceito por Reanimated e CSS).
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
