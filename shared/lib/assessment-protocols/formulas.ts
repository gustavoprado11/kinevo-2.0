// ============================================================================
// Kinevo — Assessment protocols: formulas
// ============================================================================
// Pure functions only. No state, no side effects, no external deps.
// Every formula cites a primary source in JSDoc — coefficients are NEVER
// edited without an updated citation.
//
// All inputs are validated eagerly: invalid values throw FormulaInputError
// with the offending field name.
// ============================================================================

import {
    FormulaInputError,
    type Sex,
    type SkinfoldInput,
    type SkinfoldSite,
} from './types';

// ----------------------------------------------------------------------------
// Anthropometrics
// ----------------------------------------------------------------------------

/**
 * BMI (Body Mass Index) = weight / height².
 *
 * Source: Quetelet A. Sur l'homme et le développement de ses facultés (1832).
 *   Standardised by the WHO; current cut-points in WHO Technical Report
 *   Series 854 (1995) "Physical Status: The Use and Interpretation of
 *   Anthropometry".
 *
 * @param weight_kg Body mass in kilograms (>0).
 * @param height_m  Stature in METERS (>0). Guarded against accidental cm.
 * @returns BMI in kg/m².
 */
export function bmi(weight_kg: number, height_m: number): number {
    if (!Number.isFinite(weight_kg) || weight_kg <= 0) {
        throw new FormulaInputError('weight_kg must be > 0', 'weight_kg');
    }
    if (!Number.isFinite(height_m) || height_m <= 0) {
        throw new FormulaInputError('height_m must be > 0', 'height_m');
    }
    if (height_m > 3) {
        throw new FormulaInputError(
            'height_m looks like cm — use meters',
            'height_m',
        );
    }
    return weight_kg / (height_m * height_m);
}

/**
 * Waist–hip ratio (WHR).
 *
 * Source: World Health Organization. "Waist Circumference and Waist–Hip
 *   Ratio: Report of a WHO Expert Consultation". Geneva, 8–11 December 2008
 *   (published 2011). Original WHR cut-points in WHO Technical Report 894
 *   (2000).
 */
export function waistHipRatio(waist_cm: number, hip_cm: number): number {
    if (!Number.isFinite(waist_cm) || waist_cm <= 0) {
        throw new FormulaInputError('waist_cm must be > 0', 'waist_cm');
    }
    if (!Number.isFinite(hip_cm) || hip_cm <= 0) {
        throw new FormulaInputError('hip_cm must be > 0', 'hip_cm');
    }
    return waist_cm / hip_cm;
}

// ----------------------------------------------------------------------------
// Density → %BF conversion
// ----------------------------------------------------------------------------

/**
 * Siri equation: %BF = 495 / D − 450.
 *
 * Source: Siri WE. Body composition from fluid spaces and density: analysis
 *   of methods. In: Brozek J, Henschel A (eds). Techniques for Measuring
 *   Body Composition. Washington DC: National Academy of Sciences /
 *   National Research Council, 1961: 223–244. (Originally circulated as
 *   Donner Lab Report UCRL-3349, 1956.)
 *
 * @param density Body density in g/cm³ (>0). Typical adult range 1.02–1.10.
 */
export function siri(density: number): number {
    if (!Number.isFinite(density) || density <= 0) {
        throw new FormulaInputError('density must be > 0', 'density');
    }
    return 495 / density - 450;
}

/**
 * Brozek equation: %BF = (4.57 / D − 4.142) × 100.
 *
 * Source: Brozek J, Grande F, Anderson JT, Keys A. Densitometric analysis
 *   of body composition: revision of some quantitative assumptions.
 *   Annals of the New York Academy of Sciences 1963; 110:113–140.
 *
 * More conservative than Siri at extreme densities; preferred for very
 * lean or very obese subjects per Heyward & Wagner (Applied Body
 * Composition Assessment, 2nd ed., 2004).
 */
export function brozek(density: number): number {
    if (!Number.isFinite(density) || density <= 0) {
        throw new FormulaInputError('density must be > 0', 'density');
    }
    return (4.57 / density - 4.142) * 100;
}

// ----------------------------------------------------------------------------
// Skinfold → density (Jackson & Pollock family)
// ----------------------------------------------------------------------------

/**
 * Jackson & Pollock — generalised 3-site skinfold equation.
 *
 * Sources:
 *   - Men: Jackson AS, Pollock ML. Generalized equations for predicting
 *     body density of men. British Journal of Nutrition 1978; 40(3):497–504.
 *     Sites: chest, abdomen, thigh.
 *   - Women: Jackson AS, Pollock ML, Ward A. Generalized equations for
 *     predicting body density of women. Medicine and Science in Sports
 *     and Exercise 1980; 12(3):175–181.
 *     Sites: triceps, suprailiac, thigh.
 *
 * Cross-checked against ACSM's Guidelines for Exercise Testing and
 * Prescription, 10th ed. (2018), Table 4.2; and Heyward VH & Wagner DR,
 * Applied Body Composition Assessment, 2nd ed. (2004), Table 8.1.
 *
 * Returns body density (g/cm³). Convert to %BF with `siri` or `brozek`.
 */
export function jacksonPollock3(input: {
    sex: Sex;
    age_years: number;
    skinfolds_mm: SkinfoldInput;
}): number {
    const { sex, age_years, skinfolds_mm } = input;
    validateAge(age_years);

    if (sex === 'male') {
        const sites = ['chest', 'abdomen', 'thigh'] as const;
        const sum = sumSkinfolds(skinfolds_mm, sites);
        return (
            1.10938
            - 0.0008267 * sum
            + 0.0000016 * sum * sum
            - 0.0002574 * age_years
        );
    }
    const sitesF = ['triceps', 'suprailiac', 'thigh'] as const;
    const sumF = sumSkinfolds(skinfolds_mm, sitesF);
    return (
        1.0994921
        - 0.0009929 * sumF
        + 0.0000023 * sumF * sumF
        - 0.0001392 * age_years
    );
}

/**
 * Jackson & Pollock — 7-site skinfold equation.
 *
 * Sources:
 *   - Men: Jackson AS, Pollock ML. 1978 (see jacksonPollock3).
 *   - Women: Jackson AS, Pollock ML, Ward A. 1980 (see jacksonPollock3).
 *
 * Sites (both sexes): chest, abdomen, thigh, triceps, subscapular,
 *   suprailiac, midaxillary.
 *
 * Cross-checked against ACSM Guidelines 10th ed. and Heyward & Wagner
 * (2004), Table 8.1.
 *
 * Returns body density (g/cm³).
 */
export function jacksonPollock7(input: {
    sex: Sex;
    age_years: number;
    skinfolds_mm: SkinfoldInput;
}): number {
    const { sex, age_years, skinfolds_mm } = input;
    validateAge(age_years);

    const sites = [
        'chest', 'abdomen', 'thigh', 'triceps',
        'subscapular', 'suprailiac', 'midaxillary',
    ] as const;
    const sum = sumSkinfolds(skinfolds_mm, sites);

    if (sex === 'male') {
        return (
            1.112
            - 0.00043499 * sum
            + 0.00000055 * sum * sum
            - 0.00028826 * age_years
        );
    }
    return (
        1.097
        - 0.00046971 * sum
        + 0.00000056 * sum * sum
        - 0.00012828 * age_years
    );
}

/**
 * Petroski — 4-site skinfold equation for Brazilian adults.
 *
 * Sites: subscapular, triceps, suprailiac, calf.
 *
 * Primary citation: Petroski EL. Desenvolvimento e validação de equações
 *   generalizadas para a estimativa da densidade corporal em adultos.
 *   Tese (Doutorado em Educação Física), Universidade Federal de Santa
 *   Maria, 1995.
 *
 * ⚠️ Limitation: this implementation uses the *pure 4-skinfold* variant
 * (no weight or stature), which is the version most widely used in
 * Brazilian gyms and online calculators. The original 1995 thesis also
 * documents *composite* equations that include weight and stature; those
 * are NOT implemented here. See `MILESTONE-2-STATUS.md` for full notes.
 *
 * The pure 4-skinfold coefficients used here are cross-validated against
 * three independent secondary sources that agree:
 *   1. Pitanga FJG. Avaliação da Composição Corporal Humana. 4ª ed.
 *      Phorte Editora, 2008. (Brazilian textbook standard reference.)
 *   2. Calculadora online Med Sport Papers
 *      (https://medesportepapers.com.br/calculadora-de-petroski-4-dobras/).
 *   3. Calculadora online GPS Esporte
 *      (https://www.gpsesporte.com.br/calculadora-petroski-4-dobras).
 *
 * Returns body density (g/cm³).
 */
export function petroski4(input: {
    sex: Sex;
    age_years: number;
    skinfolds_mm: SkinfoldInput;
}): number {
    const { sex, age_years, skinfolds_mm } = input;
    validateAge(age_years);

    const sites = ['subscapular', 'triceps', 'suprailiac', 'calf'] as const;
    const sum = sumSkinfolds(skinfolds_mm, sites);

    if (sex === 'male') {
        return (
            1.10726863
            - 0.00081201 * sum
            + 0.00000212 * sum * sum
            - 0.00041761 * age_years
        );
    }
    // Female: log-linear form (pure 4 skinfolds, no weight/stature).
    return (
        1.1954713
        - 0.07513507 * Math.log10(sum)
        - 0.00041072 * age_years
    );
}

/**
 * Faulkner — 4-site skinfold equation, computes %BF directly (no density).
 *
 * Sites: triceps, subscapular, suprailiac, abdomen.
 *
 * Source: Faulkner JA. Physiology of swimming and diving. In: Falls H
 *   (ed). Exercise Physiology. Baltimore: Academic Press, 1968: 415–446.
 *
 * Cross-checked against Pitanga (2008), Avaliação da Composição Corporal
 * Humana, 4ª ed., and Pollock & Wilmore (1990), Exercise in Health and
 * Disease, 2nd ed.
 *
 * %BF = (Σ × 0.153) + 5.783
 *
 * Simple equation aimed at the general population; less accurate than
 * Jackson & Pollock for athletes and outliers.
 */
export function faulkner4(skinfolds_mm: SkinfoldInput): number {
    const sites = ['triceps', 'subscapular', 'suprailiac', 'abdomen'] as const;
    const sum = sumSkinfolds(skinfolds_mm, sites);
    return sum * 0.153 + 5.783;
}

// ----------------------------------------------------------------------------
// Internal helpers
// ----------------------------------------------------------------------------

function validateAge(age_years: number): void {
    if (!Number.isFinite(age_years) || age_years <= 0) {
        throw new FormulaInputError('age_years must be > 0', 'age_years');
    }
}

/**
 * Sum a required subset of skinfolds. Throws FormulaInputError if any
 * required site is missing or negative.
 */
export function sumSkinfolds(
    input: SkinfoldInput,
    required: readonly SkinfoldSite[],
): number {
    let total = 0;
    for (const site of required) {
        const value = input[site];
        if (value === undefined || value === null) {
            throw new FormulaInputError(
                `Skinfold site '${site}' is required but missing`,
                site,
            );
        }
        if (!Number.isFinite(value) || value < 0) {
            throw new FormulaInputError(
                `Skinfold site '${site}' must be a finite number >= 0`,
                site,
            );
        }
        total += value;
    }
    return total;
}
