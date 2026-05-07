// ============================================================================
// Kinevo — Assessment protocols engine (public API)
// ============================================================================
// Pure-TS body composition engine, consumed by the mobile capture flow
// (M3) and the web builder/view (M4).
//
// Supported protocols:
//   - jackson_pollock_3   Jackson & Pollock 1978 (men); J&P&W 1980 (women)
//   - jackson_pollock_7   Jackson & Pollock 1978 (men); J&P&W 1980 (women)
//   - petroski_4          Petroski 1995 (Brazilian adults — pure 4 skinfolds)
//   - faulkner_4          Faulkner 1968 (direct %BF, no density)
//
// Density → %BF conversion: Siri (1956) by default, Brozek (1963) on request.
//
// Classifications:
//   - BMI: WHO TRS 854 (1995)
//   - WHR: WHO Expert Consultation, Geneva 2008 (published 2011)
//   - %BF: Pollock & Wilmore 1990, cross-checked vs ACSM Guidelines 10th ed.
//
// All formulas are pure functions; no I/O, no state, no side effects.
// Every coefficient cites a primary source in JSDoc.
// ============================================================================

export {
    bmi,
    waistHipRatio,
    siri,
    brozek,
    jacksonPollock3,
    jacksonPollock7,
    petroski4,
    faulkner4,
    sumSkinfolds,
} from './formulas';

export { classifyBMI, classifyWaistHipRatio, classifyBodyFat } from './classifications';

export { fatMassKg, leanMassKg } from './derived';

export { PROTOCOLS, type ProtocolDefinition } from './protocols';

export {
    FormulaInputError,
    type Sex,
    type ProtocolId,
    type DensityEquation,
    type SkinfoldSite,
    type SkinfoldInput,
    type AnthropometricInput,
    type CircumferenceInput,
    type BodyCompositionInput,
    type BodyCompositionResult,
    type BMICategory,
    type BMIClassification,
    type WHRRiskCategory,
    type WHRClassification,
    type BodyFatCategory,
    type BodyFatClassification,
    type Classification,
} from './types';

import {
    siri,
    brozek,
    jacksonPollock3,
    jacksonPollock7,
    petroski4,
    faulkner4,
    sumSkinfolds,
} from './formulas';
import { classifyBodyFat } from './classifications';
import { fatMassKg, leanMassKg } from './derived';
import { PROTOCOLS } from './protocols';
import {
    FormulaInputError,
    type BodyCompositionInput,
    type BodyCompositionResult,
    type DensityEquation,
    type ProtocolId,
    type Sex,
    type SkinfoldInput,
    type SkinfoldSite,
} from './types';

// ============================================================================
// calculateBodyComposition — high-level orchestrator
// ============================================================================
//
// Combines the three steps a trainer expects when finalising an assessment:
//   1. Run the protocol on the skinfolds → density (or %BF directly for
//      Faulkner).
//   2. Convert density → %BF using the requested density equation.
//   3. Classify the resulting %BF and decompose into fat/lean mass.
//
// Returns a fully populated BodyCompositionResult ready to be persisted on
// `assessment_sessions.computed_metrics`.

export function calculateBodyComposition(
    input: BodyCompositionInput,
): BodyCompositionResult {
    const { protocol, anthropometric, skinfolds_mm } = input;
    const density_equation: DensityEquation = input.density_equation ?? 'siri';
    const { sex, age_years, weight_kg } = anthropometric;

    if (!Number.isFinite(weight_kg) || weight_kg <= 0) {
        throw new FormulaInputError('weight_kg must be > 0', 'weight_kg');
    }

    const sites_used = sitesFor(protocol, sex);
    const sum_skinfolds_mm = sumSkinfolds(skinfolds_mm, sites_used);

    let body_density: number | null = null;
    let body_fat_percent: number;

    switch (protocol) {
        case 'jackson_pollock_3':
            body_density = jacksonPollock3({ sex, age_years, skinfolds_mm });
            body_fat_percent = applyDensityEquation(body_density, density_equation);
            break;
        case 'jackson_pollock_7':
            body_density = jacksonPollock7({ sex, age_years, skinfolds_mm });
            body_fat_percent = applyDensityEquation(body_density, density_equation);
            break;
        case 'petroski_4':
            body_density = petroski4({ sex, age_years, skinfolds_mm });
            body_fat_percent = applyDensityEquation(body_density, density_equation);
            break;
        case 'faulkner_4':
            body_density = null;
            body_fat_percent = faulkner4(skinfolds_mm);
            break;
        default: {
            // Exhaustiveness: if a new ProtocolId is added, TS will flag this.
            const _exhaustive: never = protocol;
            throw new FormulaInputError(
                `Unsupported protocol: ${String(_exhaustive)}`,
                'protocol',
            );
        }
    }

    const fat_mass_kg = fatMassKg(weight_kg, body_fat_percent);
    const lean_mass_kg = leanMassKg(weight_kg, body_fat_percent);
    const classification = classifyBodyFat(body_fat_percent, age_years, sex);

    return {
        protocol,
        density_equation,
        body_density,
        body_fat_percent,
        fat_mass_kg,
        lean_mass_kg,
        classification,
        inputs: {
            sum_skinfolds_mm,
            sites_used,
            age_years,
            sex,
            weight_kg,
        },
    };
}

function applyDensityEquation(
    density: number,
    equation: DensityEquation,
): number {
    return equation === 'brozek' ? brozek(density) : siri(density);
}

function sitesFor(protocol: ProtocolId, sex: Sex): SkinfoldSite[] {
    const def = PROTOCOLS[protocol];
    const entry = def.required_sites.find((r) => r.sex === sex);
    if (!entry) {
        throw new FormulaInputError(
            `Protocol ${protocol} has no site list for sex=${sex}`,
            'sex',
        );
    }
    return [...entry.sites];
}

