import { spacing } from './spacing';
import { typography } from './typography';

export function getResponsiveSpacing(scale: number) {
  return {
    xs: Math.round(spacing.xs * scale),
    sm: Math.round(spacing.sm * scale),
    md: Math.round(spacing.md * scale),
    lg: Math.round(spacing.lg * scale),
    xl: Math.round(spacing.xl * scale),
    '2xl': Math.round(spacing['2xl'] * scale),
    '3xl': Math.round(spacing['3xl'] * scale),
    '4xl': Math.round(spacing['4xl'] * scale),
    '5xl': Math.round(spacing['5xl'] * scale),
    screenPadding: scale >= 1.25 ? 32 : 20,
    cardPadding: scale >= 1.25 ? 20 : 14,
    sectionGap: scale >= 1.25 ? 24 : 16,
  };
}

export function getResponsiveTypography(scale: number) {
  return {
    size: {
      xs: Math.round(typography.size.xs * scale),
      sm: Math.round(typography.size.sm * scale),
      md: Math.round(typography.size.md * scale),
      base: Math.round(typography.size.base * scale),
      lg: Math.round(typography.size.lg * scale),
      xl: Math.round(typography.size.xl * scale),
      '2xl': Math.round(typography.size['2xl'] * scale),
      '3xl': Math.round(typography.size['3xl'] * scale),
      '4xl': Math.round(typography.size['4xl'] * scale),
    },
    weight: typography.weight,
    lineHeight: typography.lineHeight,
  };
}

export const layout = {
  phone: {
    contentMaxWidth: Infinity,
    screenPadding: 20,
    columns: 1 as const,
    modalStyle: 'fullscreen' as const,
  },
  tablet: {
    contentMaxWidth: 1200,
    screenPadding: 32,
    columns: 2 as const,
    modalStyle: 'sheet' as const,
  },
} as const;
