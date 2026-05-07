import { describe, it, expect } from 'vitest';
import {
    bmi,
    waistHipRatio,
    siri,
    brozek,
    jacksonPollock3,
    jacksonPollock7,
    petroski4,
    faulkner4,
    sumSkinfolds,
} from '@kinevo/shared/lib/assessment-protocols/formulas';
import { FormulaInputError } from '@kinevo/shared/lib/assessment-protocols/types';
import {
    FIXTURES_JP3,
    FIXTURES_JP7,
    FIXTURES_PETROSKI,
    FIXTURES_FAULKNER,
    DEFAULT_TOL,
    type FormulaFixture,
} from './fixtures';

// ----------------------------------------------------------------------------
// BMI
// ----------------------------------------------------------------------------

describe('bmi', () => {
    it('computes the canonical Quetelet ratio', () => {
        expect(bmi(80, 1.78)).toBeCloseTo(25.25, 2);
        expect(bmi(60, 1.70)).toBeCloseTo(20.76, 2);
    });

    it('throws on non-positive weight', () => {
        expect(() => bmi(0, 1.7)).toThrow(FormulaInputError);
        expect(() => bmi(-5, 1.7)).toThrow(FormulaInputError);
        try { bmi(0, 1.7); } catch (e) {
            expect((e as FormulaInputError).field).toBe('weight_kg');
        }
    });

    it('throws on non-positive height', () => {
        expect(() => bmi(70, 0)).toThrow(FormulaInputError);
        expect(() => bmi(70, -1.7)).toThrow(FormulaInputError);
    });

    it('rejects height that looks like cm', () => {
        expect(() => bmi(70, 175)).toThrow(/cm/);
    });

    it('rejects NaN/Infinity', () => {
        expect(() => bmi(NaN, 1.7)).toThrow(FormulaInputError);
        expect(() => bmi(70, Infinity)).toThrow(FormulaInputError);
    });
});

// ----------------------------------------------------------------------------
// Waist–hip ratio
// ----------------------------------------------------------------------------

describe('waistHipRatio', () => {
    it('returns waist / hip', () => {
        expect(waistHipRatio(85, 100)).toBeCloseTo(0.85, 4);
        expect(waistHipRatio(95, 100)).toBeCloseTo(0.95, 4);
    });

    it('throws on invalid inputs', () => {
        expect(() => waistHipRatio(0, 100)).toThrow(FormulaInputError);
        expect(() => waistHipRatio(85, 0)).toThrow(FormulaInputError);
        expect(() => waistHipRatio(-1, 100)).toThrow(FormulaInputError);
        expect(() => waistHipRatio(NaN, 100)).toThrow(FormulaInputError);
    });
});

// ----------------------------------------------------------------------------
// Siri / Brozek
// ----------------------------------------------------------------------------

describe('siri', () => {
    it('matches published worked examples', () => {
        // ACSM Guidelines 10th ed., Table 4.2: D=1.06 → ~17%
        expect(siri(1.06)).toBeCloseTo(17.0, 1);
        // D=1.07 → ~12.6%
        expect(siri(1.07)).toBeCloseTo(12.6, 1);
        // D=1.05 → ~21.4%
        expect(siri(1.05)).toBeCloseTo(21.4, 1);
    });

    it('throws on non-positive density', () => {
        expect(() => siri(0)).toThrow(FormulaInputError);
        expect(() => siri(-1)).toThrow(FormulaInputError);
        expect(() => siri(NaN)).toThrow(FormulaInputError);
    });
});

describe('brozek', () => {
    it('matches hand-computed values for typical adult densities', () => {
        // D=1.06 → 4.57/1.06 − 4.142 = 0.16930 → 16.93%
        expect(brozek(1.06)).toBeCloseTo(16.93, 1);
        // D=1.07 → 4.57/1.07 − 4.142 = 0.12911 → 12.91%
        expect(brozek(1.07)).toBeCloseTo(12.91, 1);
        // D=1.05 → 4.57/1.05 − 4.142 = 0.21038 → 21.04%
        expect(brozek(1.05)).toBeCloseTo(21.04, 1);
    });

    it('diverges from Siri at extreme densities (Brozek > Siri at low %BF)', () => {
        // Per Heyward & Wagner (2004), Brozek and Siri diverge at extremes.
        // For very low body fat (D=1.09), Brozek returns a higher %BF than Siri.
        expect(brozek(1.09)).toBeGreaterThan(siri(1.09));
    });

    it('throws on non-positive density', () => {
        expect(() => brozek(0)).toThrow(FormulaInputError);
        expect(() => brozek(-2)).toThrow(FormulaInputError);
        expect(() => brozek(Infinity)).toThrow(FormulaInputError);
    });
});

// ----------------------------------------------------------------------------
// sumSkinfolds helper
// ----------------------------------------------------------------------------

describe('sumSkinfolds', () => {
    it('sums the requested sites', () => {
        expect(sumSkinfolds({ chest: 10, abdomen: 20, thigh: 15 }, ['chest', 'abdomen', 'thigh']))
            .toBe(45);
    });

    it('throws when a required site is missing', () => {
        expect(() => sumSkinfolds({ chest: 10 }, ['chest', 'abdomen']))
            .toThrow(FormulaInputError);
        try {
            sumSkinfolds({ chest: 10 }, ['chest', 'abdomen']);
        } catch (e) {
            expect((e as FormulaInputError).field).toBe('abdomen');
        }
    });

    it('throws when a value is negative or non-finite', () => {
        expect(() => sumSkinfolds({ chest: -1, abdomen: 5 }, ['chest', 'abdomen']))
            .toThrow(FormulaInputError);
        expect(() => sumSkinfolds({ chest: NaN, abdomen: 5 }, ['chest', 'abdomen']))
            .toThrow(FormulaInputError);
    });

    it('treats explicit null the same as missing', () => {
        expect(() => sumSkinfolds(
            { chest: 10, abdomen: null as unknown as number, thigh: 5 },
            ['chest', 'abdomen', 'thigh'],
        )).toThrow(FormulaInputError);
    });
});

// ----------------------------------------------------------------------------
// Jackson & Pollock 3 — fixtures
// ----------------------------------------------------------------------------

describe('jacksonPollock3 — cross-validated fixtures', () => {
    for (const fx of FIXTURES_JP3) {
        it(fx.description, () => assertFixtureDensity(fx, jacksonPollock3));
    }

    it('throws when age is invalid', () => {
        expect(() => jacksonPollock3({
            sex: 'male',
            age_years: 0,
            skinfolds_mm: { chest: 10, abdomen: 15, thigh: 12 },
        })).toThrow(FormulaInputError);
        expect(() => jacksonPollock3({
            sex: 'male',
            age_years: -1,
            skinfolds_mm: { chest: 10, abdomen: 15, thigh: 12 },
        })).toThrow(FormulaInputError);
        expect(() => jacksonPollock3({
            sex: 'male',
            age_years: NaN,
            skinfolds_mm: { chest: 10, abdomen: 15, thigh: 12 },
        })).toThrow(FormulaInputError);
    });

    it('throws when a required site is missing for the sex', () => {
        // Male requires chest/abdomen/thigh; supplying triceps doesn't help.
        expect(() => jacksonPollock3({
            sex: 'male',
            age_years: 30,
            skinfolds_mm: { triceps: 12 },
        })).toThrow(FormulaInputError);
        // Female requires triceps/suprailiac/thigh.
        expect(() => jacksonPollock3({
            sex: 'female',
            age_years: 30,
            skinfolds_mm: { chest: 12, abdomen: 18, thigh: 20 },
        })).toThrow(FormulaInputError);
    });

    it('male and female outputs differ when inputs are otherwise equal', () => {
        // Both formulas accept the female site set; supplying both site sets
        // lets us swap sex without changing the input mapping at the call site.
        const skinfolds_mm = {
            chest: 15, abdomen: 20, thigh: 22,
            triceps: 18, suprailiac: 18,
        };
        const dM = jacksonPollock3({ sex: 'male', age_years: 30, skinfolds_mm });
        const dF = jacksonPollock3({ sex: 'female', age_years: 30, skinfolds_mm });
        expect(dM).not.toBeCloseTo(dF, 3);
    });
});

// ----------------------------------------------------------------------------
// Jackson & Pollock 7 — fixtures
// ----------------------------------------------------------------------------

describe('jacksonPollock7 — cross-validated fixtures', () => {
    for (const fx of FIXTURES_JP7) {
        it(fx.description, () => assertFixtureDensity(fx, jacksonPollock7));
    }

    it('throws when any of the 7 sites is missing', () => {
        expect(() => jacksonPollock7({
            sex: 'male',
            age_years: 30,
            skinfolds_mm: {
                chest: 15, abdomen: 20, thigh: 18,
                triceps: 12, subscapular: 15, suprailiac: 15,
                // missing midaxillary
            },
        })).toThrow(FormulaInputError);
    });

    it('throws on invalid age', () => {
        expect(() => jacksonPollock7({
            sex: 'female',
            age_years: -5,
            skinfolds_mm: {
                chest: 15, abdomen: 20, thigh: 18,
                triceps: 12, subscapular: 15, suprailiac: 15, midaxillary: 14,
            },
        })).toThrow(FormulaInputError);
    });
});

// ----------------------------------------------------------------------------
// Petroski 4 — fixtures
// ----------------------------------------------------------------------------

describe('petroski4 — cross-validated fixtures', () => {
    for (const fx of FIXTURES_PETROSKI) {
        it(fx.description, () => assertFixtureDensity(fx, petroski4));
    }

    it('throws when a required site is missing', () => {
        expect(() => petroski4({
            sex: 'male',
            age_years: 30,
            skinfolds_mm: { subscapular: 12, triceps: 10, suprailiac: 15 /* no calf */ },
        })).toThrow(FormulaInputError);
    });

    it('throws on invalid age', () => {
        expect(() => petroski4({
            sex: 'female',
            age_years: 0,
            skinfolds_mm: { subscapular: 18, triceps: 18, suprailiac: 20, calf: 16 },
        })).toThrow(FormulaInputError);
    });

    it('female uses log-linear form (sensitive at low sums)', () => {
        // Doubling the sum should produce a noticeable density change for women.
        const lo = petroski4({ sex: 'female', age_years: 30, skinfolds_mm: { subscapular: 5, triceps: 5, suprailiac: 5, calf: 5 } });
        const hi = petroski4({ sex: 'female', age_years: 30, skinfolds_mm: { subscapular: 10, triceps: 10, suprailiac: 10, calf: 10 } });
        expect(lo).toBeGreaterThan(hi);
    });
});

// ----------------------------------------------------------------------------
// Faulkner — fixtures
// ----------------------------------------------------------------------------

describe('faulkner4 — cross-validated fixtures', () => {
    for (const fx of FIXTURES_FAULKNER) {
        it(fx.description, () => {
            const got = faulkner4(fx.input.skinfolds_mm);
            const tol = fx.tolerance?.body_fat ?? DEFAULT_TOL.body_fat;
            expect(got).toBeCloseTo(fx.expected.body_fat_percent, decimalsForTol(tol));
        });
    }

    it('throws when a required site is missing', () => {
        expect(() => faulkner4({ triceps: 10, subscapular: 12, suprailiac: 15 /* no abdomen */ }))
            .toThrow(FormulaInputError);
    });

    it('returns 5.783 with all skinfolds at zero (intercept)', () => {
        expect(faulkner4({ triceps: 0, subscapular: 0, suprailiac: 0, abdomen: 0 }))
            .toBeCloseTo(5.783, 4);
    });
});

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function assertFixtureDensity(
    fx: FormulaFixture,
    fn: (input: { sex: 'male' | 'female'; age_years: number; skinfolds_mm: Record<string, number> }) => number,
) {
    const got = fn({
        sex: fx.input.anthropometric.sex,
        age_years: fx.input.anthropometric.age_years,
        skinfolds_mm: fx.input.skinfolds_mm as Record<string, number>,
    });
    const tol = fx.tolerance?.density ?? DEFAULT_TOL.density;
    expect(got).toBeCloseTo(fx.expected.density!, decimalsForTol(tol));
}

function decimalsForTol(tol: number): number {
    // toBeCloseTo's `numDigits` is the decimal places; tol=0.0001 → 4 digits.
    return Math.round(-Math.log10(tol));
}
