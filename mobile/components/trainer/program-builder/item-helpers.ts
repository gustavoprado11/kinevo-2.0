/**
 * Helpers puros de manipulação da lista flat de itens do builder
 * (raízes + filhos de superset via parent_item_id).
 *
 * Extraídos do store para serem testáveis sem puxar zustand/MMKV/expo-crypto.
 */

interface ItemLike {
    id: string;
    parent_item_id?: string | null;
    order_index: number;
}

/**
 * Ordena itens hierarquicamente: raízes por order_index, cada filho logo após
 * seu pai (ordenados entre si por order_index).
 *
 * Necessário porque duas convenções de order_index coexistem no banco:
 * o web/RPC gravam filhos com índice POR PAI (0..n) e o mobile grava índice
 * global. No sort plano os índices por-pai empatam com os das raízes e os
 * filhos renderizam no topo da lista, descolados do superset.
 */
export function sortItemsHierarchically<T extends ItemLike>(items: T[]): T[] {
    const roots = items
        .filter((i) => !i.parent_item_id)
        .sort((a, b) => a.order_index - b.order_index);
    const out: T[] = [];
    for (const root of roots) {
        out.push(root);
        out.push(
            ...items
                .filter((i) => i.parent_item_id === root.id)
                .sort((a, b) => a.order_index - b.order_index),
        );
    }
    // Filho órfão (pai fora da lista): mantém no fim em vez de sumir da tela.
    if (out.length !== items.length) {
        const seen = new Set(out.map((i) => i.id));
        for (const it of items) {
            if (!seen.has(it.id)) out.push(it);
        }
    }
    return out;
}

/**
 * Remove um item do treino reindexando a lista. Se o item for um superset,
 * DISSOLVE o bloco: os filhos sobrevivem como itens top-level na posição em
 * que estavam (paridade com dissolveSupersetIn do web e com a semântica da
 * migration 215 — filhos vivos nunca são deletados junto com o pai).
 */
export function removeItemDissolvingSuperset<T extends ItemLike>(
    items: T[],
    itemId: string,
): T[] {
    return items
        .filter((item) => item.id !== itemId)
        .map((item) =>
            item.parent_item_id === itemId ? { ...item, parent_item_id: null } : item,
        )
        .map((item, i) => ({ ...item, order_index: i }));
}
