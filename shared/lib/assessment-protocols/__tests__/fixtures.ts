// ============================================================================
// Cross-validated fixtures for the body composition engine.
// ============================================================================
// Each fixture cites a source for the expected output. Fixtures are
// computed by hand using the original published coefficients (see citations
// in `formulas.ts`) and rounded to the documented tolerance (±0.0001 for
// density; ±0.1 percentage points for body fat).
//
// All fixtures are run by `formulas.test.ts` and `protocols.test.ts`.
// ============================================================================

import type {
    BodyCompositionInput,
    ProtocolId,
    Sex,
    SkinfoldInput,
} from '../types';

export interface FormulaFixture {
    description: string;
    input: BodyCompositionInput;
    expected: {
        density?: number;
        body_fat_percent: number;
        classification_category:
            | 'essential'
            | 'athletic'
            | 'fitness'
            | 'average'
            | 'above_average'
            | 'obese';
    };
    source_citation: string;
    tolerance?: { density?: number; body_fat?: number };
}

// Default tolerances per the spec.
export const DEFAULT_TOL = { density: 0.0001, body_fat: 0.1 };

// ----------------------------------------------------------------------------
// Common anthropometric stubs
// ----------------------------------------------------------------------------

const anthroM30 = { weight_kg: 80, height_m: 1.78, age_years: 30, sex: 'male' as Sex };
const anthroM25 = { weight_kg: 75, height_m: 1.80, age_years: 25, sex: 'male' as Sex };
const anthroM60 = { weight_kg: 82, height_m: 1.74, age_years: 60, sex: 'male' as Sex };
const anthroM45 = { weight_kg: 95, height_m: 1.72, age_years: 45, sex: 'male' as Sex };
const anthroM65 = { weight_kg: 78, height_m: 1.70, age_years: 65, sex: 'male' as Sex };

const anthroF30 = { weight_kg: 65, height_m: 1.65, age_years: 30, sex: 'female' as Sex };
const anthroF25 = { weight_kg: 58, height_m: 1.68, age_years: 25, sex: 'female' as Sex };
const anthroF60 = { weight_kg: 68, height_m: 1.62, age_years: 60, sex: 'female' as Sex };
const anthroF65 = { weight_kg: 70, height_m: 1.60, age_years: 65, sex: 'female' as Sex };
const anthroF40 = { weight_kg: 78, height_m: 1.62, age_years: 40, sex: 'female' as Sex };

// ----------------------------------------------------------------------------
// Jackson & Pollock — 3 skinfolds
// ----------------------------------------------------------------------------

export const FIXTURES_JP3: FormulaFixture[] = [
    {
        description: 'M, 30y, mid-fitness — 3SF chest/abd/thigh = 53 mm',
        input: {
            protocol: 'jackson_pollock_3',
            anthropometric: anthroM30,
            skinfolds_mm: { chest: 15, abdomen: 20, thigh: 18 },
        },
        expected: {
            density: 1.0623,
            body_fat_percent: 16.0,
            classification_category: 'average',
        },
        source_citation:
            'Hand-computed from Jackson & Pollock 1978, Br J Nutr 40(3):497-504. '
            + 'Cross-checked against ACSM Guidelines 10th ed., Table 4.2 worked example.',
    },
    {
        description: 'M, 25y, athletic — 3SF = 20 mm',
        input: {
            protocol: 'jackson_pollock_3',
            anthropometric: anthroM25,
            skinfolds_mm: { chest: 5, abdomen: 8, thigh: 7 },
        },
        expected: {
            density: 1.0871,
            body_fat_percent: 5.4,
            classification_category: 'athletic',
        },
        source_citation: 'Hand-computed from Jackson & Pollock 1978 coefficients.',
    },
    {
        description: 'M, 60y, elderly — 3SF = 65 mm',
        input: {
            protocol: 'jackson_pollock_3',
            anthropometric: anthroM60,
            skinfolds_mm: { chest: 18, abdomen: 25, thigh: 22 },
        },
        expected: {
            density: 1.0470,
            body_fat_percent: 22.8,
            classification_category: 'average',
        },
        source_citation: 'Hand-computed from Jackson & Pollock 1978 coefficients.',
    },
    {
        description: 'M, 45y, borderline obese — 3SF = 110 mm',
        input: {
            protocol: 'jackson_pollock_3',
            anthropometric: anthroM45,
            skinfolds_mm: { chest: 30, abdomen: 45, thigh: 35 },
        },
        expected: {
            density: 1.0262,
            body_fat_percent: 32.4,
            classification_category: 'obese',
        },
        source_citation: 'Hand-computed from Jackson & Pollock 1978 coefficients.',
    },
    {
        description: 'F, 30y, standard — 3SF tri/supra/thigh = 62 mm',
        input: {
            protocol: 'jackson_pollock_3',
            anthropometric: anthroF30,
            skinfolds_mm: { triceps: 20, suprailiac: 20, thigh: 22 },
        },
        expected: {
            density: 1.0426,
            body_fat_percent: 24.8,
            classification_category: 'above_average',
        },
        source_citation:
            'Hand-computed from Jackson, Pollock & Ward 1980, '
            + 'Med Sci Sports Exerc 12(3):175-181.',
    },
    {
        description: 'F, 25y, athletic — 3SF = 24 mm',
        input: {
            protocol: 'jackson_pollock_3',
            anthropometric: anthroF25,
            skinfolds_mm: { triceps: 7, suprailiac: 8, thigh: 9 },
        },
        expected: {
            density: 1.0735,
            body_fat_percent: 11.1,
            classification_category: 'essential',
        },
        source_citation: 'Hand-computed from J&P&W 1980 coefficients.',
    },
    {
        description: 'F, 65y, elderly — 3SF = 75 mm',
        input: {
            protocol: 'jackson_pollock_3',
            anthropometric: anthroF65,
            skinfolds_mm: { triceps: 22, suprailiac: 25, thigh: 28 },
        },
        expected: {
            density: 1.0289,
            body_fat_percent: 31.1,
            classification_category: 'above_average',
        },
        source_citation: 'Hand-computed from J&P&W 1980 coefficients.',
    },
    {
        description: 'F, 40y, borderline obese — 3SF = 113 mm',
        input: {
            protocol: 'jackson_pollock_3',
            anthropometric: anthroF40,
            skinfolds_mm: { triceps: 35, suprailiac: 40, thigh: 38 },
        },
        expected: {
            density: 1.0111,
            body_fat_percent: 39.6,
            classification_category: 'obese',
        },
        source_citation: 'Hand-computed from J&P&W 1980 coefficients.',
    },
];

// ----------------------------------------------------------------------------
// Jackson & Pollock — 7 skinfolds
// ----------------------------------------------------------------------------

const SF7_M_MID: SkinfoldInput = {
    chest: 15, abdomen: 20, thigh: 18,
    triceps: 12, subscapular: 15, suprailiac: 15, midaxillary: 15,
}; // sum = 110

const SF7_M_ATH: SkinfoldInput = {
    chest: 6, abdomen: 8, thigh: 7,
    triceps: 5, subscapular: 6, suprailiac: 5, midaxillary: 5,
}; // sum = 42

const SF7_M_OLD: SkinfoldInput = {
    chest: 18, abdomen: 25, thigh: 22,
    triceps: 15, subscapular: 20, suprailiac: 20, midaxillary: 20,
}; // sum = 140

const SF7_M_OBESE: SkinfoldInput = {
    chest: 30, abdomen: 45, thigh: 35,
    triceps: 22, subscapular: 25, suprailiac: 28, midaxillary: 25,
}; // sum = 210

const SF7_F_MID: SkinfoldInput = {
    chest: 15, abdomen: 22, thigh: 22,
    triceps: 18, subscapular: 18, suprailiac: 22, midaxillary: 23,
}; // sum = 140

const SF7_F_OLD: SkinfoldInput = {
    chest: 20, abdomen: 30, thigh: 30,
    triceps: 22, subscapular: 22, suprailiac: 28, midaxillary: 28,
}; // sum = 180

export const FIXTURES_JP7: FormulaFixture[] = [
    {
        description: 'M, 30y, mid-fitness — 7SF = 110 mm',
        input: {
            protocol: 'jackson_pollock_7',
            anthropometric: anthroM30,
            skinfolds_mm: SF7_M_MID,
        },
        expected: { density: 1.0622, body_fat_percent: 16.0, classification_category: 'average' },
        source_citation: 'Hand-computed from Jackson & Pollock 1978 coefficients (7-site).',
    },
    {
        description: 'M, 25y, athletic — 7SF = 42 mm',
        input: {
            protocol: 'jackson_pollock_7',
            anthropometric: anthroM25,
            skinfolds_mm: SF7_M_ATH,
        },
        expected: { density: 1.0875, body_fat_percent: 5.2, classification_category: 'athletic' },
        source_citation: 'Hand-computed from Jackson & Pollock 1978 coefficients (7-site).',
    },
    {
        description: 'M, 60y, elderly — 7SF = 140 mm',
        input: {
            protocol: 'jackson_pollock_7',
            anthropometric: anthroM60,
            skinfolds_mm: SF7_M_OLD,
        },
        expected: { density: 1.0446, body_fat_percent: 23.9, classification_category: 'average' },
        source_citation: 'Hand-computed from Jackson & Pollock 1978 coefficients (7-site).',
    },
    {
        description: 'M, 45y, borderline obese — 7SF = 210 mm',
        input: {
            protocol: 'jackson_pollock_7',
            anthropometric: anthroM45,
            skinfolds_mm: SF7_M_OBESE,
        },
        expected: { density: 1.0319, body_fat_percent: 29.7, classification_category: 'obese' },
        source_citation: 'Hand-computed from Jackson & Pollock 1978 coefficients (7-site).',
    },
    {
        description: 'F, 30y, standard — 7SF = 140 mm',
        input: {
            protocol: 'jackson_pollock_7',
            anthropometric: anthroF30,
            skinfolds_mm: SF7_F_MID,
        },
        expected: { density: 1.0384, body_fat_percent: 26.7, classification_category: 'above_average' },
        source_citation:
            'Hand-computed from Jackson, Pollock & Ward 1980 coefficients (7-site).',
    },
    {
        description: 'F, 60y, elderly — 7SF = 180 mm',
        input: {
            protocol: 'jackson_pollock_7',
            anthropometric: anthroF60,
            skinfolds_mm: SF7_F_OLD,
        },
        expected: { density: 1.0229, body_fat_percent: 33.9, classification_category: 'obese' },
        source_citation: 'Hand-computed from J&P&W 1980 coefficients (7-site).',
    },
];

// ----------------------------------------------------------------------------
// Petroski — 4 skinfolds
// ----------------------------------------------------------------------------

const SF4P_M_MID = { subscapular: 12, triceps: 10, suprailiac: 15, calf: 12 }; // 49
const SF4P_M_ATH = { subscapular: 5, triceps: 5, suprailiac: 7, calf: 5 };     // 22
const SF4P_M_OLD = { subscapular: 18, triceps: 15, suprailiac: 15, calf: 12 }; // 60
const SF4P_M_OBESE = { subscapular: 28, triceps: 25, suprailiac: 30, calf: 27 }; // 110

const SF4P_F_MID = { subscapular: 18, triceps: 18, suprailiac: 20, calf: 16 }; // 72
const SF4P_F_ATH = { subscapular: 7, triceps: 7, suprailiac: 8, calf: 6 };     // 28
const SF4P_F_OLD = { subscapular: 22, triceps: 25, suprailiac: 25, calf: 23 }; // 95
const SF4P_F_OBESE = { subscapular: 32, triceps: 30, suprailiac: 35, calf: 33 }; // 130

export const FIXTURES_PETROSKI: FormulaFixture[] = [
    {
        description: 'M, 30y, standard — Petroski 4SF = 49 mm',
        input: {
            protocol: 'petroski_4',
            anthropometric: anthroM30,
            skinfolds_mm: SF4P_M_MID,
        },
        expected: { density: 1.0600, body_fat_percent: 17.0, classification_category: 'average' },
        source_citation:
            'Hand-computed from Petroski 1995 (4SF pure variant). '
            + 'Cross-checked against Med Sport Papers calculator '
            + '(https://medesportepapers.com.br/) and GPS Esporte calculator '
            + '(https://www.gpsesporte.com.br/).',
    },
    {
        description: 'M, 25y, athletic — Petroski 4SF = 22 mm',
        input: {
            protocol: 'petroski_4',
            anthropometric: anthroM25,
            skinfolds_mm: SF4P_M_ATH,
        },
        expected: { density: 1.0800, body_fat_percent: 8.3, classification_category: 'athletic' },
        source_citation:
            'Hand-computed from Petroski 1995. Cross-checked against Med Sport Papers '
            + 'and GPS Esporte calculators.',
    },
    {
        description: 'M, 65y, elderly — Petroski 4SF = 60 mm',
        input: {
            protocol: 'petroski_4',
            anthropometric: anthroM65,
            skinfolds_mm: SF4P_M_OLD,
        },
        expected: { density: 1.0390, body_fat_percent: 26.4, classification_category: 'above_average' },
        source_citation: 'Hand-computed from Petroski 1995.',
    },
    {
        description: 'M, 45y, borderline obese — Petroski 4SF = 110 mm',
        input: {
            protocol: 'petroski_4',
            anthropometric: anthroM45,
            skinfolds_mm: SF4P_M_OBESE,
        },
        expected: { density: 1.0248, body_fat_percent: 33.0, classification_category: 'obese' },
        source_citation: 'Hand-computed from Petroski 1995.',
    },
    {
        description: 'F, 30y, standard — Petroski 4SF = 72 mm',
        input: {
            protocol: 'petroski_4',
            anthropometric: anthroF30,
            skinfolds_mm: SF4P_F_MID,
        },
        expected: { density: 1.0436, body_fat_percent: 24.3, classification_category: 'above_average' },
        source_citation:
            'Hand-computed from Petroski 1995 female log-linear variant. '
            + 'Cross-checked against Med Sport Papers and GPS Esporte calculators.',
    },
    {
        description: 'F, 25y, athletic — Petroski 4SF = 28 mm',
        input: {
            protocol: 'petroski_4',
            anthropometric: anthroF25,
            skinfolds_mm: SF4P_F_ATH,
        },
        expected: { density: 1.0765, body_fat_percent: 9.8, classification_category: 'essential' },
        source_citation: 'Hand-computed from Petroski 1995 female log-linear variant.',
    },
    {
        description: 'F, 65y, elderly — Petroski 4SF = 95 mm',
        input: {
            protocol: 'petroski_4',
            anthropometric: anthroF65,
            skinfolds_mm: SF4P_F_OLD,
        },
        expected: { density: 1.0202, body_fat_percent: 35.2, classification_category: 'obese' },
        source_citation: 'Hand-computed from Petroski 1995 female log-linear variant.',
    },
];

// ----------------------------------------------------------------------------
// Faulkner — direct %BF
// ----------------------------------------------------------------------------

export const FIXTURES_FAULKNER: FormulaFixture[] = [
    {
        description: 'M, 30y, standard — Faulkner 4SF = 62 mm',
        input: {
            protocol: 'faulkner_4',
            anthropometric: anthroM30,
            skinfolds_mm: { triceps: 12, subscapular: 15, suprailiac: 15, abdomen: 20 },
        },
        expected: { body_fat_percent: 15.3, classification_category: 'average' },
        source_citation: 'Faulkner 1968 — %BF = sum × 0.153 + 5.783, hand-computed.',
    },
    {
        description: 'M, 25y, athletic — Faulkner 4SF = 24 mm',
        input: {
            protocol: 'faulkner_4',
            anthropometric: anthroM25,
            skinfolds_mm: { triceps: 5, subscapular: 6, suprailiac: 5, abdomen: 8 },
        },
        expected: { body_fat_percent: 9.5, classification_category: 'athletic' },
        source_citation: 'Faulkner 1968 — hand-computed.',
    },
    {
        description: 'F, 30y, standard — Faulkner 4SF = 85 mm',
        input: {
            protocol: 'faulkner_4',
            anthropometric: anthroF30,
            skinfolds_mm: { triceps: 18, subscapular: 20, suprailiac: 22, abdomen: 25 },
        },
        expected: { body_fat_percent: 18.8, classification_category: 'fitness' },
        source_citation: 'Faulkner 1968 — hand-computed.',
    },
    {
        description: 'F, 60y, elderly — Faulkner 4SF = 97 mm',
        input: {
            protocol: 'faulkner_4',
            anthropometric: anthroF60,
            skinfolds_mm: { triceps: 20, subscapular: 22, suprailiac: 25, abdomen: 30 },
        },
        expected: { body_fat_percent: 20.6, classification_category: 'fitness' },
        source_citation: 'Faulkner 1968 — hand-computed.',
    },
    {
        description: 'F, 40y, borderline obese — Faulkner 4SF = 128 mm',
        input: {
            protocol: 'faulkner_4',
            anthropometric: anthroF40,
            skinfolds_mm: { triceps: 25, subscapular: 28, suprailiac: 30, abdomen: 45 },
        },
        expected: { body_fat_percent: 25.4, classification_category: 'above_average' },
        source_citation: 'Faulkner 1968 — hand-computed.',
    },
];

export const ALL_FIXTURES: Record<ProtocolId, FormulaFixture[]> = {
    jackson_pollock_3: FIXTURES_JP3,
    jackson_pollock_7: FIXTURES_JP7,
    petroski_4: FIXTURES_PETROSKI,
    faulkner_4: FIXTURES_FAULKNER,
};
