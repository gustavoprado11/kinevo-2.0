// Kinevo Premium DS v2 — radius scale.
// Source of truth: Kinevo_Mobile_Trainer_Redesign_v2.md §4.4.

export const radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  pill: 999,
} as const;

export type Radius = typeof radius;
