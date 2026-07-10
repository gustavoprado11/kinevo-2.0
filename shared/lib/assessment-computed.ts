// ============================================================================
// Kinevo — Assessment computed helpers (SHARED, single source of truth)
// ============================================================================
// Envolve o motor M2 (assessment-protocols) sem deps de UI: leitura de medições,
// avaliação de testes `computed`, extração de dobras e seleção de protocolo.
//
// Antes existiam duas CÓPIAS-ESPELHO (web/src/lib/assessment-computed.ts e
// mobile/lib/assessmentComputed.ts) que driftaram (ex.: detectProtocol). Este
// módulo unifica; os dois arquivos locais agora só re-exportam daqui.
// ============================================================================

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
} from './assessment-protocols';
import type {
    AssessmentTest,
    AssessmentTemplateSchema,
    ComputedMetrics,
    MeasurementInput,
} from '../types/assessments';

export const SUBJECT_SEX_KEY = 'subject_sex';
export const SUBJECT_AGE_KEY = 'subject_age_years';

/**
 * Last-write-wins lookup of a numeric measurement by metric_key, ignoring rows
 * with `is_selected === false` (e.g. multi-attempt history rows).
 */
export function pickNumeric(ms: MeasurementInput[], key: string): number | undefined {
    for (let i = ms.length - 1; i >= 0; i--) {
        const m = ms[i]!;
        if (
            m.metric_key === key
            && m.is_selected !== false
            && typeof m.value_numeric === 'number'
            && Number.isFinite(m.value_numeric)
        ) {
            return m.value_numeric;
        }
    }
    return undefined;
}

export function pickText(ms: MeasurementInput[], key: string): string | undefined {
    for (let i = ms.length - 1; i >= 0; i--) {
        const m = ms[i]!;
        if (m.metric_key === key && typeof m.value_text === 'string' && m.value_text.length > 0) {
            return m.value_text;
        }
    }
    return undefined;
}

/** Read the special subject_sex/subject_age_years measurements written by
 *  CreateSessionModal. Returns null when missing. */
export function readSubjectContext(ms: MeasurementInput[]): { sex: Sex | null; age_years: number | null } {
    const sexRaw = pickText(ms, SUBJECT_SEX_KEY);
    const ageRaw = pickNumeric(ms, SUBJECT_AGE_KEY);
    const sex: Sex | null = sexRaw === 'male' || sexRaw === 'female' ? sexRaw : null;
    const age_years = typeof ageRaw === 'number' && ageRaw > 0 ? ageRaw : null;
    return { sex, age_years };
}

/**
 * Evaluate one `computed` test against the current measurements. Returns
 * `{ value, error }` — `error` is null on success, a UI-safe string on
 * FormulaInputError. Supports 'bmi' and 'rcq'; unknown ids fall back to "—".
 */
export function evaluateComputed(
    test: Extract<AssessmentTest, { type: 'computed' }>,
    measurements: MeasurementInput[],
): { value: number | null; error: string | null } {
    const inputs = test.inputs ?? [];
    try {
        if (test.formula_id === 'bmi') {
            const w = inputs[0] ? pickNumeric(measurements, inputs[0]) : undefined;
            const h = inputs[1] ? heightMeters(measurements, inputs[1]) : undefined;
            if (w === undefined || h === undefined) return { value: null, error: null };
            return { value: bmi(w, h), error: null };
        }
        if (test.formula_id === 'rcq') {
            const wa = inputs[0] ? pickNumeric(measurements, inputs[0]) : undefined;
            const hi = inputs[1] ? pickNumeric(measurements, inputs[1]) : undefined;
            if (wa === undefined || hi === undefined) return { value: null, error: null };
            return { value: waistHipRatio(wa, hi), error: null };
        }
        return { value: null, error: null };
    } catch (err) {
        if (err instanceof FormulaInputError) {
            return { value: null, error: errorMessageForField(err.field) };
        }
        throw err;
    }
}

function errorMessageForField(field: string): string {
    switch (field) {
        case 'weight_kg': return 'Peso inválido';
        case 'height_m': return 'Estatura inválida (use metros)';
        case 'waist_cm': return 'Cintura inválida';
        case 'hip_cm': return 'Quadril inválido';
        case 'age_years': return 'Idade inválida';
        case 'density': return 'Densidade inválida';
        default: return 'Verifique os inputs';
    }
}

/** True when all `inputs` of a computed test have a numeric measurement. */
export function isComputedReady(
    test: Extract<AssessmentTest, { type: 'computed' }>,
    measurements: MeasurementInput[],
): boolean {
    for (const key of test.inputs ?? []) {
        if (pickNumeric(measurements, key) === undefined) return false;
    }
    return true;
}

/**
 * Walk the schema and produce the `computed_metrics` payload for finalize.
 * Errors silently skip that metric so the user still sees the rest.
 */
export function buildComputedMetricsFromSchema(
    schema: AssessmentTemplateSchema | null,
    measurements: MeasurementInput[],
): ComputedMetrics {
    const out: ComputedMetrics = {};
    if (!schema) return out;
    for (const sec of schema.sections ?? []) {
        for (const t of sec.tests ?? []) {
            if (t.type !== 'computed') continue;
            const r = evaluateComputed(t, measurements);
            if (r.value !== null && Number.isFinite(r.value)) {
                out[t.metric_key] = r.value;
            }
        }
    }
    return out;
}

/** Pick the subject weight in kg. Accepts `weight` and legacy `weight_kg`. */
export function pickWeightKg(ms: MeasurementInput[]): number | undefined {
    return pickNumeric(ms, 'weight') ?? pickNumeric(ms, 'weight_kg');
}

// Resolve uma medição de estatura para METROS. O builder de avaliação emite
// `height_cm` (centímetros); os templates de sistema usam `height_m` (metros).
// bmi() exige metros. Converte por chave (_cm) ou magnitude (>3 → veio em cm).
function heightMeters(ms: MeasurementInput[], key: string): number | undefined {
    const raw = pickNumeric(ms, key);
    if (raw === undefined) return undefined;
    return key.endsWith('_cm') || raw > 3 ? raw / 100 : raw;
}

/** Pick the subject stature in meters. Accepts `height`, `height_m`, `height_cm`. */
export function pickHeightM(ms: MeasurementInput[]): number | undefined {
    return heightMeters(ms, 'height') ?? heightMeters(ms, 'height_m') ?? heightMeters(ms, 'height_cm');
}

/**
 * Translate the wizard's prefixed skinfold keys (`skinfold_subscapular`, …)
 * into the engine-side {@link SkinfoldInput} shape. Skips is_selected===false
 * (multi-attempt history) and non-numeric values. Last-write-wins per site.
 */
export function extractSkinfoldsForEngine(ms: MeasurementInput[]): SkinfoldInput {
    const out: SkinfoldInput = {};
    for (const m of ms) {
        if (typeof m.value_numeric !== 'number' || !Number.isFinite(m.value_numeric)) continue;
        if (m.is_selected === false) continue;
        if (!m.metric_key.startsWith('skinfold_')) continue;
        const site = m.metric_key.slice('skinfold_'.length) as SkinfoldSite;
        out[site] = m.value_numeric;
    }
    return out;
}

/**
 * Decide which body-composition protocol to run at finalize. Preference:
 *   1. The first `protocol` test declared in the schema (explicit intent).
 *   2. Inferred from captured skinfolds: entre os protocolos cujos
 *      required_sites[sex] estão TODOS presentes, escolhe o MAIS específico
 *      (maior nº de sítios) — não o primeiro declarado. Senão um protocolo de
 *      3 dobras rodaria com 7 capturadas (fórmula menos precisa). Retorna null
 *      quando nenhum caminho resolve.
 */
export function detectProtocol(
    schema: AssessmentTemplateSchema | null,
    measurements: MeasurementInput[],
    sex: Sex,
): ProtocolId | null {
    if (schema) {
        for (const sec of schema.sections ?? []) {
            for (const t of sec.tests ?? []) {
                if (t.type === 'protocol') return t.protocol;
            }
        }
    }
    const sf = extractSkinfoldsForEngine(measurements);
    const captured = new Set(Object.keys(sf));
    if (captured.size === 0) return null;
    let best: { id: ProtocolId; n: number } | null = null;
    for (const def of Object.values(PROTOCOLS)) {
        const entry = def.required_sites.find((r) => r.sex === sex);
        if (!entry) continue;
        if (entry.sites.every((s) => captured.has(s))) {
            if (!best || entry.sites.length > best.n) {
                best = { id: def.id, n: entry.sites.length };
            }
        }
    }
    return best?.id ?? null;
}

// Re-export das classificações do motor para o result screen não puxar de M2 direto.
export { classifyBMI, classifyWaistHipRatio };
