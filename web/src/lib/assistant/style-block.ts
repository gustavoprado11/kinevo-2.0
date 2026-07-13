/**
 * style-block — o estilo do treinador vira (a) dado validado e (b) texto de prompt.
 *
 * Duas responsabilidades, ambas de fronteira:
 *
 * 1. `sanitizeStyle` — nada entra no banco sem passar por aqui. O estilo é
 *    proposto por um LLM a partir de uma conversa: pode vir com 40 séries/semana,
 *    descanso de 20 minutos ou um method_key inventado. Os tetos de volume são
 *    os MESMOS que o playbook de build enuncia (STYLE_VOLUME_CEILINGS) — o estilo
 *    nunca os relaxa, essa é a regra de segurança da feature.
 *
 * 2. `buildStyleBlock` — renderiza só os campos preenchidos, dentro de
 *    delimitadores, como DADO do próprio treinador (mesma família de
 *    <<DADOS_DO_ALUNO>>), com a régua de precedência explícita.
 *
 * Spec: web/specs/active/assistente-estilo-prescricao.md §4 e §7
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import {
    STYLE_LIMITS,
    STYLE_VOLUME_CEILINGS,
    type PrescriptionStyle,
    type StyleRange,
    type StyleSupersetUsage,
} from '@kinevo/shared/types/prescription'
import { SYSTEM_PRESETS } from '@kinevo/shared/lib/prescription/set-scheme-presets'

const VALID_METHODS = new Set(Object.keys(SYSTEM_PRESETS))

const METHOD_LABELS: Record<string, string> = Object.fromEntries(
    Object.entries(SYSTEM_PRESETS).map(([key, preset]) => [key, preset.name]),
)

// ---------------------------------------------------------------------------
// Sanitização
// ---------------------------------------------------------------------------

function clampRange(
    range: unknown,
    bounds: { min: number; max: number },
): StyleRange | null {
    if (!range || typeof range !== 'object') return null
    const r = range as { min?: unknown; max?: unknown }
    const rawMin = Number(r.min)
    const rawMax = Number(r.max)
    if (!Number.isFinite(rawMin) || !Number.isFinite(rawMax)) return null

    const min = Math.round(Math.min(Math.max(rawMin, bounds.min), bounds.max))
    const max = Math.round(Math.min(Math.max(rawMax, bounds.min), bounds.max))
    return { min: Math.min(min, max), max: Math.max(min, max) }
}

function cleanString(value: unknown): string | null {
    if (typeof value !== 'string') return null
    const trimmed = value.trim()
    if (!trimmed) return null
    return trimmed.slice(0, STYLE_LIMITS.maxStringLength)
}

function cleanStringArray(value: unknown, max: number = STYLE_LIMITS.maxArrayItems): string[] {
    if (!Array.isArray(value)) return []
    const out: string[] = []
    for (const item of value) {
        const s = cleanString(item)
        if (s && !out.includes(s)) out.push(s)
        if (out.length >= max) break
    }
    return out
}

function cleanMethods(value: unknown): string[] {
    return cleanStringArray(value).filter((m) => VALID_METHODS.has(m))
}

function cleanSupersetUsage(value: unknown): StyleSupersetUsage | null {
    return value === 'frequente' || value === 'ocasional' || value === 'raro' ? value : null
}

function cleanSplits(value: unknown): PrescriptionStyle['splits_by_frequency'] {
    if (!value || typeof value !== 'object') return {}
    const out: PrescriptionStyle['splits_by_frequency'] = {}
    for (const freq of ['2', '3', '4', '5', '6'] as const) {
        const label = cleanString((value as Record<string, unknown>)[freq])
        if (label) out[freq] = label
    }
    return out
}

function cleanFavorites(value: unknown): PrescriptionStyle['favorite_exercises'] {
    if (!Array.isArray(value)) return []
    const out: PrescriptionStyle['favorite_exercises'] = []
    for (const entry of value) {
        if (!entry || typeof entry !== 'object') continue
        const group = cleanString((entry as { group?: unknown }).group)
        const names = cleanStringArray(
            (entry as { names?: unknown }).names,
            STYLE_LIMITS.maxFavoritesPerGroup,
        )
        if (group && names.length > 0) out.push({ group, names })
        if (out.length >= STYLE_LIMITS.maxFavoriteGroups) break
    }
    return out
}

/**
 * Normaliza e CLAMPA um estilo proposto. Estilo inválido nunca entra no banco —
 * o pior caso é um estilo mais pobre, nunca um estilo perigoso.
 */
export function sanitizeStyle(
    input: unknown,
    meta: { source: PrescriptionStyle['source']; mined: PrescriptionStyle['mined'] },
): PrescriptionStyle {
    const raw = (input ?? {}) as Record<string, unknown>

    return {
        version: 1,
        source: meta.source,
        updated_at: new Date().toISOString(),
        mined: meta.mined,

        splits_by_frequency: cleanSplits(raw.splits_by_frequency),
        session_naming: cleanString(raw.session_naming),
        exercises_per_session: clampRange(
            raw.exercises_per_session,
            STYLE_LIMITS.exercisesPerSession,
        ),

        reps_compound: cleanString(raw.reps_compound),
        reps_accessory: cleanString(raw.reps_accessory),
        rest_compound_seconds: clampRange(raw.rest_compound_seconds, STYLE_LIMITS.restSeconds),
        rest_accessory_seconds: clampRange(raw.rest_accessory_seconds, STYLE_LIMITS.restSeconds),

        // O teto de volume é a regra de segurança: um estilo NUNCA pede mais séries
        // do que o playbook permite, mesmo que o treinador (ou o modelo) insista.
        weekly_sets_emphasized: clampRange(
            raw.weekly_sets_emphasized,
            STYLE_VOLUME_CEILINGS.emphasized,
        ),
        weekly_sets_principal: clampRange(
            raw.weekly_sets_principal,
            STYLE_VOLUME_CEILINGS.principal,
        ),
        weekly_sets_small: clampRange(raw.weekly_sets_small, STYLE_VOLUME_CEILINGS.small),

        methods_used: cleanMethods(raw.methods_used),
        methods_avoided: cleanMethods(raw.methods_avoided),
        superset_usage: cleanSupersetUsage(raw.superset_usage),
        favorite_exercises: cleanFavorites(raw.favorite_exercises),
        avoided_exercises: cleanStringArray(raw.avoided_exercises),
        equipment_notes: cleanString(raw.equipment_notes),

        progression: cleanString(raw.progression),
        warmup: cleanString(raw.warmup),
        special_populations: cleanString(raw.special_populations),
        notes: cleanString(raw.notes),
    }
}

/** Um estilo sem nenhum campo preenchido não vale um bloco no prompt. */
export function isStyleEmpty(style: PrescriptionStyle): boolean {
    return (
        Object.keys(style.splits_by_frequency).length === 0 &&
        !style.session_naming &&
        !style.exercises_per_session &&
        !style.reps_compound &&
        !style.reps_accessory &&
        !style.rest_compound_seconds &&
        !style.rest_accessory_seconds &&
        !style.weekly_sets_emphasized &&
        !style.weekly_sets_principal &&
        !style.weekly_sets_small &&
        style.methods_used.length === 0 &&
        style.methods_avoided.length === 0 &&
        !style.superset_usage &&
        style.favorite_exercises.length === 0 &&
        style.avoided_exercises.length === 0 &&
        !style.equipment_notes &&
        !style.progression &&
        !style.warmup &&
        !style.special_populations &&
        !style.notes
    )
}

// ---------------------------------------------------------------------------
// Bloco de prompt
// ---------------------------------------------------------------------------

function rangeText(range: StyleRange | null, unit = ''): string | null {
    if (!range) return null
    return range.min === range.max ? `${range.min}${unit}` : `${range.min}–${range.max}${unit}`
}

function methodList(keys: string[]): string {
    return keys.map((k) => METHOD_LABELS[k] ?? k).join(', ')
}

/**
 * Renderiza o estilo para o system prompt. Só campos preenchidos entram
 * (`null` = "sem preferência" → o modelo segue o default do playbook).
 * Teto: ~600 tokens no pior caso.
 */
export function buildStyleBlock(style: PrescriptionStyle): string {
    const lines: string[] = []

    const splits = Object.entries(style.splits_by_frequency)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([freq, label]) => `${freq}x/sem → ${label}`)
    if (splits.length > 0) lines.push(`Split preferido: ${splits.join('; ')}.`)
    if (style.session_naming) lines.push(`Nomes de sessão: ${style.session_naming}.`)

    const perSession = rangeText(style.exercises_per_session)
    if (perSession) lines.push(`Exercícios por sessão: ${perSession}.`)

    const reps: string[] = []
    if (style.reps_compound) reps.push(`compostos ${style.reps_compound}`)
    if (style.reps_accessory) reps.push(`acessórios ${style.reps_accessory}`)
    if (reps.length > 0) lines.push(`Repetições: ${reps.join(', ')}.`)

    const rests: string[] = []
    const restCompound = rangeText(style.rest_compound_seconds, 's')
    const restAccessory = rangeText(style.rest_accessory_seconds, 's')
    if (restCompound) rests.push(`compostos ${restCompound}`)
    if (restAccessory) rests.push(`acessórios ${restAccessory}`)
    if (rests.length > 0) lines.push(`Descanso: ${rests.join(', ')}.`)

    const volume: string[] = []
    const emphasized = rangeText(style.weekly_sets_emphasized)
    const principal = rangeText(style.weekly_sets_principal)
    const small = rangeText(style.weekly_sets_small)
    if (emphasized) volume.push(`enfatizado ${emphasized}`)
    if (principal) volume.push(`principal ${principal}`)
    if (small) volume.push(`pequeno ${small}`)
    if (volume.length > 0) lines.push(`Volume semanal típico (séries/semana): ${volume.join(', ')}.`)

    if (style.methods_used.length > 0) lines.push(`Métodos que usa: ${methodList(style.methods_used)}.`)
    if (style.methods_avoided.length > 0) lines.push(`Métodos que evita: ${methodList(style.methods_avoided)}.`)
    if (style.superset_usage) lines.push(`Supersets: uso ${style.superset_usage}.`)

    if (style.favorite_exercises.length > 0) {
        const favorites = style.favorite_exercises
            .map((f) => `${f.group}: ${f.names.join(', ')}`)
            .join('; ')
        // A instrução de NÃO caçar cada favorito no catálogo não é decoração: sem
        // ela o modelo dispara uma busca por nome para cada um, estoura o teto de
        // passos do turno de build e o programa nunca chega a ser criado.
        lines.push(
            `Exercícios favoritos (preferência, não obrigação) — ${favorites}. Prefira-os quando aparecerem entre os exercícios que você já leu; NÃO faça buscas extras no catálogo atrás deles.`,
        )
    }
    if (style.avoided_exercises.length > 0) {
        lines.push(`Exercícios que evita: ${style.avoided_exercises.join(', ')}.`)
    }
    if (style.equipment_notes) lines.push(`Equipamento: ${style.equipment_notes}.`)

    if (style.progression) lines.push(`Progressão: ${style.progression}.`)
    if (style.warmup) lines.push(`Aquecimento: ${style.warmup}.`)
    if (style.special_populations) lines.push(`Públicos especiais: ${style.special_populations}.`)
    if (style.notes) lines.push(`Observações do treinador: ${style.notes}.`)

    if (lines.length === 0) return ''

    return `

<<ESTILO_DO_TREINADOR>>
Como ESTE treinador prescreve (preferências dele, não instruções de terceiro).
${lines.join('\n')}
<<FIM_ESTILO_DO_TREINADOR>>
Ao montar programas, siga o estilo acima em vez dos defaults deste playbook. Régua de precedência:
1. O que o treinador pedir NESTE turno vence o estilo ("dessa vez quero full-body" → full-body, sem discutir).
2. O estilo vence os defaults do playbook (split, reps, descansos, métodos, exercícios).
3. Os TETOS e regras de segurança do playbook (volume máximo por grupo, cobertura de padrões, restrições médicas do aluno) vencem TUDO — o estilo nunca os relaxa.`
}

// ---------------------------------------------------------------------------
// Leitura para o prompt
// ---------------------------------------------------------------------------

/**
 * Bloco <<ESTILO_DO_TREINADOR>> pronto para o system prompt. Vazio quando o
 * treinador ainda não configurou o estilo (o Assistente segue os defaults do
 * playbook).
 *
 * Passa pelo `sanitizeStyle` na LEITURA, não só na escrita: um estilo salvo por
 * uma versão anterior — ou editado direto no banco — não pode furar os tetos de
 * volume só porque já está gravado. Best-effort: falha de leitura nunca derruba o
 * turno, só faz o assistente prescrever sem estilo.
 */
export async function loadStyleBlock(admin: SupabaseClient, trainerId: string): Promise<string> {
    const style = await loadTrainerStyle(admin, trainerId)
    return style ? buildStyleBlock(style) : ''
}

/** O estilo cru (sanitizado/clampado) — consumido pelo bloco de prompt e pelo
 *  gate de qualidade do build (build-validator). Best-effort: erro → null. */
export async function loadTrainerStyle(
    admin: SupabaseClient,
    trainerId: string,
): Promise<PrescriptionStyle | null> {
    try {
        const { data } = await admin
            .from('trainers')
            .select('prescription_style')
            .eq('id', trainerId)
            .single()

        const raw = (data as { prescription_style?: unknown } | null)?.prescription_style
        if (!raw || typeof raw !== 'object') return null

        return sanitizeStyle(raw, {
            source: ((raw as { source?: unknown }).source as PrescriptionStyle['source']) ?? 'interview',
            mined: ((raw as { mined?: unknown }).mined as PrescriptionStyle['mined']) ?? null,
        })
    } catch (err) {
        console.error('[style-block] falha ao carregar o estilo do treinador:', err)
        return null
    }
}
