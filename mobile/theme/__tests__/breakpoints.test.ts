import { describe, it, expect } from 'vitest';
import { breakpoints, getDeviceType } from '../breakpoints';

describe('breakpoints', () => {
  it('has correct breakpoint values', () => {
    expect(breakpoints.phone).toBe(0);
    expect(breakpoints.tablet).toBe(768);
    expect(breakpoints.tabletLarge).toBe(1024);
  });
});

describe('getDeviceType', () => {
  it('returns phone for small widths', () => {
    expect(getDeviceType(320)).toBe('phone');
    expect(getDeviceType(375)).toBe('phone');
    expect(getDeviceType(430)).toBe('phone');
  });

  it('returns phone for width just below tablet breakpoint', () => {
    expect(getDeviceType(767)).toBe('phone');
  });

  it('returns tablet at exactly 768', () => {
    expect(getDeviceType(768)).toBe('tablet');
  });

  it('returns tablet for large widths', () => {
    expect(getDeviceType(1024)).toBe('tablet');
    expect(getDeviceType(1366)).toBe('tablet');
  });
});
