// Formatação/parse de moeda BRL — fonte ÚNICA web+mobile (S5: havia 26 cópias
// locais já divergentes entre Intl e string-built; ver análise noturna §3.1).
// String-built de propósito: o Hermes (mobile) não tem Intl completo, e o
// Intl.NumberFormat insere espaço não-quebrável (U+00A0) — duas grafias para
// o mesmo valor. Os valores são tratados em REAIS.

/** Formata um número (em reais) como "R$ 1.234,56" (pt-BR, com milhar). */
export function formatBRL(value: number): string {
    const safe = Number.isFinite(value) ? value : 0;
    const [intPart, decPart] = Math.abs(safe).toFixed(2).split('.');
    const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${safe < 0 ? '-' : ''}R$ ${grouped},${decPart}`;
}

/** Converte string pt-BR ("1.500,00", "1500", "R$ 1.234,56") em número (reais).
 *  Remove o separador de milhar e usa vírgula como decimal. 0 se inválido.
 *  (A5: o parse antigo `replace(',', '.')` quebrava com ponto de milhar →
 *  "1.500,00" virava 1.5.) */
export function parseBRL(raw: string): number {
    const cleaned = (raw ?? '').replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : 0;
}
