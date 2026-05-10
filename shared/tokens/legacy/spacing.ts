// LEGACY — preserva spacing atual em produção. Migrar pra v2 em Fases 1+.
// Valores copiados de mobile/theme/spacing.ts.

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
  "5xl": 48,
} as const;

export type Spacing = typeof spacing;
