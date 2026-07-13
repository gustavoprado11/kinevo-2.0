/**
 * Gate de qualidade da prescrição (P3 do plano do harness — 13/jul/2026).
 *
 * As regras profissionais do playbook de build (teto de volume semanal por
 * grupo, composto principal em toda sessão, sem duplicata na sessão…) eram só
 * TEXTO de prompt — esperança, não garantia. Vimos ao vivo o modelo violá-las.
 * Aqui elas viram CÓDIGO: o motor intercepta os args das duas tools
 * transacionais de criação (kinevo_create_student_draft_program /
 * kinevo_create_program_template) ANTES de executar.
 *
 *   - Violação GRAVE (errors)  → NÃO executa; devolve um corretivo estruturado
 *     (`blocked: true`) e o modelo corrige e re-chama NO MESMO turno — mesmo
 *     padrão do read-guard e da guarda de homônimos (não cobra, não vira card).
 *   - Deslize (warnings)       → executa, mas anexa `quality_warnings` ao
 *     resultado — o modelo pode consertar com as tools de edição ou avisar.
 *
 * Volume por grupo usa a MESMA convenção do resto do app (R32): o grupo do
 * exercício é o PRIMEIRO do embed exercise_muscle_groups. Os tetos absolutos
 * vêm de STYLE_VOLUME_CEILINGS (fonte única com o clamp do estilo e o texto do
 * playbook); o estilo do treinador só APERTA avisos, nunca relaxa os tetos.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
    STYLE_VOLUME_CEILINGS,
    type PrescriptionStyle,
} from '@kinevo/shared/types/prescription'

// ── Shape dos args (subconjunto do zod das tools; campos que o gate lê) ──────

interface BuildSupersetChild {
    exercise_id: string
    sets: number
    exercise_function?: string
}

interface BuildItem {
    exercise_id?: string
    sets?: number
    reps?: string
    set_scheme?: unknown[]
    rounds?: number
    exercise_function?: string
    superset?: BuildSupersetChild[]
}

interface BuildSession {
    name: string
    scheduled_days?: number[]
    items: BuildItem[]
}

export interface BuildProgramArgs {
    name?: string
    sessions?: BuildSession[]
}

/** Catálogo mínimo p/ validação: nome, grupo (1º do embed — R32) e se é composto. */
export interface CatalogEntry {
    name: string
    group: string | null
    isPrimary: boolean
}

export interface BuildValidation {
    /** Violações que BLOQUEIAM a criação (o modelo deve corrigir e re-chamar). */
    errors: string[]
    /** Deslizes que não bloqueiam — anexados ao resultado como quality_warnings. */
    warnings: string[]
}

// Funções que NÃO contam volume de trabalho (aquecimento/ativação/condicionamento).
const NON_WORKING_FUNCTIONS = new Set(['warmup', 'activation', 'conditioning'])

/** Séries de um item: simples = sets; avançado = set_scheme × rounds. */
function itemSets(item: BuildItem): number {
    if (item.set_scheme && item.set_scheme.length > 0) {
        return item.set_scheme.length * Math.max(1, item.rounds ?? 1)
    }
    return item.sets ?? 0
}

/** Exercícios "achatados" de uma sessão (itens simples + filhos de superset). */
function flatExercises(
    session: BuildSession,
): Array<{ exercise_id: string; sets: number; fn: string | undefined }> {
    const out: Array<{ exercise_id: string; sets: number; fn: string | undefined }> = []
    for (const item of session.items ?? []) {
        if (item.superset && item.superset.length > 0) {
            for (const c of item.superset) {
                out.push({ exercise_id: c.exercise_id, sets: c.sets ?? 0, fn: c.exercise_function })
            }
        } else if (item.exercise_id) {
            out.push({ exercise_id: item.exercise_id, sets: itemSets(item), fn: item.exercise_function })
        }
    }
    return out
}

const ABSOLUTE_GROUP_MAX = STYLE_VOLUME_CEILINGS.emphasized.max // 20 — "JAMAIS acima de 20"
const SESSION_MAX_EXERCISES = 9
const SESSION_MIN_FOR_COMPOUND_RULE = 4

/**
 * Valida os args de um create transacional. Puro (o catálogo já vem resolvido).
 * `style` só ajusta AVISOS (faixa de exercícios/sessão); os tetos são absolutos.
 */
export function validateBuildArgs(
    args: BuildProgramArgs,
    catalog: ReadonlyMap<string, CatalogEntry>,
    style: PrescriptionStyle | null = null,
): BuildValidation {
    const errors: string[] = []
    const warnings: string[] = []
    const sessions = args.sessions ?? []

    if (sessions.length === 0) {
        return { errors: ['O programa não tem nenhuma sessão.'], warnings }
    }

    // E2: exercise_id desconhecido — corretivo melhor que o FK error da tool.
    const unknown = new Set<string>()
    for (const s of sessions) {
        for (const ex of flatExercises(s)) {
            if (!catalog.has(ex.exercise_id)) unknown.add(ex.exercise_id)
        }
    }
    if (unknown.size > 0) {
        errors.push(
            `exercise_id fora do catálogo: ${[...unknown].join(', ')}. IDs de turnos ANTERIORES não valem — ` +
                `chame kinevo_list_exercises AGORA (uma chamada com muscle_groups=[todos os grupos do split]) ` +
                `e recrie com os ids retornados.`,
        )
    }

    const weeklySetsByGroup = new Map<string, number>()
    const sessionsByExercise = new Map<string, Set<string>>()

    for (const s of sessions) {
        const exercises = flatExercises(s)

        // E1: sessão vazia.
        if (exercises.length === 0) {
            errors.push(`A sessão "${s.name}" está sem exercícios.`)
            continue
        }
        // E6 / W4: quantidade de exercícios por sessão.
        if (exercises.length > SESSION_MAX_EXERCISES) {
            errors.push(
                `A sessão "${s.name}" tem ${exercises.length} exercícios — o máximo é ${SESSION_MAX_EXERCISES}. Enxugue (5–7 é o ideal).`,
            )
        } else {
            const min = style?.exercises_per_session?.min ?? 3
            const max = style?.exercises_per_session?.max ?? 7
            if (exercises.length < min || exercises.length > max) {
                warnings.push(
                    `Sessão "${s.name}": ${exercises.length} exercícios (faixa preferida: ${min}–${max}).`,
                )
            }
        }

        // E3: mesmo exercício repetido DENTRO da sessão.
        const seenInSession = new Set<string>()
        for (const ex of exercises) {
            if (seenInSession.has(ex.exercise_id)) {
                const name = catalog.get(ex.exercise_id)?.name ?? ex.exercise_id
                errors.push(`A sessão "${s.name}" repete o exercício "${name}".`)
            }
            seenInSession.add(ex.exercise_id)
        }

        // E5 / W6: composto principal na sessão.
        const known = exercises.filter((e) => catalog.has(e.exercise_id))
        if (exercises.length >= SESSION_MIN_FOR_COMPOUND_RULE && known.length > 0) {
            const hasPrimary = known.some((e) => catalog.get(e.exercise_id)!.isPrimary)
            if (!hasPrimary) {
                errors.push(
                    `A sessão "${s.name}" não tem NENHUM composto principal (is_primary_movement) — toda sessão começa com 1–2 compostos.`,
                )
            } else {
                const first = catalog.get(known[0].exercise_id)
                if (first && !first.isPrimary) {
                    warnings.push(
                        `Sessão "${s.name}": começa por um acessório ("${first.name}") — prefira abrir com o composto principal.`,
                    )
                }
            }
        }

        // Volume semanal por grupo (R32: 1º grupo do embed) — sessões agendadas
        // em N dias contam N×. Aquecimento/ativação/condicionamento não contam.
        const timesPerWeek = Math.max(1, new Set(s.scheduled_days ?? []).size || 1)
        for (const ex of exercises) {
            const entry = catalog.get(ex.exercise_id)
            if (!entry?.group) continue
            if (ex.fn && NON_WORKING_FUNCTIONS.has(ex.fn)) continue
            weeklySetsByGroup.set(
                entry.group,
                (weeklySetsByGroup.get(entry.group) ?? 0) + ex.sets * timesPerWeek,
            )
            // W1: repetido em muitas sessões (2× é legítimo — frequência/ênfase).
            const inSessions = sessionsByExercise.get(ex.exercise_id) ?? new Set<string>()
            inSessions.add(s.name)
            sessionsByExercise.set(ex.exercise_id, inSessions)
        }

        // W3: sessão sem agenda.
        if (!s.scheduled_days || s.scheduled_days.length === 0) {
            warnings.push(`Sessão "${s.name}": sem scheduled_days — defina os dias da semana.`)
        }
    }

    // E4: teto ABSOLUTO de volume semanal por grupo.
    const over = [...weeklySetsByGroup.entries()].filter(([, sets]) => sets > ABSOLUTE_GROUP_MAX)
    if (over.length > 0) {
        errors.push(
            `Volume semanal acima do teto (${ABSOLUTE_GROUP_MAX} séries/grupo): ` +
                over.map(([g, sets]) => `${g} = ${sets}`).join('; ') +
                '. Corte séries/exercícios desses grupos — ênfase é treinar MAIS VEZES, não empilhar séries.',
        )
    }

    // W1: mesmo exercício em 3+ sessões distintas.
    for (const [id, inSessions] of sessionsByExercise) {
        if (inSessions.size >= 3) {
            const name = catalog.get(id)?.name ?? id
            warnings.push(`"${name}" aparece em ${inSessions.size} sessões — confira se é intencional.`)
        }
    }

    // W2: acessório rotulado (ou defaultado) como 'main'.
    for (const s of sessions) {
        for (const ex of flatExercises(s)) {
            const entry = catalog.get(ex.exercise_id)
            if (!entry || entry.isPrimary) continue
            if (ex.fn === undefined || ex.fn === 'main') {
                warnings.push(
                    `Sessão "${s.name}": "${entry.name}" é acessório — marque exercise_function: 'accessory'.`,
                )
                break // um aviso por sessão basta; não inundar o corretivo
            }
        }
    }

    return { errors, warnings }
}

// ── Wrapper com DB ───────────────────────────────────────────────────────────

/** Carrega o catálogo mínimo dos exercise_id referenciados nos args. */
export async function loadBuildCatalog(
    admin: SupabaseClient,
    args: BuildProgramArgs,
): Promise<Map<string, CatalogEntry>> {
    const ids = new Set<string>()
    for (const s of args.sessions ?? []) {
        for (const ex of flatExercises(s)) ids.add(ex.exercise_id)
    }
    const map = new Map<string, CatalogEntry>()
    if (ids.size === 0) return map
    const { data } = await admin
        .from('exercises')
        .select('id, name, is_primary_movement, exercise_muscle_groups(muscle_groups(name))')
        .in('id', [...ids])
    for (const e of data ?? []) {
        const emgs = e.exercise_muscle_groups as unknown as Array<{
            muscle_groups: { name: string } | null
        }>
        map.set(e.id as string, {
            name: e.name as string,
            // R32: o grupo "do exercício" é o PRIMEIRO do embed.
            group: emgs?.[0]?.muscle_groups?.name ?? null,
            isPrimary: e.is_primary_movement === true,
        })
    }
    return map
}

/** Corretivo devolvido ao modelo quando o gate bloqueia (mesma família do
 *  read-guard: `blocked` → não cobra, não vira card "executado"). */
export function buildQualityCorrective(v: BuildValidation): Record<string, unknown> {
    return {
        blocked: true,
        quality_errors: v.errors,
        ...(v.warnings.length > 0 ? { quality_warnings: v.warnings } : {}),
        message:
            'O programa NÃO foi criado — viola regras de prescrição. Corrija os pontos em quality_errors ' +
            '(mantendo o resto do programa) e chame a MESMA tool de novo com o programa completo corrigido, ' +
            'NESTE MESMO TURNO. NÃO pergunte ao treinador; ajuste você mesmo. JAMAIS responda prometendo ' +
            'corrigir depois ("aguarde um momento", "vou refazer") — o turno TERMINA na sua resposta e ' +
            'nada mais executa; ou você recria agora, ou admite que não conseguiu.',
    }
}

/**
 * Anexa quality_warnings ao resultado de um create BEM-SUCEDIDO (envelope MCP
 * `{content:[{text:'<json>'}]}`). Defensivo: qualquer formato inesperado passa
 * intocado — aviso nunca pode quebrar um sucesso.
 */
export function annotateResultWithWarnings(result: unknown, warnings: string[]): unknown {
    if (warnings.length === 0) return result
    if (!result || typeof result !== 'object') return result
    const env = result as { content?: Array<{ type?: string; text?: string }>; isError?: boolean }
    if (env.isError || !Array.isArray(env.content) || typeof env.content[0]?.text !== 'string') {
        return result
    }
    try {
        const payload = JSON.parse(env.content[0].text) as Record<string, unknown>
        payload.quality_warnings = warnings
        return {
            ...env,
            content: [{ ...env.content[0], text: JSON.stringify(payload) }, ...env.content.slice(1)],
        }
    } catch {
        return result
    }
}
