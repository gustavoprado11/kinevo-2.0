// MIRROR OF mobile/lib/assessmentComputed.ts
// keep in sync — drift detectado em revisão. 100% puro TS, copia literal
// (helpers wrap M2 engine sem deps de UI).

import {
    bmi,
    waistHipRatio,
    classifyBMI,
    classifyWaistHipRatio,
    FormulaInputError,
    PROTOCOLS,
    type ProtocolId,
    type Sex,
    type SkinfoldInput,
    type SkinfoldSite,
} from '@kinevo/shared/lib/assessment-protocols'
import type {
    AssessmentTest,
    AssessmentTemplateSchema,
    ComputedMetrics,
    MeasurementInput,
} from '@kinevo/shared/types/assessments'

export const SUBJECT_SEX_KEY = 'subject_sex'
export const SUBJECT_AGE_KEY = 'subject_age_years'

export function pickNumeric(ms: MeasurementInput[], key: string): number | undefined {
    for (let i = ms.length - 1; i >= 0; i--) {
        const m = ms[i]!
        if (
            m.metric_key === key
            && m.is_selected !== false
            && typeof m.value_numeric === 'number'
            && Number.isFinite(m.value_numeric)
        ) {
            return m.value_numeric
        }
    }
    return undefined
}

export function pickText(ms: MeasurementInput[], key: string): string | undefined {
    for (let i = ms.length - 1; i >= 0; i--) {
        const m = ms[i]!
        if (m.metric_key === key && typeof m.value_text === 'string' && m.value_text.length > 0) {
            return m.value_text
        }
    }
    return undefined
}

export function readSubjectContext(ms: MeasurementInput[]): { sex: Sex | null; age_years: number | null } {
    const sexRaw = pickText(ms, SUBJECT_SEX_KEY)
    const ageRaw = pickNumeric(ms, SUBJECT_AGE_KEY)
    const sex: Sex | null = sexRaw === 'male' || sexRaw === 'female' ? sexRaw : null
    const age_years = typeof ageRaw === 'number' && ageRaw > 0 ? ageRaw : null
    return { sex, age_years }
}

export function evaluateComputed(
    test: Extract<AssessmentTest, { type: 'computed' }>,
    measurements: MeasurementInput[],
): { value: number | null; error: string | null } {
    const inputs = test.inputs ?? []
    try {
        if (test.formula_id === 'bmi') {
            const w = inputs[0] ? pickNumeric(measurements, inputs[0]) : undefined
            const h = inputs[1] ? heightMeters(measurements, inputs[1]) : undefined
            if (w === undefined || h === undefined) return { value: null, error: null }
            return { value: bmi(w, h), error: null }
        }
        if (test.formula_id === 'rcq') {
            const wa = inputs[0] ? pickNumeric(measurements, inputs[0]) : undefined
            const hi = inputs[1] ? pickNumeric(measurements, inputs[1]) : undefined
            if (wa === undefined || hi === undefined) return { value: null, error: null }
            return { value: waistHipRatio(wa, hi), error: null }
        }
        return { value: null, error: null }
    } catch (err) {
        if (err instanceof FormulaInputError) {
            return { value: null, error: errorMessageForField(err.field) }
        }
        throw err
    }
}

function errorMessageForField(field: string): string {
    switch (field) {
        case 'weight_kg': return 'Peso inválido'
        case 'height_m': return 'Estatura inválida (use metros)'
        case 'waist_cm': return 'Cintura inválida'
        case 'hip_cm': return 'Quadril inválido'
        case 'age_years': return 'Idade inválida'
        case 'density': return 'Densidade inválida'
        default: return 'Verifique os inputs'
    }
}

export function isComputedReady(
    test: Extract<AssessmentTest, { type: 'computed' }>,
    measurements: MeasurementInput[],
): boolean {
    for (const key of test.inputs ?? []) {
        if (pickNumeric(measurements, key) === undefined) return false
    }
    return true
}

export function buildComputedMetricsFromSchema(
    schema: AssessmentTemplateSchema | null,
    measurements: MeasurementInput[],
): ComputedMetrics {
    const out: ComputedMetrics = {}
    if (!schema) return out
    for (const sec of schema.sections ?? []) {
        for (const t of sec.tests ?? []) {
            if (t.type !== 'computed') continue
            const r = evaluateComputed(t, measurements)
            if (r.value !== null && Number.isFinite(r.value)) {
                out[t.metric_key] = r.value
            }
        }
    }
    return out
}

export function pickWeightKg(ms: MeasurementInput[]): number | undefined {
    return pickNumeric(ms, 'weight') ?? pickNumeric(ms, 'weight_kg')
}

// Resolve uma medição de estatura para METROS. O builder de avaliação emite
// `height_cm` (centímetros); os templates de sistema usam `height_m` (metros).
// bmi() exige metros. Converte por chave (_cm) ou magnitude (>3 → veio em cm).
function heightMeters(ms: MeasurementInput[], key: string): number | undefined {
    const raw = pickNumeric(ms, key)
    if (raw === undefined) return undefined
    return key.endsWith('_cm') || raw > 3 ? raw / 100 : raw
}

export function pickHeightM(ms: MeasurementInput[]): number | undefined {
    return heightMeters(ms, 'height') ?? heightMeters(ms, 'height_m') ?? heightMeters(ms, 'height_cm')
}

export function extractSkinfoldsForEngine(ms: MeasurementInput[]): SkinfoldInput {
    const out: SkinfoldInput = {}
    for (const m of ms) {
        if (typeof m.value_numeric !== 'number' || !Number.isFinite(m.value_numeric)) continue
        if (m.is_selected === false) continue
        if (!m.metric_key.startsWith('skinfold_')) continue
        const site = m.metric_key.slice('skinfold_'.length) as SkinfoldSite
        out[site] = m.value_numeric
    }
    return out
}

export function detectProtocol(
    schema: AssessmentTemplateSchema | null,
    measurements: MeasurementInput[],
    sex: Sex,
): ProtocolId | null {
    if (schema) {
        for (const sec of schema.sections ?? []) {
            for (const t of sec.tests ?? []) {
                if (t.type === 'protocol') return t.protocol
            }
        }
    }
    const sf = extractSkinfoldsForEngine(measurements)
    const captured = new Set(Object.keys(sf))
    if (captured.size === 0) return null
    for (const def of Object.values(PROTOCOLS)) {
        const entry = def.required_sites.find((r) => r.sex === sex)
        if (!entry) continue
        if (entry.sites.every((s) => captured.has(s))) {
            return def.id
        }
    }
    return null
}

export { classifyBMI, classifyWaistHipRatio }
