// Shared helpers between the session screen (finalize) and the wizard
// (live-preview ComputedDisplay). Wraps the M2 engine so callers don't
// reach into the formulas package directly and surface FormulaInputError
// in a UI-friendly way.

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
} from '@kinevo/shared/lib/assessment-protocols';
import type {
    AssessmentTest,
    AssessmentTemplateSchema,
    ComputedMetrics,
    MeasurementInput,
} from '@kinevo/shared/types/assessments';

export const SUBJECT_SEX_KEY = 'subject_sex';
export const SUBJECT_AGE_KEY = 'subject_age_years';

/**
 * Last-write-wins lookup of a numeric measurement by metric_key, ignoring
 * rows with `is_selected === false` (e.g. multi-attempt history rows).
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
 *  CreateSessionModal (B4 — sex/age fix). Returns null when missing. */
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
 * FormulaInputError, and undefined when inputs aren't ready yet.
 *
 * Supports the formulas wired in M2 today: 'bmi' and 'rcq'. New formula ids
 * fall back to a "—" with no error.
 */
export function evaluateComputed(
    test: Extract<AssessmentTest, { type: 'computed' }>,
    measurements: MeasurementInput[],
): { value: number | null; error: string | null } {
    const inputs = test.inputs ?? [];
    try {
        if (test.formula_id === 'bmi') {
            const w = inputs[0] ? pickNumeric(measurements, inputs[0]) : undefined;
            const h = inputs[1] ? pickNumeric(measurements, inputs[1]) : undefined;
            if (w === undefined || h === undefined) return { value: null, error: null };
            return { value: bmi(w, h), error: null };
        }
        if (test.formula_id === 'rcq') {
            const wa = inputs[0] ? pickNumeric(measurements, inputs[0]) : undefined;
            const hi = inputs[1] ? pickNumeric(measurements, inputs[1]) : undefined;
            if (wa === undefined || hi === undefined) return { value: null, error: null };
            return { value: waistHipRatio(wa, hi), error: null };
        }
        // Unknown formula id — silently no-op.
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
 * Always includes evaluable computed tests; never throws (errors silently
 * skip the metric so the user still sees the rest of the result).
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

/**
 * Pick the subject weight in kilograms. Accepts the canonical metric_key
 * `weight` and the alternative `weight_kg` that some legacy/SQL-seeded
 * templates use. Returns undefined when neither is present.
 */
export function pickWeightKg(ms: MeasurementInput[]): number | undefined {
    return pickNumeric(ms, 'weight') ?? pickNumeric(ms, 'weight_kg');
}

/**
 * Pick the subject stature in meters. Accepts `height` and `height_m`.
 */
export function pickHeightM(ms: MeasurementInput[]): number | undefined {
    return pickNumeric(ms, 'height') ?? pickNumeric(ms, 'height_m');
}

/**
 * Translate the wizard's prefixed measurement keys (`skinfold_subscapular`,
 * `skinfold_triceps`, …) into the engine-side {@link SkinfoldInput} shape
 * (`{ subscapular: 10, triceps: 10, … }`).
 *
 * Skips rows with `is_selected === false` (multi-attempt history) and
 * non-numeric values. Last-write-wins per site.
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
 * Decide which body-composition protocol to run at finalize. Preference
 * order:
 *   1. The first `protocol` test declared in the schema (explicit author
 *      intent — e.g. seeded templates).
 *   2. Inferred from the captured skinfold sites: pick the protocol whose
 *      `required_sites[sex]` is fully covered by the skinfold measurements
 *      we have. Used when a template has `numeric_unit` skinfolds without
 *      an explicit `ProtocolTest` wrapper (legacy / SQL-seeded layout).
 *
 * Returns `null` when neither path resolves a protocol.
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
    // M8: entre os protocolos cujos required_sites[sex] estão todos presentes,
    // escolhe o MAIS específico (maior nº de sítios exigidos) — não o primeiro
    // declarado. Senão um protocolo de 3 dobras podia rodar quando o template
    // tinha 7 capturadas (fórmula menos precisa que a pretendida).
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

/**
 * Tiny re-export so callers don't pull from M2 directly when they just need
 * the BMI/WHR classification labels for the result screen.
 */
export { classifyBMI, classifyWaistHipRatio };
