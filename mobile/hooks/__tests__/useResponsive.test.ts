import { describe, it, expect } from 'vitest';
import { computeResponsiveInfo } from '../responsive-utils';

describe('computeResponsiveInfo', () => {
  it('returns phone info for iPhone dimensions', () => {
    const info = computeResponsiveInfo(375, 812);
    expect(info.isPhone).toBe(true);
    expect(info.isTablet).toBe(false);
    expect(info.columns).toBe(1);
    expect(info.isPortrait).toBe(true);
    expect(info.isLandscape).toBe(false);
    expect(info.contentMaxWidth).toBe(375);
    expect(info.sidebarWidth).toBe(0);
    expect(info.fontScale).toBe(1.0);
    expect(info.spacingScale).toBe(1.0);
  });

  it('returns tablet landscape info for iPad landscape', () => {
    const info = computeResponsiveInfo(1024, 768);
    expect(info.isTablet).toBe(true);
    expect(info.isPhone).toBe(false);
    expect(info.isLandscape).toBe(true);
    expect(info.isPortrait).toBe(false);
    expect(info.columns).toBe(3);
    expect(info.contentMaxWidth).toBe(1200);
    expect(info.sidebarWidth).toBe(320);
    expect(info.fontScale).toBe(1.15);
    expect(info.spacingScale).toBe(1.25);
  });

  it('returns tablet portrait info for iPad portrait', () => {
    const info = computeResponsiveInfo(810, 1080);
    expect(info.isTablet).toBe(true);
    expect(info.isPortrait).toBe(true);
    expect(info.isLandscape).toBe(false);
    expect(info.columns).toBe(2);
    expect(info.sidebarWidth).toBe(280);
    expect(info.fontScale).toBe(1.15);
    expect(info.spacingScale).toBe(1.25);
  });

  it('correctly classifies the tablet breakpoint at exactly 768', () => {
    const info = computeResponsiveInfo(768, 1024);
    expect(info.isTablet).toBe(true);
    expect(info.isPhone).toBe(false);
  });

  it('correctly classifies just below tablet breakpoint as phone', () => {
    const info = computeResponsiveInfo(767, 1024);
    expect(info.isTablet).toBe(false);
    expect(info.isPhone).toBe(true);
    expect(info.columns).toBe(1);
    expect(info.sidebarWidth).toBe(0);
  });

  it('returns correct dimensions in output', () => {
    const info = computeResponsiveInfo(400, 800);
    expect(info.width).toBe(400);
    expect(info.height).toBe(800);
  });
});
