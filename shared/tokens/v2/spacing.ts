// Kinevo Premium DS v2 — escala 4pt.
// Source of truth: Kinevo_Mobile_Trainer_Redesign_v2.md §4.3.

export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

export type Spacing = typeof spacing;
