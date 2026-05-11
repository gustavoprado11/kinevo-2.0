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
