import { useCallback, useMemo, useState } from 'react';
import type {
    MeasurementInput,
    MeasurementSide,
    MeasurementUnit,
} from '@kinevo/shared/types/assessments';

/**
 * Local form state for a single measurement input in the wizard. Holds raw
 * string values (mirroring TextInput) plus a `dirty`/`valid` flag so the
 * UI can disable the "next" button until the input parses.
 *
 * Returns helpers to build the canonical MeasurementInput payload at
 * commit time; never mutates the parent draft.
 */
export interface MeasurementFormConfig {
    test_id: string;
    metric_key: string;
    unit: MeasurementUnit | null;
    side?: MeasurementSide | null;
    /** Range warning bounds (UX warning, not a block). */
    warn_below?: number;
    warn_above?: number;
}

export interface MeasurementFormState {
    rawValue: string;
    parsed: number | null;
    isDirty: boolean;
    isValid: boolean;
    isOutOfRange: boolean;
    rangeReason: 'below' | 'above' | null;
}

export function useAssessmentMeasurementForm(config: MeasurementFormConfig) {
    const [rawValue, setRawValue] = useState('');
    const [touched, setTouched] = useState(false);

    const parsed = useMemo(() => parseDecimal(rawValue), [rawValue]);
    const isValid = parsed !== null && parsed >= 0;
    const isDirty = touched;

    const rangeReason = useMemo<'below' | 'above' | null>(() => {
        if (parsed === null) return null;
        if (config.warn_below !== undefined && parsed < config.warn_below) return 'below';
        if (config.warn_above !== undefined && parsed > config.warn_above) return 'above';
        return null;
    }, [parsed, config.warn_below, config.warn_above]);

    const isOutOfRange = rangeReason !== null;

    const onChangeText = useCallback((text: string) => {
        setRawValue(text);
        if (!touched) setTouched(true);
    }, [touched]);

    const reset = useCallback(() => {
        setRawValue('');
        setTouched(false);
    }, []);

    const toMeasurementInput = useCallback(
        (overrides?: Partial<MeasurementInput>): MeasurementInput | null => {
            if (parsed === null) return null;
            return {
                metric_key: config.metric_key,
                value_numeric: parsed,
                value_unit: config.unit,
                side: config.side ?? null,
                attempt_number: 1,
                is_selected: true,
                raw_input: { test_id: config.test_id },
                ...overrides,
            };
        },
        [parsed, config.metric_key, config.unit, config.side, config.test_id],
    );

    const state: MeasurementFormState = {
        rawValue,
        parsed,
        isDirty,
        isValid,
        isOutOfRange,
        rangeReason,
    };

    return {
        state,
        onChangeText,
        reset,
        toMeasurementInput,
    };
}

/**
 * Decimal parser tolerant to comma decimals (BR locale) and trailing
 * separators. Returns null on empty, NaN, or negative.
 */
function parseDecimal(text: string): number | null {
    if (!text || text.trim().length === 0) return null;
    const normalized = text.trim().replace(',', '.');
    if (normalized === '.' || normalized === '-') return null;
    const n = Number(normalized);
    if (!Number.isFinite(n)) return null;
    if (n < 0) return null;
    return n;
}
