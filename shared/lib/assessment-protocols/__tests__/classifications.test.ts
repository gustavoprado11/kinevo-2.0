import { describe, it, expect } from 'vitest';
import {
    classifyBMI,
    classifyWaistHipRatio,
    classifyBodyFat,
} from '@kinevo/shared/lib/assessment-protocols/classifications';
import { FormulaInputError } from '@kinevo/shared/lib/assessment-protocols/types';

// ----------------------------------------------------------------------------
// BMI
// ----------------------------------------------------------------------------

describe('classifyBMI', () => {
    const cases: Array<[number, string]> = [
        [16, 'underweight'],
        [18.4, 'underweight'],
        [18.5, 'normal'],
        [22, 'normal'],
        [24.9, 'normal'],
        [25, 'overweight'],
        [29.9, 'overweight'],
        [30, 'obese_class_1'],
        [34.9, 'obese_class_1'],
        [35, 'obese_class_2'],
        [39.9, 'obese_class_2'],
        [40, 'obese_class_3'],
        [55, 'obese_class_3'],
    ];

    for (const [v, expected] of cases) {
        it(`BMI ${v} → ${expected}`, () => {
            expect(classifyBMI(v).category).toBe(expected);
        });
    }

    it('returns ranges aligned with WHO cut-points', () => {
        expect(classifyBMI(22).range).toEqual({ min: 18.5, max: 25 });
        expect(classifyBMI(50).range).toEqual({ min: 40, max: null });
        expect(classifyBMI(15).range).toEqual({ min: null, max: 18.5 });
    });

    it('returns Portuguese labels', () => {
        expect(classifyBMI(22).label_pt).toBe('Peso normal');
        expect(classifyBMI(27).label_pt).toBe('Sobrepeso');
        expect(classifyBMI(45).label_pt).toBe('Obesidade grau III');
    });

    it('throws on invalid value', () => {
        expect(() => classifyBMI(0)).toThrow(FormulaInputError);
        expect(() => classifyBMI(-1)).toThrow(FormulaInputError);
        expect(() => classifyBMI(NaN)).toThrow(FormulaInputError);
    });
});

// ----------------------------------------------------------------------------
// WHR
// ----------------------------------------------------------------------------

describe('classifyWaistHipRatio', () => {
    it('classifies men by WHO 2008 thresholds', () => {
        expect(classifyWaistHipRatio(0.85, 'male').category).toBe('low');
        expect(classifyWaistHipRatio(0.95, 'male').category).toBe('moderate');
        expect(classifyWaistHipRatio(1.0, 'male').category).toBe('moderate');
        expect(classifyWaistHipRatio(1.05, 'male').category).toBe('high');
    });

    it('classifies women by WHO 2008 thresholds', () => {
        expect(classifyWaistHipRatio(0.75, 'female').category).toBe('low');
        expect(classifyWaistHipRatio(0.80, 'female').category).toBe('moderate');
        expect(classifyWaistHipRatio(0.85, 'female').category).toBe('moderate');
        expect(classifyWaistHipRatio(0.90, 'female').category).toBe('high');
    });

    it('returns sex-specific ranges', () => {
        expect(classifyWaistHipRatio(0.85, 'male').range).toEqual({ min: null, max: 0.95 });
        expect(classifyWaistHipRatio(0.85, 'female').range).toEqual({ min: 0.80, max: 0.85 });
    });

    it('returns Portuguese labels', () => {
        expect(classifyWaistHipRatio(0.85, 'male').label_pt).toBe('Risco baixo');
        expect(classifyWaistHipRatio(0.95, 'male').label_pt).toBe('Risco moderado');
        expect(classifyWaistHipRatio(1.10, 'male').label_pt).toBe('Risco alto');
    });

    it('throws on invalid value', () => {
        expect(() => classifyWaistHipRatio(0, 'male')).toThrow(FormulaInputError);
        expect(() => classifyWaistHipRatio(-0.5, 'female')).toThrow(FormulaInputError);
        expect(() => classifyWaistHipRatio(NaN, 'male')).toThrow(FormulaInputError);
    });
});

// ----------------------------------------------------------------------------
// Body fat (Pollock & Wilmore 1990)
// ----------------------------------------------------------------------------

describe('classifyBodyFat — Pollock & Wilmore 1990', () => {
    // Below the essential floor (men <5%, women <12%) → essential
    it('returns essential below the sex-specific floor', () => {
        expect(classifyBodyFat(3, 25, 'male').category).toBe('essential');
        expect(classifyBodyFat(4.99, 35, 'male').category).toBe('essential');
        expect(classifyBodyFat(11, 25, 'female').category).toBe('essential');
        expect(classifyBodyFat(11.99, 50, 'female').category).toBe('essential');
    });

    // Men ages 18-29: ath<11, fit<14, avg<17, above<20, else obese
    it('classifies men 18-29 by P&W band', () => {
        expect(classifyBodyFat(8, 25, 'male').category).toBe('athletic');
        expect(classifyBodyFat(13, 25, 'male').category).toBe('fitness');
        expect(classifyBodyFat(16, 25, 'male').category).toBe('average');
        expect(classifyBodyFat(19, 25, 'male').category).toBe('above_average');
        expect(classifyBodyFat(22, 25, 'male').category).toBe('obese');
    });

    // Men ages 30-39: ath<12, fit<15, avg<18, above<22
    it('classifies men 30-39 by P&W band', () => {
        expect(classifyBodyFat(10, 30, 'male').category).toBe('athletic');
        expect(classifyBodyFat(13, 30, 'male').category).toBe('fitness');
        expect(classifyBodyFat(17, 30, 'male').category).toBe('average');
        expect(classifyBodyFat(21, 30, 'male').category).toBe('above_average');
        expect(classifyBodyFat(25, 30, 'male').category).toBe('obese');
    });

    it('classifies men 40-49, 50-59, 60+ at the band edges', () => {
        expect(classifyBodyFat(13, 45, 'male').category).toBe('athletic'); // <14
        expect(classifyBodyFat(14, 45, 'male').category).toBe('fitness');  // <17
        expect(classifyBodyFat(14, 55, 'male').category).toBe('athletic'); // <15
        expect(classifyBodyFat(15, 55, 'male').category).toBe('fitness');
        expect(classifyBodyFat(15, 65, 'male').category).toBe('athletic'); // <16 at 60+
        expect(classifyBodyFat(28, 65, 'male').category).toBe('obese');    // ≥27
    });

    it('classifies women 18-29 by P&W band', () => {
        expect(classifyBodyFat(15, 25, 'female').category).toBe('athletic');
        expect(classifyBodyFat(18, 25, 'female').category).toBe('fitness');
        expect(classifyBodyFat(22, 25, 'female').category).toBe('average');
        expect(classifyBodyFat(25, 25, 'female').category).toBe('above_average');
        expect(classifyBodyFat(30, 25, 'female').category).toBe('obese');
    });

    it('classifies women 30-39 by P&W band', () => {
        expect(classifyBodyFat(16, 35, 'female').category).toBe('athletic');
        expect(classifyBodyFat(20, 35, 'female').category).toBe('fitness');
        expect(classifyBodyFat(23, 35, 'female').category).toBe('average');
        expect(classifyBodyFat(26, 35, 'female').category).toBe('above_average');
        expect(classifyBodyFat(35, 35, 'female').category).toBe('obese');
    });

    it('classifies women 40-49, 50-59, 60+ at the band edges', () => {
        expect(classifyBodyFat(17, 45, 'female').category).toBe('athletic');
        expect(classifyBodyFat(18, 55, 'female').category).toBe('athletic'); // <19
        expect(classifyBodyFat(19, 65, 'female').category).toBe('athletic'); // <20
        expect(classifyBodyFat(33, 65, 'female').category).toBe('obese');
    });

    it('clamps ages below the youngest band to that band', () => {
        // Age 16 → behaves like 18-29 band.
        expect(classifyBodyFat(8, 16, 'male').category).toBe('athletic');
        expect(classifyBodyFat(15, 16, 'female').category).toBe('athletic');
    });

    it('returns Portuguese labels', () => {
        expect(classifyBodyFat(8, 25, 'male').label_pt).toBe('Atlético');
        expect(classifyBodyFat(13, 25, 'male').label_pt).toBe('Bom');
        expect(classifyBodyFat(16, 25, 'male').label_pt).toBe('Média');
        expect(classifyBodyFat(19, 25, 'male').label_pt).toBe('Acima da média');
        expect(classifyBodyFat(22, 25, 'male').label_pt).toBe('Obesidade');
        expect(classifyBodyFat(3, 25, 'male').label_pt).toBe('Gordura essencial');
    });

    it('returns ranges with band-correct min/max', () => {
        // Male 30-39, athletic band: floor 5 → 12
        expect(classifyBodyFat(10, 30, 'male').range).toEqual({ min: 5, max: 12 });
        // Female 30-39, obese band: above_average_max 27 → null
        expect(classifyBodyFat(40, 30, 'female').range).toEqual({ min: 27, max: null });
        // Essential: null → floor
        expect(classifyBodyFat(3, 30, 'male').range).toEqual({ min: null, max: 5 });
    });

    it('throws on invalid inputs', () => {
        expect(() => classifyBodyFat(-1, 25, 'male')).toThrow(FormulaInputError);
        expect(() => classifyBodyFat(150, 25, 'male')).toThrow(FormulaInputError);
        expect(() => classifyBodyFat(NaN, 25, 'male')).toThrow(FormulaInputError);
        expect(() => classifyBodyFat(20, 0, 'male')).toThrow(FormulaInputError);
        expect(() => classifyBodyFat(20, -1, 'male')).toThrow(FormulaInputError);
    });
});
