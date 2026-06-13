// Máscara/conversão de data BR (DD/MM/AAAA) usada em inputs sem date picker
// nativo (wizard da Carteira, cobrança avulsa).

export const onlyDigits = (s: string) => s.replace(/\D/g, "");

/** "DD/MM/AAAA" → "AAAA-MM-DD" (ou "" se incompleto/inválido). */
export function brDateToISO(masked: string): string {
    const d = onlyDigits(masked);
    if (d.length !== 8) return "";
    const dd = d.slice(0, 2), mm = d.slice(2, 4), yyyy = d.slice(4, 8);
    const day = Number(dd), month = Number(mm), year = Number(yyyy);
    if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900) return "";
    return `${yyyy}-${mm}-${dd}`;
}

/** Digita livre → "DD/MM/AAAA" progressivo. */
export function maskBrDate(s: string): string {
    const d = onlyDigits(s).slice(0, 8);
    if (d.length <= 2) return d;
    if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
    return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/** Date local → "DD/MM/AAAA" (componentes locais — nunca toISOString/UTC). */
export function toBrDate(date: Date): string {
    return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
}

/** Date local → "AAAA-MM-DD" (componentes locais — nunca toISOString/UTC). */
export function toLocalISO(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
