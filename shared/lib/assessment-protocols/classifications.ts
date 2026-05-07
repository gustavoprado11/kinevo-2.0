// ============================================================================
// Kinevo — Assessment protocols: classifications
// ============================================================================
// All classification thresholds are hard-coded with their primary source
// cited. No locale lib — pt-BR labels live as plain strings.
// ============================================================================

import {
    FormulaInputError,
    type Sex,
    type BMICategory,
    type BMIClassification,
    type WHRRiskCategory,
    type WHRClassification,
    type BodyFatCategory,
    type BodyFatClassification,
} from './types';

// ----------------------------------------------------------------------------
// BMI classification
// ----------------------------------------------------------------------------

/**
 * Classify BMI per WHO Technical Report Series 854 (1995) /
 * 894 (2000) — adult cut-points, sex-independent.
 *
 *   < 18.5  underweight
 *   18.5–24.9  normal
 *   25.0–29.9  overweight
 *   30.0–34.9  obese class I
 *   35.0–39.9  obese class II
 *   ≥ 40       obese class III
 */
export function classifyBMI(value: number): BMIClassification {
    if (!Number.isFinite(value) || value <= 0) {
        throw new FormulaInputError('bmi value must be > 0', 'value');
    }
    if (value < 18.5) {
        return {
            category: 'underweight',
            label_pt: 'Baixo peso',
            range: { min: null, max: 18.5 },
        };
    }
    if (value < 25) {
        return {
            category: 'normal',
            label_pt: 'Peso normal',
            range: { min: 18.5, max: 25 },
        };
    }
    if (value < 30) {
        return {
            category: 'overweight',
            label_pt: 'Sobrepeso',
            range: { min: 25, max: 30 },
        };
    }
    if (value < 35) {
        return {
            category: 'obese_class_1',
            label_pt: 'Obesidade grau I',
            range: { min: 30, max: 35 },
        };
    }
    if (value < 40) {
        return {
            category: 'obese_class_2',
            label_pt: 'Obesidade grau II',
            range: { min: 35, max: 40 },
        };
    }
    return {
        category: 'obese_class_3',
        label_pt: 'Obesidade grau III',
        range: { min: 40, max: null },
    };
}

// ----------------------------------------------------------------------------
// Waist–hip ratio (WHR) cardiovascular risk classification
// ----------------------------------------------------------------------------

/**
 * Classify WHR per WHO Expert Consultation (Geneva, 2008; published 2011)
 * "Waist Circumference and Waist–Hip Ratio".
 *
 *   Men:    low <0.95  | moderate 0.95–1.0 | high >1.0
 *   Women:  low <0.80  | moderate 0.80–0.85 | high >0.85
 */
export function classifyWaistHipRatio(
    value: number,
    sex: Sex,
): WHRClassification {
    if (!Number.isFinite(value) || value <= 0) {
        throw new FormulaInputError('whr value must be > 0', 'value');
    }
    if (sex === 'male') {
        if (value < 0.95) {
            return whrCat('low', 'Risco baixo', { min: null, max: 0.95 });
        }
        if (value <= 1.0) {
            return whrCat('moderate', 'Risco moderado', { min: 0.95, max: 1.0 });
        }
        return whrCat('high', 'Risco alto', { min: 1.0, max: null });
    }
    // female
    if (value < 0.80) {
        return whrCat('low', 'Risco baixo', { min: null, max: 0.80 });
    }
    if (value <= 0.85) {
        return whrCat('moderate', 'Risco moderado', { min: 0.80, max: 0.85 });
    }
    return whrCat('high', 'Risco alto', { min: 0.85, max: null });
}

function whrCat(
    category: WHRRiskCategory,
    label_pt: string,
    range: { min: number | null; max: number | null },
): WHRClassification {
    return { category, label_pt, range };
}

// ----------------------------------------------------------------------------
// Body fat classification (Pollock & Wilmore, 1990)
// ----------------------------------------------------------------------------
//
// Source: Pollock ML, Wilmore JH. Exercise in Health and Disease:
//   Evaluation and Prescription for Prevention and Rehabilitation. 2nd ed.
//   Philadelphia: WB Saunders, 1990. Tables 11.4 and 11.5.
//
// Cross-checked against ACSM's Guidelines for Exercise Testing and
// Prescription, 10th ed. (2018), Table 4.4. P&W 1990 prevails on any
// disagreement (per spec — see MILESTONE-2-STATUS.md).
//
// The original P&W table has six bands per age × sex cell:
//   Excellent / Good / Above Average / Average / Below Average / Poor
//
// Note on the P&W band names: "Above Average" describes a body fat % that
// is HIGHER than the average — i.e. WORSE than typical, not better. To
// keep the engine's enum semantically clean (atlético is best, obese is
// worst), this engine maps the bands as follows:
//
//   essential       (sex-fixed below) — clinically dangerous low %BF
//   athletic        ← P&W Excellent
//   fitness         ← P&W Good   (also absorbs P&W Below Average — both
//                    represent leaner-than-typical without crossing into
//                    athletic territory; this consolidation is a Kinevo
//                    decision documented in MILESTONE-2-STATUS.md.)
//   average         ← P&W Average
//   above_average   ← P&W Above Average  (more fat than typical)
//   obese           ← P&W Poor
//
// The "essential" floor follows ACSM Guidelines (10th ed., Table 4.5):
//   - Men:   minimum healthy body fat ≈ 5%
//   - Women: minimum healthy body fat ≈ 12%
// Below those thresholds the value is classified as `essential` regardless
// of age band.
//
// Each row holds the upper bounds (exclusive) of the bands ordered from
// best to worst. The last band (`obese`) has no upper bound.

interface AgeBand {
    min_age: number;       // inclusive
    max_age: number;       // inclusive
    // Upper bounds (exclusive) for each category transition. The categories
    // are evaluated in order: athletic → fitness → average → above_average → obese.
    athletic_max: number;     // % at which we leave 'athletic' and enter 'fitness'
    fitness_max: number;
    average_max: number;
    above_average_max: number;
    // Anything ≥ above_average_max is `obese`.
}

const ESSENTIAL_FLOOR: Record<Sex, number> = {
    male: 5,
    female: 12,
};

// Pollock & Wilmore 1990, men.
const PW_MEN: AgeBand[] = [
    { min_age: 18, max_age: 29, athletic_max: 11, fitness_max: 14, average_max: 17, above_average_max: 20 },
    { min_age: 30, max_age: 39, athletic_max: 12, fitness_max: 15, average_max: 18, above_average_max: 22 },
    { min_age: 40, max_age: 49, athletic_max: 14, fitness_max: 17, average_max: 21, above_average_max: 24 },
    { min_age: 50, max_age: 59, athletic_max: 15, fitness_max: 18, average_max: 23, above_average_max: 26 },
    { min_age: 60, max_age: 200, athletic_max: 16, fitness_max: 19, average_max: 24, above_average_max: 27 },
];

// Pollock & Wilmore 1990, women.
const PW_WOMEN: AgeBand[] = [
    { min_age: 18, max_age: 29, athletic_max: 16, fitness_max: 20, average_max: 23, above_average_max: 26 },
    { min_age: 30, max_age: 39, athletic_max: 17, fitness_max: 21, average_max: 24, above_average_max: 27 },
    { min_age: 40, max_age: 49, athletic_max: 18, fitness_max: 22, average_max: 25, above_average_max: 29 },
    { min_age: 50, max_age: 59, athletic_max: 19, fitness_max: 23, average_max: 27, above_average_max: 31 },
    { min_age: 60, max_age: 200, athletic_max: 20, fitness_max: 24, average_max: 28, above_average_max: 32 },
];

/**
 * Classify body fat percent per Pollock & Wilmore (1990).
 *
 * `essential` is returned when the value is below the sex-specific minimum
 * healthy threshold (men: 5%, women: 12% — ACSM 10th ed., Table 4.5).
 *
 * @param value     Body fat percentage in 0..100.
 * @param age_years Age in years; clamped to the lowest band for ages <18
 *                  and to the highest band for ages > 60.
 * @param sex       Biological sex used to look up the table.
 */
export function classifyBodyFat(
    value: number,
    age_years: number,
    sex: Sex,
): BodyFatClassification {
    if (!Number.isFinite(value) || value < 0 || value > 100) {
        throw new FormulaInputError(
            'body_fat_percent must be between 0 and 100',
            'value',
        );
    }
    if (!Number.isFinite(age_years) || age_years <= 0) {
        throw new FormulaInputError('age_years must be > 0', 'age_years');
    }

    const floor = ESSENTIAL_FLOOR[sex];
    if (value < floor) {
        return bfCat('essential', 'Gordura essencial', {
            min: null,
            max: floor,
        });
    }

    const table = sex === 'male' ? PW_MEN : PW_WOMEN;
    const band = pickBand(table, age_years);

    if (value < band.athletic_max) {
        return bfCat('athletic', 'Atlético', {
            min: floor,
            max: band.athletic_max,
        });
    }
    if (value < band.fitness_max) {
        return bfCat('fitness', 'Bom', {
            min: band.athletic_max,
            max: band.fitness_max,
        });
    }
    if (value < band.average_max) {
        return bfCat('average', 'Média', {
            min: band.fitness_max,
            max: band.average_max,
        });
    }
    if (value < band.above_average_max) {
        return bfCat('above_average', 'Acima da média', {
            min: band.average_max,
            max: band.above_average_max,
        });
    }
    return bfCat('obese', 'Obesidade', {
        min: band.above_average_max,
        max: null,
    });
}

function bfCat(
    category: BodyFatCategory,
    label_pt: string,
    range: { min: number | null; max: number | null },
): BodyFatClassification {
    return { category, label_pt, range };
}

function pickBand(table: AgeBand[], age_years: number): AgeBand {
    // Below the youngest band → use the youngest band.
    if (age_years < table[0]!.min_age) return table[0]!;
    for (const band of table) {
        if (age_years >= band.min_age && age_years <= band.max_age) {
            return band;
        }
    }
    // Above the oldest band shouldn't happen because max_age=200, but be
    // defensive.
    return table[table.length - 1]!;
}
