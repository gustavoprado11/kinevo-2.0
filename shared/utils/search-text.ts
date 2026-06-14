// Normalização de texto para busca — fonte ÚNICA web+mobile. Antes cada tela
// usava `.toLowerCase().includes()`, que é sensível a acento: buscar "Leo" não
// encontrava o aluno "Léo", e "agachamento bulgaro" não achava "Búlgaro".
// Aqui removemos diacríticos (NFD + faixa de combinantes) e baixamos a caixa,
// para que a comparação seja insensível a acento e a maiúsculas/minúsculas.
//
// Hermes (mobile) e os runtimes web suportam String.prototype.normalize; a
// faixa ̀-ͯ cobre os Combining Diacritical Marks (acentos do pt-BR:
// á à â ã é ê í ó ô õ ú ü ç → c). Evitamos \p{Diacritic} por compatibilidade.

/** Baixa a caixa e remove acentos. "Léo" → "leo", "Búlgaro" → "bulgaro". */
export function normalizeForSearch(value: string | null | undefined): string {
    return (value ?? '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .trim();
}

/** True se `query` é substring de `target`, ignorando acento e caixa.
 *  Query vazia casa com tudo (não filtra). */
export function matchesSearch(
    target: string | null | undefined,
    query: string | null | undefined,
): boolean {
    const q = normalizeForSearch(query);
    if (!q) return true;
    return normalizeForSearch(target).includes(q);
}
