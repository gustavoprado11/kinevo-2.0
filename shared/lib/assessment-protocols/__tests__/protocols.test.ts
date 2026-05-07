import { describe, it, expect } from 'vitest';
import {
    calculateBodyComposition,
    PROTOCOLS,
} from '@kinevo/shared/lib/assessment-protocols';
import { FormulaInputError } from '@kinevo/shared/lib/assessment-protocols/types';
import {
    FIXTURES_JP3,
    FIXTURES_JP7,
    FIXTURES_PETROSKI,
    FIXTURES_FAULKNER,
    DEFAULT_TOL,
} from './fixtures';

describe('PROTOCOLS registry', () => {
    it('lists all four protocol ids', () => {
        expect(Object.keys(PROTOCOLS).sort()).toEqual([
            'faulkner_4',
            'jackson_pollock_3',
            'jackson_pollock_7',
            'petroski_4',
        ]);
    });

    it('every protocol has required_sites for both sexes', () => {
        for (const def of Object.values(PROTOCOLS)) {
            const sexes = def.required_sites.map((r) => r.sex).sort();
            expect(sexes).toEqual(['female', 'male']);
        }
    });

    it('Faulkner is the only one that does not compute density', () => {
        expect(PROTOCOLS.faulkner_4.computes_density).toBe(false);
        expect(PROTOCOLS.jackson_pollock_3.computes_density).toBe(true);
        expect(PROTOCOLS.jackson_pollock_7.computes_density).toBe(true);
        expect(PROTOCOLS.petroski_4.computes_density).toBe(true);
    });
});

describe('calculateBodyComposition — JP3 fixtures', () => {
    for (const fx of FIXTURES_JP3) {
        it(`${fx.description} → expected ${fx.expected.body_fat_percent}% (${fx.expected.classification_category})`, () => {
            const out = calculateBodyComposition(fx.input);
            expect(out.protocol).toBe('jackson_pollock_3');
            expect(out.density_equation).toBe('siri');
            expect(out.body_density).toBeCloseTo(fx.expected.density!, 4);
            expect(out.body_fat_percent).toBeCloseTo(fx.expected.body_fat_percent, 1);
            expect(out.classification.category).toBe(fx.expected.classification_category);
            // Mass decomposition must add up to total weight.
            expect(out.fat_mass_kg + out.lean_mass_kg).toBeCloseTo(
                fx.input.anthropometric.weight_kg, 4,
            );
        });
    }
});

describe('calculateBodyComposition — JP7 fixtures', () => {
    for (const fx of FIXTURES_JP7) {
        it(`${fx.description} → ${fx.expected.body_fat_percent}%`, () => {
            const out = calculateBodyComposition(fx.input);
            expect(out.body_density).toBeCloseTo(fx.expected.density!, 4);
            expect(out.body_fat_percent).toBeCloseTo(fx.expected.body_fat_percent, 1);
            expect(out.classification.category).toBe(fx.expected.classification_category);
        });
    }
});

describe('calculateBodyComposition — Petroski fixtures', () => {
    for (const fx of FIXTURES_PETROSKI) {
        it(`${fx.description} → ${fx.expected.body_fat_percent}%`, () => {
            const out = calculateBodyComposition(fx.input);
            expect(out.body_density).toBeCloseTo(fx.expected.density!, 4);
            expect(out.body_fat_percent).toBeCloseTo(fx.expected.body_fat_percent, 1);
            expect(out.classification.category).toBe(fx.expected.classification_category);
        });
    }
});

describe('calculateBodyComposition — Faulkner fixtures', () => {
    for (const fx of FIXTURES_FAULKNER) {
        it(`${fx.description} → ${fx.expected.body_fat_percent}%`, () => {
            const out = calculateBodyComposition(fx.input);
            expect(out.body_density).toBeNull();
            expect(out.body_fat_percent).toBeCloseTo(fx.expected.body_fat_percent, 1);
            expect(out.classification.category).toBe(fx.expected.classification_category);
        });
    }
});

describe('calculateBodyComposition — orchestrator behaviour', () => {
    const baseInput = FIXTURES_JP3[0]!.input;

    it('uses Siri by default', () => {
        const out = calculateBodyComposition(baseInput);
        expect(out.density_equation).toBe('siri');
    });

    it('uses Brozek when requested and yields different %BF', () => {
        const siriOut = calculateBodyComposition(baseInput);
        const brozOut = calculateBodyComposition({ ...baseInput, density_equation: 'brozek' });
        expect(brozOut.density_equation).toBe('brozek');
        expect(brozOut.body_fat_percent).not.toBeCloseTo(siriOut.body_fat_percent, 2);
    });

    it('echoes the inputs used into the result', () => {
        const out = calculateBodyComposition(baseInput);
        expect(out.inputs.age_years).toBe(baseInput.anthropometric.age_years);
        expect(out.inputs.sex).toBe(baseInput.anthropometric.sex);
        expect(out.inputs.weight_kg).toBe(baseInput.anthropometric.weight_kg);
        expect(out.inputs.sites_used).toEqual(['chest', 'abdomen', 'thigh']);
        expect(out.inputs.sum_skinfolds_mm).toBeCloseTo(53, 4);
    });

    it('throws on non-positive weight_kg', () => {
        expect(() => calculateBodyComposition({
            ...baseInput,
            anthropometric: { ...baseInput.anthropometric, weight_kg: 0 },
        })).toThrow(FormulaInputError);
        expect(() => calculateBodyComposition({
            ...baseInput,
            anthropometric: { ...baseInput.anthropometric, weight_kg: NaN },
        })).toThrow(FormulaInputError);
    });

    it('throws when a required skinfold for the sex is missing', () => {
        expect(() => calculateBodyComposition({
            ...baseInput,
            skinfolds_mm: { abdomen: 20, thigh: 18 }, // missing chest
        })).toThrow(FormulaInputError);
    });
});
