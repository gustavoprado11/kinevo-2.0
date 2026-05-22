/**
 * Volume helpers — todos voltam pra unidade absoluta em kg quando possível.
 * Compartilhados entre templates pra linguagem consistente no preview.
 */

export function formatVolumeAbsolute(kg: number): string {
    return `${Math.round(kg).toLocaleString('pt-BR')} kg`;
}

export function formatVolumeCompact(kg: number): string {
    if (kg >= 1000) {
        const thousands = (kg / 1000).toFixed(1).replace(/\.0$/, '');
        return `${thousands} mil kg`;
    }
    return `${Math.round(kg)} kg`;
}

// ── Formatação pt-BR dos cards v2 (separador de milhar = espaço) ──
// Ref: share-cards.jsx (fmtKg / fmtVolume).

/** Peso com 1 casa decimal opcional: 82.5 → "82,5"; 70 → "70". */
export function fmtKg(n: number): string {
    const [int, dec] = n.toFixed(1).split('.');
    const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return dec === '0' ? grouped : `${grouped},${dec}`;
}

/** Inteiro com separador de milhar: 4240 → "4 240". */
export function fmtVolume(n: number): string {
    return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}
