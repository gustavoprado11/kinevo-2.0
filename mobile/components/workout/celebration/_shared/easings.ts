// Easings + helpers, em versões WORKLET (pra useAnimatedStyle/useAnimatedProps)
// e JS (pra useCountUp no JS thread). Espelha o mock celebration-anims.jsx.

export type EaseKey = 'linear' | 'outCubic' | 'outQuart' | 'outQuint' | 'outBack';

// ── Worklet versions ──
export function clampW(v: number, lo = 0, hi = 1): number {
  'worklet';
  return Math.max(lo, Math.min(hi, v));
}
export function lerpW(t: number, a: number, b: number): number {
  'worklet';
  return a + (b - a) * t;
}
function easeW(key: EaseKey, t: number): number {
  'worklet';
  if (key === 'linear') return t;
  if (key === 'outCubic') return 1 - Math.pow(1 - t, 3);
  if (key === 'outQuart') return 1 - Math.pow(1 - t, 4);
  if (key === 'outQuint') return 1 - Math.pow(1 - t, 5);
  // outBack
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
/** Janela: mapeia time [t0..t1] → [0..1] com easing, clamped. */
export function winW(time: number, t0: number, t1: number, key: EaseKey = 'outCubic'): number {
  'worklet';
  if (t1 <= t0) return time >= t1 ? 1 : 0;
  return easeW(key, clampW((time - t0) / (t1 - t0)));
}

// ── JS versions (count-up) ──
export const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
export const lerp = (t: number, a: number, b: number) => a + (b - a) * t;
export function easeJS(key: EaseKey, t: number): number {
  switch (key) {
    case 'linear': return t;
    case 'outQuart': return 1 - Math.pow(1 - t, 4);
    case 'outQuint': return 1 - Math.pow(1 - t, 5);
    case 'outBack': {
      const c1 = 1.70158, c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    }
    case 'outCubic':
    default: return 1 - Math.pow(1 - t, 3);
  }
}
