import { describe, it, expect } from 'vitest';
import { getResponsiveSpacing, getResponsiveTypography, layout } from '../responsive';

describe('getResponsiveSpacing', () => {
  it('returns original values at scale 1.0', () => {
    const sp = getResponsiveSpacing(1.0);
    expect(sp.xs).toBe(4);
    expect(sp.sm).toBe(8);
    expect(sp.md).toBe(12);
    expect(sp.lg).toBe(16);
    expect(sp.xl).toBe(20);
    expect(sp['2xl']).toBe(24);
    expect(sp['3xl']).toBe(32);
    expect(sp['4xl']).toBe(40);
    expect(sp['5xl']).toBe(48);
  });

  it('returns scaled and rounded values at scale 1.25', () => {
    const sp = getResponsiveSpacing(1.25);
    expect(sp.xs).toBe(5);    // 4 * 1.25 = 5
    expect(sp.sm).toBe(10);   // 8 * 1.25 = 10
    expect(sp.md).toBe(15);   // 12 * 1.25 = 15
    expect(sp.lg).toBe(20);   // 16 * 1.25 = 20
    expect(sp.xl).toBe(25);   // 20 * 1.25 = 25
    expect(sp['2xl']).toBe(30); // 24 * 1.25 = 30
  });

  it('returns correct screenPadding for phone (scale < 1.25)', () => {
    expect(getResponsiveSpacing(1.0).screenPadding).toBe(20);
  });

  it('returns correct screenPadding for tablet (scale >= 1.25)', () => {
    expect(getResponsiveSpacing(1.25).screenPadding).toBe(32);
  });

  it('returns correct cardPadding', () => {
    expect(getResponsiveSpacing(1.0).cardPadding).toBe(14);
    expect(getResponsiveSpacing(1.25).cardPadding).toBe(20);
  });

  it('returns correct sectionGap', () => {
    expect(getResponsiveSpacing(1.0).sectionGap).toBe(16);
    expect(getResponsiveSpacing(1.25).sectionGap).toBe(24);
  });
});

describe('getResponsiveTypography', () => {
  it('returns original font sizes at scale 1.0', () => {
    const typo = getResponsiveTypography(1.0);
    expect(typo.size.xs).toBe(11);
    expect(typo.size.sm).toBe(12);
    expect(typo.size.base).toBe(14);
    expect(typo.size.lg).toBe(16);
    expect(typo.size['4xl']).toBe(32);
  });

  it('returns scaled font sizes at scale 1.15', () => {
    const typo = getResponsiveTypography(1.15);
    expect(typo.size.xs).toBe(Math.round(11 * 1.15));  // 13
    expect(typo.size.sm).toBe(Math.round(12 * 1.15));  // 14
    expect(typo.size.base).toBe(Math.round(14 * 1.15)); // 16
    expect(typo.size.lg).toBe(Math.round(16 * 1.15));  // 18
  });

  it('preserves weight and lineHeight unchanged', () => {
    const typo = getResponsiveTypography(1.15);
    expect(typo.weight.regular).toBe('400');
    expect(typo.weight.bold).toBe('700');
    expect(typo.lineHeight.tight).toBe(1.2);
    expect(typo.lineHeight.normal).toBe(1.4);
    expect(typo.lineHeight.relaxed).toBe(1.6);
  });
});

describe('layout config', () => {
  it('has correct phone config', () => {
    expect(layout.phone.contentMaxWidth).toBe(Infinity);
    expect(layout.phone.screenPadding).toBe(20);
    expect(layout.phone.columns).toBe(1);
    expect(layout.phone.modalStyle).toBe('fullscreen');
  });

  it('has correct tablet config', () => {
    expect(layout.tablet.contentMaxWidth).toBe(1200);
    expect(layout.tablet.screenPadding).toBe(32);
    expect(layout.tablet.columns).toBe(2);
    expect(layout.tablet.modalStyle).toBe('sheet');
  });
});
