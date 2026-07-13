/**
 * style-miner — deduz o estilo de prescrição do treinador dos programas que ELE
 * já montou, para a entrevista só perguntar o que os dados não respondem.
 *
 * Molde do `lib/prescription/trainer-patterns.ts`: análise PURA (testável, sem
 * DB) + um wrapper fino que busca. A diferença é o sinal: aquele minera os DIFFS
 * de edição do canvas; este lê a árvore dos programas prontos.
 *
 * Nada do que sai daqui é salvo direto: o resultado vira uma PROPOSTA editável na
 * entrevista. Com 5 programas a estatística é grosseira de propósito — quem
 * corrige é o treinador, não mais matemática.
 *
 * Spec: web/specs/active/assistente-estilo-prescricao.md §5
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { PrescriptionStyle, StyleRange } from '@kinevo/shared/types/prescription'
import { SYSTEM_PRESETS } from '@kinevo/shared/lib/prescription/set-scheme-presets'
import type { StyleSlotId } from '@/lib/assistant/style-slots'

/** Piso de programas para minerar (D3). Abaixo disso: entrevista completa. */
export const MIN_PROGRAMS_TO_MINE = 5
/** Janela de análise — os N programas mais recentes (mesmo teto do precedente). */
export const ANALYSIS_WINDOW = 30

// ---------------------------------------------------------------------------
// Entrada da função pura — o mínimo que a análise precisa ver
// ---------------------------------------------------------------------------

export interface MinedItem {
    /** 'main' | 'accessory' | ... — pode faltar em programa antigo. */
    exercise_function: string | null
    sets: number | null
    reps: string | null
    rest_seconds: number | null
    method_key: string | null
    exercise_name: string | null
    muscle_group: string | null
    /** true = item dentro de um superset. */
    in_superset: boolean
}

export interface MinedWorkout {
    name: string
    /** Dias da semana (0=dom..6=sáb). Vazio = não agendado. */
    scheduled_days: number[]
    items: MinedItem[]
}

export interface MinedProgram {
    id: string
    workouts: MinedWorkout[]
}

export interface StyleMiningResult {
    style: Partial<PrescriptionStyle>
    /** Slots que a mineração já respondeu — a entrevista pula. */
    minedSlots: StyleSlotId[]
    programsAnalyzed: number
}

const VALID_METHOD_KEYS = new Set(Object.keys(SYSTEM_PRESETS))

// ---------------------------------------------------------------------------
// Helpers estatísticos — medianas grosseiras, e é isso mesmo
// ---------------------------------------------------------------------------

function percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0
    const idx = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p)))
    return sorted[idx]
}

/** Faixa p25–p75 arredondada. null quando não há amostra suficiente. */
function rangeFrom(values: number[], minSamples = 3): StyleRange | null {
    const clean = values.filter((v) => Number.isFinite(v) && v > 0).sort((a, b) => a - b)
    if (clean.length < minSamples) return null
    const min = Math.round(percentile(clean, 0.25))
    const max = Math.round(percentile(clean, 0.75))
    return { min, max: Math.max(min, max) }
}

function mode<T>(values: T[]): T | null {
    const counts = new Map<T, number>()
    for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
    let best: T | null = null
    let bestCount = 0
    for (const [v, c] of counts) {
        if (c > bestCount) {
            best = v
            bestCount = c
        }
    }
    return best
}

/** O treinador escreve "8-12", "8 a 12", "10". Normaliza para "8–12" / "10". */
function normalizeReps(reps: string): string | null {
    const t = reps.trim().toLowerCase()
    if (!t) return null
    const m = t.match(/(\d{1,2})\s*(?:[-–—]|a|até)\s*(\d{1,2})/)
    if (m) return `${m[1]}–${m[2]}`
    const single = t.match(/^(\d{1,2})$/)
    return single ? single[1] : null
}

/** Composto vs acessório. `exercise_function` quando existe; senão, o nome. */
const COMPOUND_NAME_RE =
    /(agachamento|supino|levantamento terra|terra|remada|desenvolvimento|barra fixa|puxada|leg press|avanço|afundo|paralela|stiff|hip thrust)/i

function isCompound(item: MinedItem): boolean {
    const fn = (item.exercise_function ?? '').toLowerCase()
    if (fn === 'main') return true
    if (fn === 'accessory' || fn === 'warmup' || fn === 'activation' || fn === 'conditioning') return false
    return COMPOUND_NAME_RE.test(item.exercise_name ?? '')
}

/** Rótulo do split a partir dos grupos dominantes de cada sessão. */
function labelSplit(workouts: MinedWorkout[]): string | null {
    if (workouts.length === 0) return null

    const shapes = workouts.map((w) => {
        const groups = new Set(
            w.items.map((i) => (i.muscle_group ?? '').toLowerCase()).filter(Boolean),
        )
        const has = (...needles: string[]) =>
            [...groups].some((g) => needles.some((n) => g.includes(n)))

        const lower = has('quadríceps', 'quadriceps', 'posterior', 'glúteo', 'gluteo', 'panturrilha')
        const push = has('peito', 'ombro', 'tríceps', 'triceps')
        const pull = has('costas', 'bíceps', 'biceps', 'dorsal')

        if (lower && (push || pull)) return 'full'
        if (push && pull) return 'upper'
        if (lower) return 'lower'
        if (push) return 'push'
        if (pull) return 'pull'
        return 'outro'
    })

    const set = new Set(shapes)
    if (shapes.every((s) => s === 'full')) return 'Full-body'
    if (set.has('push') && set.has('pull') && set.has('lower')) return 'PPL (push/pull/legs)'
    if (set.has('upper') && set.has('lower') && !set.has('push') && !set.has('pull')) {
        return 'Upper/Lower'
    }
    if (set.has('push') || set.has('pull')) return 'Por grupo muscular'
    return null
}

const LETTER_NAME_RE = /^treino\s+[a-z]$/i

// ---------------------------------------------------------------------------
// Análise pura
// ---------------------------------------------------------------------------

/**
 * Deduz o estilo a partir dos programas. Abaixo do piso (5), devolve vazio —
 * estatística de 2 programas não é estilo, é ruído.
 */
export function mineStyle(programs: MinedProgram[]): StyleMiningResult {
    if (programs.length < MIN_PROGRAMS_TO_MINE) {
        return { style: {}, minedSlots: [], programsAnalyzed: programs.length }
    }

    const style: Partial<PrescriptionStyle> = {}
    const minedSlots: StyleSlotId[] = []

    // ── split + nomes de sessão ──────────────────────────────────────────────
    const splitsByFreq: Partial<Record<'2' | '3' | '4' | '5' | '6', string[]>> = {}
    const namingVotes: string[] = []

    for (const program of programs) {
        const trained = program.workouts.filter((w) => w.items.length > 0)
        if (trained.length === 0) continue

        const daysPerWeek = trained.reduce(
            (total, w) => total + (w.scheduled_days.length > 0 ? w.scheduled_days.length : 1),
            0,
        )
        const freq = Math.min(6, Math.max(2, daysPerWeek)) as 2 | 3 | 4 | 5 | 6
        const label = labelSplit(trained)
        if (label) {
            const key = String(freq) as '2' | '3' | '4' | '5' | '6'
            ;(splitsByFreq[key] ??= []).push(label)
        }

        for (const w of trained) {
            namingVotes.push(LETTER_NAME_RE.test(w.name.trim()) ? 'Letras (Treino A/B/C)' : 'Descritivo (por foco/grupo)')
        }
    }

    const splits: PrescriptionStyle['splits_by_frequency'] = {}
    for (const [freq, labels] of Object.entries(splitsByFreq)) {
        const winner = mode(labels ?? [])
        if (winner) splits[freq as '2' | '3' | '4' | '5' | '6'] = winner
    }
    if (Object.keys(splits).length > 0) {
        style.splits_by_frequency = splits
        style.session_naming = mode(namingVotes)
        minedSlots.push('split')
    }

    // ── exercícios por sessão, reps, descansos ───────────────────────────────
    const itemsPerWorkout: number[] = []
    const compoundReps: string[] = []
    const accessoryReps: string[] = []
    const compoundRests: number[] = []
    const accessoryRests: number[] = []
    const methodCounts = new Map<string, Set<string>>() // method → programas distintos
    const exerciseByGroup = new Map<string, Map<string, Set<string>>>() // grupo → exercício → programas
    const weeklySetsPerProgram: Array<Map<string, number>> = []
    let programsWithSuperset = 0

    for (const program of programs) {
        const weekly = new Map<string, number>()
        let hasSuperset = false

        for (const workout of program.workouts) {
            const exercises = workout.items
            if (exercises.length === 0) continue
            itemsPerWorkout.push(exercises.length)
            // Sessão sem dias agendados conta como 1x/semana (é o que o app faz).
            const timesPerWeek = Math.max(1, workout.scheduled_days.length)

            for (const item of exercises) {
                if (item.in_superset) hasSuperset = true

                const compound = isCompound(item)
                const reps = item.reps ? normalizeReps(item.reps) : null
                if (reps) (compound ? compoundReps : accessoryReps).push(reps)
                if (item.rest_seconds && item.rest_seconds > 0) {
                    ;(compound ? compoundRests : accessoryRests).push(item.rest_seconds)
                }

                if (item.method_key && VALID_METHOD_KEYS.has(item.method_key)) {
                    const programs_ = methodCounts.get(item.method_key) ?? new Set<string>()
                    programs_.add(program.id)
                    methodCounts.set(item.method_key, programs_)
                }

                const group = item.muscle_group?.trim()
                if (group) {
                    weekly.set(group, (weekly.get(group) ?? 0) + (item.sets ?? 0) * timesPerWeek)

                    const name = item.exercise_name?.trim()
                    if (name) {
                        const byExercise = exerciseByGroup.get(group) ?? new Map<string, Set<string>>()
                        const seen = byExercise.get(name) ?? new Set<string>()
                        seen.add(program.id)
                        byExercise.set(name, seen)
                        exerciseByGroup.set(group, byExercise)
                    }
                }
            }
        }

        if (hasSuperset) programsWithSuperset += 1
        if (weekly.size > 0) weeklySetsPerProgram.push(weekly)
    }

    style.exercises_per_session = rangeFrom(itemsPerWorkout)

    const repsCompound = mode(compoundReps)
    const repsAccessory = mode(accessoryReps)
    if (repsCompound || repsAccessory) {
        style.reps_compound = repsCompound
        style.reps_accessory = repsAccessory
        minedSlots.push('reps')
    }

    const restCompound = rangeFrom(compoundRests)
    const restAccessory = rangeFrom(accessoryRests)
    if (restCompound || restAccessory) {
        style.rest_compound_seconds = restCompound
        style.rest_accessory_seconds = restAccessory
        minedSlots.push('rest')
    }

    // ── volume semanal por grupo ─────────────────────────────────────────────
    // O grupo mais volumoso de cada programa é o "enfatizado" daquele programa; a
    // mediana dos demais vira o "principal". Grupo pequeno sai do catálogo abaixo.
    if (weeklySetsPerProgram.length >= MIN_PROGRAMS_TO_MINE) {
        const emphasized: number[] = []
        const principal: number[] = []
        const small: number[] = []

        for (const weekly of weeklySetsPerProgram) {
            const entries = [...weekly.entries()].sort((a, b) => b[1] - a[1])
            if (entries.length === 0) continue
            emphasized.push(entries[0][1])
            for (const [group, sets] of entries.slice(1)) {
                ;(isSmallGroup(group) ? small : principal).push(sets)
            }
        }

        style.weekly_sets_emphasized = rangeFrom(emphasized, MIN_PROGRAMS_TO_MINE)
        style.weekly_sets_principal = rangeFrom(principal)
        style.weekly_sets_small = rangeFrom(small)
        if (style.weekly_sets_emphasized) minedSlots.push('volume')
    }

    // ── métodos ──────────────────────────────────────────────────────────────
    const methodsUsed = [...methodCounts.entries()]
        .filter(([, programIds]) => programIds.size >= 2)
        .map(([method]) => method)
    if (methodsUsed.length > 0) {
        style.methods_used = methodsUsed
        style.methods_avoided = []
        minedSlots.push('methods')
    }

    // ── supersets ────────────────────────────────────────────────────────────
    const supersetShare = programsWithSuperset / programs.length
    style.superset_usage = supersetShare >= 0.5 ? 'frequente' : supersetShare >= 0.2 ? 'ocasional' : 'raro'
    minedSlots.push('supersets')

    // ── favoritos por grupo ──────────────────────────────────────────────────
    const favorites: PrescriptionStyle['favorite_exercises'] = []
    const groupsByVolume = [...exerciseByGroup.entries()].sort(
        (a, b) => totalPrograms(b[1]) - totalPrograms(a[1]),
    )
    for (const [group, byExercise] of groupsByVolume.slice(0, 5)) {
        const names = [...byExercise.entries()]
            .filter(([, programIds]) => programIds.size >= 2)
            .sort((a, b) => b[1].size - a[1].size)
            .slice(0, 4)
            .map(([name]) => name)
        if (names.length > 0) favorites.push({ group, names })
    }
    if (favorites.length > 0) style.favorite_exercises = favorites

    return { style, minedSlots, programsAnalyzed: programs.length }
}

function totalPrograms(byExercise: Map<string, Set<string>>): number {
    let total = 0
    for (const programIds of byExercise.values()) total += programIds.size
    return total
}

/** Grupos "pequenos" — mesma lista do motor de prescrição (PRESCRIPTION_CONSTRAINTS). */
const SMALL_GROUPS = [
    'bíceps',
    'tríceps',
    'panturrilha',
    'abdominais',
    'adutores',
    'antebraço',
    'trapézio',
]

function isSmallGroup(group: string): boolean {
    const g = group.toLowerCase()
    return SMALL_GROUPS.some((s) => g.includes(s))
}

// ---------------------------------------------------------------------------
// Wrapper com DB
// ---------------------------------------------------------------------------

interface RawItem {
    item_type: string | null
    exercise_function: string | null
    sets: number | null
    reps: string | null
    rest_seconds: number | null
    method_key: string | null
    exercise_name: string | null
    exercise_muscle_group: string | null
    parent_item_id: string | null
}

interface RawWorkout {
    name: string | null
    scheduled_days: number[] | null
    assigned_workout_items: RawItem[] | null
}

interface RawProgram {
    id: string
    assigned_workouts: RawWorkout[] | null
}

/**
 * Lê os programas que RODARAM (rascunho não conta como estilo) e minera.
 *
 * Limitação registrada (spec §5.1): não existe coluna de proveniência em
 * `assigned_programs`, então um programa que a própria IA montou e o treinador
 * ativou sem tocar entra na conta. O corretor é a proposta editável — nunca
 * salvamos estilo sem o treinador aprovar.
 */
export async function mineTrainerStyle(
    admin: SupabaseClient,
    trainerId: string,
): Promise<StyleMiningResult> {
    const { data, error } = await admin
        .from('assigned_programs')
        .select(
            `id,
             assigned_workouts(
                 name, scheduled_days,
                 assigned_workout_items(
                     item_type, exercise_function, sets, reps, rest_seconds,
                     method_key, exercise_name, exercise_muscle_group, parent_item_id
                 )
             )`,
        )
        .eq('trainer_id', trainerId)
        .in('status', ['active', 'completed', 'expired'])
        .order('created_at', { ascending: false })
        .limit(ANALYSIS_WINDOW)

    if (error || !data) {
        console.error('[style-miner] falha ao ler programas:', error?.message)
        return { style: {}, minedSlots: [], programsAnalyzed: 0 }
    }

    const programs: MinedProgram[] = (data as unknown as RawProgram[]).map((p) => ({
        id: p.id,
        workouts: (p.assigned_workouts ?? []).map((w) => ({
            name: w.name ?? '',
            scheduled_days: w.scheduled_days ?? [],
            items: (w.assigned_workout_items ?? [])
                .filter((i) => i.item_type === 'exercise')
                .map((i) => ({
                    exercise_function: i.exercise_function,
                    sets: i.sets,
                    reps: i.reps,
                    rest_seconds: i.rest_seconds,
                    method_key: i.method_key,
                    exercise_name: i.exercise_name,
                    muscle_group: i.exercise_muscle_group,
                    in_superset: i.parent_item_id !== null,
                })),
        })),
    }))

    return mineStyle(programs)
}
