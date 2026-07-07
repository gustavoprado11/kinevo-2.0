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

interface SupersetItemLike extends ItemLike {
    item_type: string;
    rest_seconds: number;
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

/**
 * R22/R23: convenção do descanso de superset (b504cd7) — a execução usa o rest
 * POR FILHO e o container espelha o ÚLTIMO filho. Normaliza a lista depois de
 * operações que mudam quem é o último (remover filho, reordenar):
 *   1. Superset com ≤1 filho é DISSOLVIDO (paridade com removeFromSupersetIn
 *      do web); o filho sobrevivente com rest 0 herda o rest do container.
 *   2. Cada container passa a espelhar o rest do último filho.
 * Reindexa a lista no fim (preserva a ordem do array de entrada).
 */
export function normalizeSupersetsAfterChange<T extends SupersetItemLike>(items: T[]): T[] {
    let out: T[] = items;

    // 1. Dissolve supersets degenerados (0 ou 1 filho).
    for (const parent of items.filter((i) => i.item_type === 'superset')) {
        const children = out.filter((i) => i.parent_item_id === parent.id);
        if (children.length > 1) continue;
        out = out
            .filter((i) => i.id !== parent.id)
            .map((i) =>
                i.parent_item_id === parent.id
                    ? {
                        ...i,
                        parent_item_id: null,
                        rest_seconds: i.rest_seconds > 0 ? i.rest_seconds : parent.rest_seconds,
                    }
                    : i,
            );
    }

    // 2. Container espelha o último filho.
    out = out.map((i) => {
        if (i.item_type !== 'superset') return i;
        const children = out
            .filter((c) => c.parent_item_id === i.id)
            .sort((a, b) => a.order_index - b.order_index);
        const last = children[children.length - 1];
        if (!last || last.rest_seconds === i.rest_seconds) return i;
        return { ...i, rest_seconds: last.rest_seconds };
    });

    return out.map((item, idx) => ({ ...item, order_index: idx }));
}
