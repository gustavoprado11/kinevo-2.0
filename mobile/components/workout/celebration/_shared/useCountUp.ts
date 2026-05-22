import { useEffect, useRef, useState } from 'react';
import { easeJS, type EaseKey } from './easings';

/**
 * Conta de 0 → target via rAF, começando em `startMs` após o mount, durando
 * `durationMs`. Isolado por contador (cada texto que conta usa seu próprio hook)
 * pra não disparar re-render no container pai. `skip` (reduce motion) vai direto
 * ao target.
 */
export function useCountUp(
  target: number,
  startMs: number,
  durationMs: number,
  ease: EaseKey = 'outCubic',
  skip = false,
): number {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (skip) { setValue(target); return; }
    const t0 = Date.now() + startMs;
    const tick = () => {
      const dt = Date.now() - t0;
      if (dt < 0) { rafRef.current = requestAnimationFrame(tick); return; }
      if (dt >= durationMs) { setValue(target); return; }
      setValue(target * easeJS(ease, dt / durationMs));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [target, startMs, durationMs, ease, skip]);

  return value;
}
