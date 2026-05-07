// ============================================================================
// Kinevo — Assessment protocols: domain types
// ============================================================================
// Pure-TS types for the body composition engine. Mirrors the SQL/runtime
// types from M1 (`shared/types/assessments.ts`) where applicable but adds
// the inputs and intermediate values the formulas need.
// ============================================================================

import type { AssessmentProtocol } from '../../types/assessments';

// Sex is engine-only (the M1 schema doesn't carry it directly — it's read
// from the student profile at the call site).
export type Sex = 'male' | 'female';

// Re-export of the M1 protocol enum so consumers of the engine have a
// stable name. ProtocolId is the engine-side spelling; AssessmentProtocol
// remains the canonical SQL/domain spelling.
export type ProtocolId = AssessmentProtocol;

// Density → %BG conversion equation.
export type DensityEquation = 'siri' | 'brozek';

// Canonical skinfold sites (English to avoid Portuguese/English confusion
// at call sites — translation lives at the UI layer).
export type SkinfoldSite =
    | 'chest'           // peitoral
    | 'abdomen'         // abdominal
    | 'thigh'           // coxa
    | 'triceps'         // tríceps
    | 'subscapular'     // subescapular
    | 'suprailiac'      // supra-ilíaca
    | 'midaxillary'     // axilar média
    | 'biceps'          // bíceps
    | 'calf';           // panturrilha medial

// Skinfold input — partial: each protocol enforces its own required subset.
export type SkinfoldInput = Partial<Record<SkinfoldSite, number>>;

export interface AnthropometricInput {
    weight_kg: number;
    height_m: number;          // METERS (not cm) — guarded by validators
    age_years: number;
    sex: Sex;
}

export interface CircumferenceInput {
    waist_cm: number;
    hip_cm: number;
}

export interface BodyCompositionInput {
    protocol: ProtocolId;
    density_equation?: DensityEquation;  // defaults to 'siri'
    anthropometric: AnthropometricInput;
    skinfolds_mm: SkinfoldInput;
}

export interface BodyCompositionResult {
    protocol: ProtocolId;
    density_equation: DensityEquation;
    body_density: number | null;        // null for Faulkner (computes %BG directly)
    body_fat_percent: number;           // 0-100
    fat_mass_kg: number;
    lean_mass_kg: number;
    classification: BodyFatClassification;
    inputs: {
        sum_skinfolds_mm: number;
        sites_used: SkinfoldSite[];
        age_years: number;
        sex: Sex;
        weight_kg: number;
    };
}

// ============================================================================
// Classifications
// ============================================================================

export type BMICategory =
    | 'underweight'
    | 'normal'
    | 'overweight'
    | 'obese_class_1'
    | 'obese_class_2'
    | 'obese_class_3';

export type WHRRiskCategory = 'low' | 'moderate' | 'high';

export type BodyFatCategory =
    | 'essential'        // below the minimum healthy threshold
    | 'athletic'
    | 'fitness'
    | 'average'
    | 'above_average'
    | 'obese';

export interface Classification<T extends string> {
    category: T;
    label_pt: string;
    description_pt?: string;
    range: { min: number | null; max: number | null };
}

export type BMIClassification = Classification<BMICategory>;
export type WHRClassification = Classification<WHRRiskCategory>;
export type BodyFatClassification = Classification<BodyFatCategory>;

// ============================================================================
// Errors
// ============================================================================

export class FormulaInputError extends Error {
    public readonly field: string;
    constructor(message: string, field: string) {
        super(message);
        this.name = 'FormulaInputError';
        this.field = field;
    }
}
