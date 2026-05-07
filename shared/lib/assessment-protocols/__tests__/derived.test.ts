import { describe, it, expect } from 'vitest';
import { fatMassKg, leanMassKg } from '@kinevo/shared/lib/assessment-protocols/derived';
import { FormulaInputError } from '@kinevo/shared/lib/assessment-protocols/types';

describe('fatMassKg', () => {
    it('returns weight × bf%/100', () => {
        expect(fatMassKg(80, 20)).toBeCloseTo(16, 4);
        expect(fatMassKg(60, 25)).toBeCloseTo(15, 4);
    });

    it('handles 0% body fat', () => {
        expect(fatMassKg(70, 0)).toBe(0);
    });

    it('handles 100% body fat (degenerate but valid)', () => {
        expect(fatMassKg(70, 100)).toBe(70);
    });

    it('throws on invalid weight', () => {
        expect(() => fatMassKg(0, 20)).toThrow(FormulaInputError);
        expect(() => fatMassKg(-1, 20)).toThrow(FormulaInputError);
        expect(() => fatMassKg(NaN, 20)).toThrow(FormulaInputError);
    });

    it('throws on bf% out of range', () => {
        expect(() => fatMassKg(70, -1)).toThrow(FormulaInputError);
        expect(() => fatMassKg(70, 101)).toThrow(FormulaInputError);
        expect(() => fatMassKg(70, NaN)).toThrow(FormulaInputError);
    });
});

describe('leanMassKg', () => {
    it('returns weight − fat mass', () => {
        expect(leanMassKg(80, 20)).toBeCloseTo(64, 4);
        expect(leanMassKg(60, 25)).toBeCloseTo(45, 4);
    });

    it('matches weight when bf%=0', () => {
        expect(leanMassKg(70, 0)).toBe(70);
    });

    it('matches 0 when bf%=100', () => {
        expect(leanMassKg(70, 100)).toBe(0);
    });

    it('propagates input validation from fatMassKg', () => {
        expect(() => leanMassKg(0, 20)).toThrow(FormulaInputError);
        expect(() => leanMassKg(70, -1)).toThrow(FormulaInputError);
    });
});
