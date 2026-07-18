/**
 * confetti — gerador de partículas SVG pra KCelebration.
 *
 * Distribuição pseudo-aleatória mas determinística (via seed) pra evitar
 * recriação de array em cada render e flicker visual.
 *
 * Pool max 80 partículas por performance (documentado em SPEC_FASE_5 §8).
 */

export interface ConfettiParticle {
    /** Posição X inicial em pt (0 = left edge). */
    x: number;
    /** Posição Y inicial em pt (negativo = acima do viewport). */
    y: number;
    /** Rotação inicial em graus. */
    rotation: number;
    /** Cor em hex/rgba. */
    color: string;
    /** Tamanho da partícula em pt. */
    size: number;
    /** Delay de animação em ms (stagger). */
    delay: number;
    /** Velocidade de fall (multiplier). */
    velocity: number;
    /** Drift horizontal em pt (positivo = right). */
    drift: number;
}

export type ConfettiPalette = 'gold' | 'purple' | 'warm' | 'mixed';

const PALETTES: Record<ConfettiPalette, readonly string[]> = {
    gold: ['#F59E0B', '#FCD34D', '#FBBF24', '#FEF3C7', '#D97706'],
    purple: ['#6D28D9', '#A78BFA', '#C4B5FD', '#EDE9FE', '#5B21B6'],
    warm: ['#F59E0B', '#EF4444', '#EC4899', '#FBBF24', '#F97316'],
    mixed: ['#6D28D9', '#F59E0B', '#10B981', '#EF4444', '#3B82F6', '#EC4899'],
};

/**
 * Mulberry32 — PRNG determinístico. Reseed = mesmo array.
 */
function makeRng(seed: number) {
    let a = seed >>> 0;
    return function rng() {
        a |= 0;
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const MAX_PARTICLES = 80;

export function generateConfettiParticles(
    count: number,
    options?: { seed?: number; palette?: ConfettiPalette; viewportWidth?: number },
): ConfettiParticle[] {
    const safeCount = Math.max(0, Math.min(MAX_PARTICLES, Math.floor(count)));
    const rng = makeRng(options?.seed ?? 42);
    const palette = PALETTES[options?.palette ?? 'mixed'];
    const w = options?.viewportWidth ?? 360;

    const particles: ConfettiParticle[] = [];
    for (let i = 0; i < safeCount; i++) {
        particles.push({
            x: rng() * w,
            y: -20 - rng() * 80,
            rotation: rng() * 360,
            color: palette[Math.floor(rng() * palette.length)],
            size: 6 + rng() * 8,
            delay: i < 20 ? i * 30 : 600 + rng() * 400,
            velocity: 0.7 + rng() * 0.6,
            drift: (rng() - 0.5) * 60,
        });
    }
    return particles;
}
