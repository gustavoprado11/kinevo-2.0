/**
 * Seleção de exercícios do kinevo_list_exercises — funções PURAS (testáveis).
 *
 * Motivação (fix do build, 13/jul/2026): a tool aceitava UM muscle_group por
 * chamada e o playbook mandava "priorizar os grupos que vai usar" — num split
 * 5x o modelo fazia 10–11 chamadas seriais (uma por grupo), estourava o teto
 * de passos do turno e nunca chegava a criar o programa. O modo LOTE
 * (muscle_groups[]) devolve o catálogo de TODOS os grupos numa chamada só,
 * balanceado por grupo com os compostos primeiro.
 *
 * Duas peças:
 *  - resolveGroupNames: casa os nomes pedidos com os grupos reais do banco,
 *    insensível a acento/caixa e por substring BIDIRECIONAL ("Peitoral" casa
 *    com "Peito"; "Quadriceps" casa com "Quadríceps"). O ilike do caminho
 *    antigo era unidirecional e sensível a acento — o exemplo do próprio
 *    schema ('Peitoral') devolvia vazio contra o grupo real "Peito".
 *  - balanceAcrossGroups: distribui o `limit` entre os grupos pedidos (quota
 *    mínima por grupo), preservando a ordem de entrada (que já vem
 *    primário→nome do SQL), sem repetir exercício que pertence a 2+ grupos,
 *    e devolvendo a lista AGRUPADA na ordem pedida — mais fácil de o LLM
 *    consumir ao montar sessão por sessão.
 */

import { normalizeForSearch } from '@kinevo/shared/utils/search-text'

export interface MuscleGroupRow {
    id: string
    name: string
}

export interface ResolvedGroups {
    /** Nome CANÔNICO do grupo pedido (1º nome de banco que casou) → ids de muscle_groups. */
    matches: Map<string, string[]>
    /** Pedidos que não casaram com nenhum grupo do banco (feedback ao modelo). */
    unmatched: string[]
}

/** True se um nome contém o outro (nos dois sentidos), ignorando acento/caixa. */
function namesMatch(a: string, b: string): boolean {
    const na = normalizeForSearch(a)
    const nb = normalizeForSearch(b)
    if (!na || !nb) return false
    return na.includes(nb) || nb.includes(na)
}

/**
 * Casa os nomes pedidos com os grupos reais. Pedidos duplicados (após
 * normalização) são deduplicados preservando a primeira ocorrência.
 */
export function resolveGroupNames(
    requested: string[],
    catalog: MuscleGroupRow[],
): ResolvedGroups {
    const matches = new Map<string, string[]>()
    const unmatched: string[] = []
    const seen = new Set<string>()

    for (const raw of requested) {
        const norm = normalizeForSearch(raw)
        if (!norm || seen.has(norm)) continue
        seen.add(norm)

        const hits = catalog.filter((g) => namesMatch(g.name, raw))
        if (hits.length === 0) {
            unmatched.push(raw.trim())
            continue
        }
        // Chave canônica = nome de banco do 1º hit (exato > substring, se houver).
        const exact = hits.find((g) => normalizeForSearch(g.name) === norm)
        const canonical = (exact ?? hits[0]).name
        const ids = hits.map((g) => g.id)
        const existing = matches.get(canonical)
        matches.set(canonical, existing ? [...existing, ...ids] : ids)
    }

    return { matches, unmatched }
}

/** Quota mínima por grupo — mesmo com muitos grupos, cada um leva um punhado útil. */
const MIN_PER_GROUP = 6

/**
 * Seleção balanceada. `items` deve vir na ordem de prioridade (primários
 * primeiro — a query SQL já ordena assim); `membership` mapeia exercise_id →
 * grupos pedidos a que pertence (derivado de exercise_muscle_groups, não de
 * matching por nome). Exercício em 2+ grupos entra UMA vez, no primeiro grupo
 * da ordem pedida que o contiver.
 */
export function balanceAcrossGroups<T extends { id: string }>(
    items: T[],
    groupsInOrder: string[],
    membership: ReadonlyMap<string, readonly string[]>,
    limit: number,
): { selected: T[]; perGroup: Array<{ group: string; count: number }> } {
    if (groupsInOrder.length === 0 || limit <= 0) return { selected: [], perGroup: [] }

    const byGroup = new Map<string, T[]>(groupsInOrder.map((g) => [g, []]))
    for (const item of items) {
        for (const g of membership.get(item.id) ?? []) {
            byGroup.get(g)?.push(item)
        }
    }

    const quota = Math.max(MIN_PER_GROUP, Math.floor(limit / groupsInOrder.length))
    const picked = new Set<string>()
    const perGroupItems = new Map<string, T[]>(groupsInOrder.map((g) => [g, []]))

    // 1ª passada: até a quota de cada grupo, na ordem de prioridade da entrada.
    for (const g of groupsInOrder) {
        const bucket = perGroupItems.get(g)!
        for (const item of byGroup.get(g) ?? []) {
            if (bucket.length >= quota) break
            if (picked.has(item.id)) continue
            picked.add(item.id)
            bucket.push(item)
        }
    }

    // 2ª passada: sobrou orçamento → round-robin 1-a-1 pelos grupos até esgotar.
    let total = [...perGroupItems.values()].reduce((n, b) => n + b.length, 0)
    let progressed = true
    while (total < limit && progressed) {
        progressed = false
        for (const g of groupsInOrder) {
            if (total >= limit) break
            const next = (byGroup.get(g) ?? []).find((i) => !picked.has(i.id))
            if (!next) continue
            picked.add(next.id)
            perGroupItems.get(g)!.push(next)
            total++
            progressed = true
        }
    }

    const selected: T[] = []
    const perGroup: Array<{ group: string; count: number }> = []
    for (const g of groupsInOrder) {
        const bucket = perGroupItems.get(g)!
        selected.push(...bucket.slice(0, Math.max(0, limit - selected.length)))
        perGroup.push({ group: g, count: bucket.length })
    }
    return { selected: selected.slice(0, limit), perGroup }
}
