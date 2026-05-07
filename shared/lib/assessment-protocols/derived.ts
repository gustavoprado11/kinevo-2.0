// ============================================================================
// Kinevo — Assessment protocols: derived quantities
// ============================================================================
// Trivial decompositions of total mass into fat and lean components, used
// by report consumers to display absolute kg alongside the percentage.
// ============================================================================

import { FormulaInputError } from './types';

/**
 * Absolute fat mass in kilograms.
 *
 *   fat_mass_kg = weight_kg × (body_fat_percent / 100)
 */
export function fatMassKg(weight_kg: number, body_fat_percent: number): number {
    if (!Number.isFinite(weight_kg) || weight_kg <= 0) {
        throw new FormulaInputError('weight_kg must be > 0', 'weight_kg');
    }
    if (
        !Number.isFinite(body_fat_percent)
        || body_fat_percent < 0
        || body_fat_percent > 100
    ) {
        throw new FormulaInputError(
            'body_fat_percent must be between 0 and 100',
            'body_fat_percent',
        );
    }
    return weight_kg * (body_fat_percent / 100);
}

/**
 * Lean (fat-free) mass in kilograms.
 *
 *   lean_mass_kg = weight_kg − fat_mass_kg
 */
export function leanMassKg(weight_kg: number, body_fat_percent: number): number {
    return weight_kg - fatMassKg(weight_kg, body_fat_percent);
}
