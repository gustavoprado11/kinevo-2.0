// Catalog of test "presets" available in the builder TestLibraryColumn.
// Each entry is a template that, when dropped into the canvas, instantiates
// a fresh AssessmentTest with a generated id. Catalog is intentionally
// curated (not extensible at runtime) — adding a new preset requires a code
// change so we can guarantee shape correctness.

import type {
    AssessmentTest,
    BilateralNumericTest,
    ComputedTest,
    MultiAttemptNumericTest,
    NumericUnitTest,
    ProtocolTest,
} from '@kinevo/shared/types/assessments'
import type { LucideIcon } from 'lucide-react'
import {
    Activity,
    Calculator,
    Hand,
    HeartPulse,
    Hourglass,
    Move,
    Ruler,
    Scale,
    Scaling,
    Stethoscope,
    Timer,
    Weight,
} from 'lucide-react'

export type CatalogGroup =
    | 'antropometria'
    | 'pregas'
    | 'forca'
    | 'condicionamento'
    | 'mobilidade'
    | 'computado'

export interface CatalogEntry {
    catalogId: string
    label: string
    description: string
    group: CatalogGroup
    icon: LucideIcon
    /**
     * Factory returns a *new* AssessmentTest every call. The builder fills in
     * the id with crypto.randomUUID() right before adding to the canvas, so
     * we leave id empty here.
     */
    make: () => Omit<AssessmentTest, 'id'>
}

const numeric = (
    label: string,
    metric_key: string,
    unit: NumericUnitTest['unit'],
    extras: Partial<NumericUnitTest> = {},
): Omit<NumericUnitTest, 'id'> => ({
    type: 'numeric_unit',
    label,
    metric_key,
    unit,
    ...extras,
})

const bilateral = (
    label: string,
    metric_key: string,
    unit: BilateralNumericTest['unit'],
): Omit<BilateralNumericTest, 'id'> => ({
    type: 'bilateral_numeric',
    label,
    metric_key,
    unit,
})

const multi = (
    label: string,
    metric_key: string,
    unit: MultiAttemptNumericTest['unit'],
    attempts: number,
    selection_strategy: MultiAttemptNumericTest['selection_strategy'],
): Omit<MultiAttemptNumericTest, 'id'> => ({
    type: 'multi_attempt_numeric',
    label,
    metric_key,
    unit,
    attempts,
    selection_strategy,
})

const computed = (
    label: string,
    metric_key: ComputedTest['metric_key'],
    formula_id: string,
    inputs: string[],
): Omit<ComputedTest, 'id'> => ({
    type: 'computed',
    label,
    metric_key,
    formula_id,
    inputs,
})

const protocol = (
    label: string,
    protocolId: ProtocolTest['protocol'],
): Omit<ProtocolTest, 'id'> => ({
    type: 'protocol',
    label,
    protocol: protocolId,
})

export const TEST_CATALOG: CatalogEntry[] = [
    // Antropometria
    {
        catalogId: 'cat:weight_kg',
        label: 'Peso',
        description: 'Massa corporal em kg',
        group: 'antropometria',
        icon: Weight,
        make: () => numeric('Peso', 'weight_kg', 'kg', { min: 20, max: 300, required: true }),
    },
    {
        catalogId: 'cat:height_cm',
        label: 'Altura',
        description: 'Estatura em cm',
        group: 'antropometria',
        icon: Ruler,
        make: () => numeric('Altura', 'height_cm', 'cm', { min: 80, max: 250, required: true }),
    },
    {
        catalogId: 'cat:waist_cm',
        label: 'Cintura',
        description: 'Circunferência da cintura',
        group: 'antropometria',
        icon: Scaling,
        make: () => numeric('Cintura', 'waist_cm', 'cm', { min: 40, max: 200 }),
    },
    {
        catalogId: 'cat:hip_cm',
        label: 'Quadril',
        description: 'Circunferência do quadril',
        group: 'antropometria',
        icon: Scaling,
        make: () => numeric('Quadril', 'hip_cm', 'cm', { min: 50, max: 200 }),
    },
    {
        catalogId: 'cat:arm_cm',
        label: 'Braço (bilateral)',
        description: 'Circunferência D/E',
        group: 'antropometria',
        icon: Scaling,
        make: () => bilateral('Braço', 'arm_cm', 'cm'),
    },

    // Pregas
    {
        catalogId: 'cat:skinfold_tricep',
        label: 'Prega Tríceps',
        description: 'Dobra cutânea (mm)',
        group: 'pregas',
        icon: Scale,
        make: () => numeric('Prega Tríceps', 'skinfold_tricep_mm', 'mm', { min: 1, max: 80 }),
    },
    {
        catalogId: 'cat:skinfold_subscap',
        label: 'Prega Subescapular',
        description: 'Dobra cutânea (mm)',
        group: 'pregas',
        icon: Scale,
        make: () => numeric('Prega Subescapular', 'skinfold_subscap_mm', 'mm', { min: 1, max: 80 }),
    },
    {
        catalogId: 'cat:skinfold_supra',
        label: 'Prega Suprailíaca',
        description: 'Dobra cutânea (mm)',
        group: 'pregas',
        icon: Scale,
        make: () => numeric('Prega Suprailíaca', 'skinfold_suprailiac_mm', 'mm', { min: 1, max: 80 }),
    },
    {
        catalogId: 'cat:skinfold_abd',
        label: 'Prega Abdominal',
        description: 'Dobra cutânea (mm)',
        group: 'pregas',
        icon: Scale,
        make: () => numeric('Prega Abdominal', 'skinfold_abdominal_mm', 'mm', { min: 1, max: 80 }),
    },
    {
        catalogId: 'cat:skinfold_thigh',
        label: 'Prega Coxa',
        description: 'Dobra cutânea (mm)',
        group: 'pregas',
        icon: Scale,
        make: () => numeric('Prega Coxa', 'skinfold_thigh_mm', 'mm', { min: 1, max: 80 }),
    },
    {
        catalogId: 'cat:skinfold_chest',
        label: 'Prega Peitoral',
        description: 'Dobra cutânea (mm)',
        group: 'pregas',
        icon: Scale,
        make: () => numeric('Prega Peitoral', 'skinfold_chest_mm', 'mm', { min: 1, max: 80 }),
    },

    // Força / performance
    {
        catalogId: 'cat:handgrip',
        label: 'Preensão manual',
        description: 'Dinamômetro D/E',
        group: 'forca',
        icon: Hand,
        make: () => bilateral('Preensão manual', 'handgrip_kg', 'kg'),
    },
    {
        catalogId: 'cat:vertical_jump',
        label: 'Salto vertical',
        description: '3 tentativas, melhor',
        group: 'forca',
        icon: Activity,
        make: () => multi('Salto vertical', 'vertical_jump_cm', 'cm', 3, 'best_max'),
    },
    {
        catalogId: 'cat:sprint_30m',
        label: 'Sprint 30m',
        description: '2 tentativas, melhor (s)',
        group: 'forca',
        icon: Timer,
        make: () => multi('Sprint 30m', 'sprint_30m_s', 's', 2, 'best_min'),
    },

    // Condicionamento
    {
        catalogId: 'cat:resting_hr',
        label: 'FC repouso',
        description: 'Batimentos por minuto',
        group: 'condicionamento',
        icon: HeartPulse,
        make: () => numeric('FC repouso', 'resting_hr_bpm', 'reps', { min: 30, max: 200 }),
    },
    {
        catalogId: 'cat:plank_hold',
        label: 'Prancha',
        description: 'Tempo máximo (s)',
        group: 'condicionamento',
        icon: Hourglass,
        make: () => numeric('Prancha', 'plank_hold_s', 's', { min: 0, max: 600 }),
    },
    {
        catalogId: 'cat:blood_pressure',
        label: 'Pressão arterial',
        description: 'Sistólica em mmHg (texto)',
        group: 'condicionamento',
        icon: Stethoscope,
        make: () => numeric('PA Sistólica', 'pa_sistolica', 'reps', { min: 60, max: 250 }),
    },

    // Mobilidade
    {
        catalogId: 'cat:sit_reach',
        label: 'Sentar e alcançar',
        description: 'Banco de Wells (cm)',
        group: 'mobilidade',
        icon: Move,
        make: () => numeric('Sentar e alcançar', 'sit_reach_cm', 'cm', { min: -30, max: 60 }),
    },

    // Computado
    {
        catalogId: 'cat:computed_bmi',
        label: 'IMC',
        description: 'Calculado a partir de peso/altura',
        group: 'computado',
        icon: Calculator,
        make: () => computed('IMC', 'bmi', 'bmi', ['weight_kg', 'height_cm']),
    },
    {
        catalogId: 'cat:computed_rcq',
        label: 'RCQ',
        description: 'Cintura/quadril',
        group: 'computado',
        icon: Calculator,
        make: () => computed('RCQ', 'rcq', 'rcq', ['waist_cm', 'hip_cm']),
    },
    {
        catalogId: 'cat:protocol_jp3',
        label: 'Jackson-Pollock 3 dobras',
        description: '%BG por protocolo',
        group: 'computado',
        icon: Calculator,
        make: () => protocol('Jackson-Pollock 3 dobras', 'jackson_pollock_3'),
    },
    {
        catalogId: 'cat:protocol_jp7',
        label: 'Jackson-Pollock 7 dobras',
        description: '%BG por protocolo',
        group: 'computado',
        icon: Calculator,
        make: () => protocol('Jackson-Pollock 7 dobras', 'jackson_pollock_7'),
    },
    {
        catalogId: 'cat:protocol_petroski',
        label: 'Petroski 4 dobras',
        description: '%BG por protocolo',
        group: 'computado',
        icon: Calculator,
        make: () => protocol('Petroski 4 dobras', 'petroski_4'),
    },
    {
        catalogId: 'cat:protocol_faulkner',
        label: 'Faulkner 4 dobras',
        description: '%BG por protocolo',
        group: 'computado',
        icon: Calculator,
        make: () => protocol('Faulkner 4 dobras', 'faulkner_4'),
    },
]

export const CATALOG_GROUPS: { id: CatalogGroup; label: string }[] = [
    { id: 'antropometria', label: 'Antropometria' },
    { id: 'pregas', label: 'Pregas cutâneas' },
    { id: 'forca', label: 'Força & potência' },
    { id: 'condicionamento', label: 'Condicionamento' },
    { id: 'mobilidade', label: 'Mobilidade' },
    { id: 'computado', label: 'Computados / Protocolos' },
]
