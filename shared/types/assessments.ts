// ============================================================================
// Kinevo — Assessment domain types
// ============================================================================
// Shared between mobile, web and (future) edge functions. Mirrors the SQL
// schema introduced in migration 122_assessments_phase1.sql.
// ============================================================================

// Lifecycle
export type AssessmentSessionStatus =
    | 'scheduled'
    | 'in_progress'
    | 'completed'
    | 'cancelled';

export type DeliveryMode = 'student_self' | 'trainer_in_person' | 'both';

// Lateralidade
export type MeasurementSide = 'left' | 'right' | 'both' | 'unilateral';

// Unidades suportadas
export type MeasurementUnit =
    | 'kg'
    | 'g'
    | 'cm'
    | 'mm'
    | 'm'
    | '%'
    | 's'
    | 'ms'
    | 'reps'
    | 'rpm'
    | 'w'
    | 'kg/m²';

// Métrica calculável (pré-computada no finalize)
export type ComputedMetricKey =
    | 'bmi'
    | 'body_fat_percent'
    | 'lean_mass_kg'
    | 'fat_mass_kg'
    | 'rcq'
    | 'body_density';

// Protocolo de cálculo
export type AssessmentProtocol =
    | 'jackson_pollock_3'
    | 'jackson_pollock_7'
    | 'petroski_4'
    | 'faulkner_4';

// ============================================================================
// Row types (mapeiam tabelas SQL)
// ============================================================================

export interface AssessmentSession {
    id: string;
    trainer_id: string;
    student_id: string;
    template_id: string | null;
    template_version: number | null;
    template_snapshot: AssessmentTemplateSchema | null;
    status: AssessmentSessionStatus;
    scheduled_at: string | null;
    started_at: string | null;
    completed_at: string | null;
    cancelled_at: string | null;
    computed_metrics: ComputedMetrics | null;
    notes: string | null;
    inbox_item_id: string | null;
    created_at: string;
    updated_at: string;
}

export interface AssessmentMeasurement {
    id: string;
    session_id: string;
    metric_key: string;
    value_numeric: number | null;
    value_text: string | null;
    value_unit: MeasurementUnit | null;
    side: MeasurementSide | null;
    attempt_number: number;
    is_selected: boolean;
    raw_input: Record<string, unknown> | null;
    measured_at: string;
}

// ============================================================================
// Template schema (extensão do form schema atual)
// ============================================================================

export interface AssessmentTemplateSchema {
    schema_version: string; // '1.0'
    layout?: {
        estimated_minutes?: number;
        progress_mode?: 'per_question' | 'bar';
    };
    sections: AssessmentSection[];
}

export interface AssessmentSection {
    id: string;
    title: string;
    icon?: string;
    tests: AssessmentTest[];
}

export type AssessmentTest =
    | NumericUnitTest
    | BilateralNumericTest
    | MultiAttemptNumericTest
    | ComputedTest
    | ProtocolTest;

export interface NumericUnitTest {
    id: string;
    type: 'numeric_unit';
    label: string;
    metric_key: string;
    unit: MeasurementUnit;
    min?: number;
    max?: number;
    required?: boolean;
    hint?: string;
}

export interface BilateralNumericTest {
    id: string;
    type: 'bilateral_numeric';
    label: string;
    metric_key: string;
    unit: MeasurementUnit;
    required?: boolean;
}

export interface MultiAttemptNumericTest {
    id: string;
    type: 'multi_attempt_numeric';
    label: string;
    metric_key: string;
    unit: MeasurementUnit;
    attempts: number;
    selection_strategy: 'best_max' | 'best_min' | 'median' | 'mean';
}

export interface ComputedTest {
    id: string;
    type: 'computed';
    label: string;
    metric_key: ComputedMetricKey;
    formula_id: string;
    inputs: string[];
}

export interface ProtocolTest {
    id: string;
    type: 'protocol';
    label: string;
    protocol: AssessmentProtocol;
}

// ============================================================================
// Métricas calculadas (output do finalize)
// ============================================================================

export interface ComputedMetrics {
    bmi?: number;
    body_density?: number;
    body_fat_percent?: number;
    lean_mass_kg?: number;
    fat_mass_kg?: number;
    rcq?: number;
    // Permite extensão futura sem quebrar compatibilidade
    [key: string]: number | string | undefined;
}

// ============================================================================
// RPC payloads (input dos hooks/actions)
// ============================================================================

export interface MeasurementInput {
    metric_key: string;
    value_numeric?: number | null;
    value_text?: string | null;
    value_unit?: MeasurementUnit | null;
    side?: MeasurementSide | null;
    attempt_number?: number;
    is_selected?: boolean;
    raw_input?: Record<string, unknown> | null;
}

// Linha enriquecida retornada por get_assessment_sessions
export interface AssessmentSessionListItem {
    id: string;
    student_id: string;
    template_id: string | null;
    status: AssessmentSessionStatus;
    scheduled_at: string | null;
    started_at: string | null;
    completed_at: string | null;
    computed_metrics: ComputedMetrics | null;
    student_name: string;
    student_avatar: string | null;
    template_title: string | null;
}

// Estrutura agregada retornada por get_assessment_session
export interface AssessmentSessionDetail {
    session: AssessmentSession;
    student: {
        id: string;
        name: string;
        avatar_url: string | null;
        [key: string]: unknown;
    };
    template: {
        id: string;
        title: string;
        category: string;
        delivery_mode: DeliveryMode;
        schema_json: AssessmentTemplateSchema;
        [key: string]: unknown;
    } | null;
    measurements: AssessmentMeasurement[];
}

export interface FinalizeAssessmentResult {
    session_id: string;
    inbox_item_id: string;
    completed_at: string;
}
