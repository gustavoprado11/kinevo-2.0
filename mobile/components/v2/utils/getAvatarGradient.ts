/**
 * Hash determinístico de nome → par de cores de gradient.
 *
 * Pool de 8 gradientes pré-curados (variações harmônicas em torno do
 * roxo Kinevo + complementares vibrantes pra dar identidade visual a
 * cada aluno). Mesmo nome → sempre mesmo gradient.
 *
 * Interno do componente Avatar. Não exportar do barrel v2.
 */

export type AvatarGradient = readonly [string, string];

const GRADIENT_POOL: readonly AvatarGradient[] = [
    ['#7C3AED', '#EC4899'], // purple → pink (Kinevo signature)
    ['#3B82F6', '#06B6D4'], // blue → cyan
    ['#F59E0B', '#EF4444'], // amber → red
    ['#10B981', '#14B8A6'], // emerald → teal
    ['#8B5CF6', '#3B82F6'], // violet → blue
    ['#EC4899', '#F97316'], // pink → orange
    ['#6366F1', '#A78BFA'], // indigo → light purple
    ['#0EA5E9', '#22D3EE'], // sky → cyan light
] as const;

function hashString(input: string): number {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
        hash = (hash + input.charCodeAt(i) * (i + 1)) >>> 0;
    }
    return hash;
}

export function getAvatarGradient(name: string): AvatarGradient {
    const normalized = (name ?? '').trim().toLowerCase();
    const idx = hashString(normalized) % GRADIENT_POOL.length;
    return GRADIENT_POOL[idx];
}

export function getInitials(name: string): string {
    const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
