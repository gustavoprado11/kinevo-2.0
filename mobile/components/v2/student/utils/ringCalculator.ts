/**
 * ringCalculator — helpers de math pro KRing (SVG circular progress).
 *
 * Strokes circulares trabalham com circumferência (2πr) e stroke-dashoffset
 * pra renderizar arcos parciais. Estes utils centralizam o cálculo pra evitar
 * espalhar `2 * Math.PI * r` pelo código.
 */

export type RingSize = 'sm' | 'md' | 'lg';

export interface RingDimensions {
    /** Tamanho do SVG (largura = altura) em pt. */
    size: number;
    /** Raio do círculo principal (single) ou outermost ring (triple). */
    radius: number;
    /** Espessura do stroke. */
    strokeWidth: number;
}

export const RING_SIZE_MAP: Record<RingSize, RingDimensions> = {
    sm: { size: 48, radius: 20, strokeWidth: 5 },
    md: { size: 78, radius: 32, strokeWidth: 7 },
    lg: { size: 120, radius: 50, strokeWidth: 10 },
};

/**
 * Triple ring: 3 anéis concêntricos com raios decrescentes.
 * Outer = ring 0; inner = ring 2.
 */
export function tripleRingRadii(size: RingSize): [number, number, number] {
    const { strokeWidth } = RING_SIZE_MAP[size];
    const r0 = RING_SIZE_MAP[size].radius;
    const gap = strokeWidth + 2;
    return [r0, r0 - gap, r0 - gap * 2];
}

export function circumference(radius: number): number {
    return 2 * Math.PI * radius;
}

/**
 * Calcula stroke-dashoffset pra progress fraction.
 * Quando `value` >= `max`, offset = 0 (anel completo).
 * Quando `value` <= 0, offset = circumference (anel vazio).
 */
export function progressOffset(value: number, max: number, radius: number): number {
    const c = circumference(radius);
    if (max <= 0) return c;
    const fraction = Math.max(0, Math.min(1, value / max));
    return c * (1 - fraction);
}
