/**
 * Helpers de cor pra landing pública.
 *
 * Pequenos o suficiente pra viverem sem dependência externa, mas extraídos
 * aqui pra cobrir com testes — qualquer regressão no `mix()` quebra a paleta
 * brand-aware da landing inteira.
 */

export function hexToRgb(hex: string): [number, number, number] {
    const c = hex.replace('#', '')
    return [
        parseInt(c.slice(0, 2), 16),
        parseInt(c.slice(2, 4), 16),
        parseInt(c.slice(4, 6), 16),
    ]
}

/**
 * Interpola entre duas cores hex (sRGB linear). `t=0` retorna `hex`,
 * `t=1` retorna `target`. Útil pra derivar tons brand-dark/brand-deep
 * a partir da cor escolhida pelo trainer.
 */
export function mix(hex: string, target: string, t: number): string {
    const a = hexToRgb(hex)
    const b = hexToRgb(target)
    return '#' + a
        .map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0'))
        .join('')
}

/** Converte hex em rgba() com alpha [0..1]. */
export function rgba(hex: string, alpha: number): string {
    const [r, g, b] = hexToRgb(hex)
    return `rgba(${r},${g},${b},${alpha})`
}
