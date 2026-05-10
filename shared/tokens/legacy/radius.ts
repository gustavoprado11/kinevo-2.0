// LEGACY — escala mínima usada hoje (mobile não tinha tokens explícitos de radius).
// Valores derivados dos hardcodes de mobile + web (rounded-xl). Migrar pra v2 em Fases 1+.

export const radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  pill: 9999,
} as const;

export type Radius = typeof radius;
