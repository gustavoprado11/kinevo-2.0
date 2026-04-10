import { describe, it, expect } from 'vitest';
import { colors } from '../colors';
import { spacing } from '../spacing';
import { typography } from '../typography';

// ── Colors ──────────────────────────────────────────────────────────

describe('design tokens — colors', () => {
    it('has all required color groups', () => {
        expect(colors).toHaveProperty('background');
        expect(colors).toHaveProperty('text');
        expect(colors).toHaveProperty('brand');
        expect(colors).toHaveProperty('success');
        expect(colors).toHaveProperty('warning');
        expect(colors).toHaveProperty('error');
        expect(colors).toHaveProperty('info');
        expect(colors).toHaveProperty('border');
        expect(colors).toHaveProperty('status');
    });

    it('background colors are valid hex or white', () => {
        expect(colors.background.primary).toBe('#F2F2F7');
        expect(colors.background.card).toBe('#FFFFFF');
        expect(colors.background.elevated).toBe('#FFFFFF');
        expect(colors.background.inset).toBe('#E5E7EB');
    });

    it('brand primary matches Kinevo purple', () => {
        expect(colors.brand.primary).toBe('#7c3aed');
        expect(colors.brand.primaryDark).toBe('#6d28d9');
    });

    it('border.focused matches brand.primary', () => {
        expect(colors.border.focused).toBe(colors.brand.primary);
    });

    it('semantic colors have default + light variants', () => {
        for (const group of [colors.success, colors.warning, colors.error, colors.info]) {
            expect(group).toHaveProperty('default');
            expect(group).toHaveProperty('light');
            expect(typeof group.default).toBe('string');
            expect(typeof group.light).toBe('string');
        }
    });

    it('status colors include all plan types', () => {
        expect(colors.status).toHaveProperty('active');
        expect(colors.status).toHaveProperty('inactive');
        expect(colors.status).toHaveProperty('pending');
        expect(colors.status).toHaveProperty('online');
        expect(colors.status).toHaveProperty('presencial');
    });

    it('all text colors are defined', () => {
        expect(Object.keys(colors.text)).toEqual(
            expect.arrayContaining(['primary', 'secondary', 'tertiary', 'quaternary', 'inverse'])
        );
    });
});

// ── Spacing ─────────────────────────────────────────────────────────

describe('design tokens — spacing', () => {
    it('has correct scale values', () => {
        expect(spacing.xs).toBe(4);
        expect(spacing.sm).toBe(8);
        expect(spacing.md).toBe(12);
        expect(spacing.lg).toBe(16);
        expect(spacing.xl).toBe(20);
        expect(spacing['2xl']).toBe(24);
        expect(spacing['3xl']).toBe(32);
        expect(spacing['4xl']).toBe(40);
        expect(spacing['5xl']).toBe(48);
    });

    it('scale is monotonically increasing', () => {
        const values = Object.values(spacing);
        for (let i = 1; i < values.length; i++) {
            expect(values[i]).toBeGreaterThan(values[i - 1]);
        }
    });

    it('all values are positive integers', () => {
        for (const value of Object.values(spacing)) {
            expect(value).toBeGreaterThan(0);
            expect(Number.isInteger(value)).toBe(true);
        }
    });
});

// ── Typography ──────────────────────────────────────────────────────

describe('design tokens — typography', () => {
    it('has size, weight, and lineHeight groups', () => {
        expect(typography).toHaveProperty('size');
        expect(typography).toHaveProperty('weight');
        expect(typography).toHaveProperty('lineHeight');
    });

    it('font sizes range from 11 to 32', () => {
        const sizes = Object.values(typography.size);
        expect(Math.min(...sizes)).toBe(11);
        expect(Math.max(...sizes)).toBe(32);
    });

    it('font sizes are monotonically increasing', () => {
        const sizes = Object.values(typography.size);
        for (let i = 1; i < sizes.length; i++) {
            expect(sizes[i]).toBeGreaterThanOrEqual(sizes[i - 1]);
        }
    });

    it('weights are string literals (React Native convention)', () => {
        expect(typography.weight.regular).toBe('400');
        expect(typography.weight.medium).toBe('500');
        expect(typography.weight.semibold).toBe('600');
        expect(typography.weight.bold).toBe('700');
        expect(typography.weight.extrabold).toBe('800');
    });

    it('line heights are between 1.0 and 2.0', () => {
        for (const lh of Object.values(typography.lineHeight)) {
            expect(lh).toBeGreaterThanOrEqual(1.0);
            expect(lh).toBeLessThanOrEqual(2.0);
        }
    });

    it('tight < normal < relaxed', () => {
        expect(typography.lineHeight.tight).toBeLessThan(typography.lineHeight.normal);
        expect(typography.lineHeight.normal).toBeLessThan(typography.lineHeight.relaxed);
    });
});
