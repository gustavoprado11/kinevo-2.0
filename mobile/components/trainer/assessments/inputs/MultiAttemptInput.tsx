import React, { useCallback, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { colors } from '@/theme';
import { Check, RotateCcw } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import type { MeasurementInput, MeasurementUnit } from '@kinevo/shared/types/assessments';

export type SelectionStrategy = 'best_max' | 'best_min' | 'median' | 'mean';

export interface MultiAttemptInputProps {
    test_id: string;
    metric_key: string;
    label: string;
    unit: MeasurementUnit;
    attempts: number;
    selection_strategy: SelectionStrategy;
    hint?: string;
    /** Initial scratch buffer (if the trainer is returning to this test). */
    initialAttempts?: number[];
    /** Called whenever the scratch buffer changes (useful for persisting in the draft store). */
    onAttemptsChange?: (values: number[]) => void;
    /** Called when the trainer commits the final picks. Returns N rows
     *  (one per attempt) — selected one has is_selected=true. */
    onCommit: (rows: MeasurementInput[]) => void;
}

/**
 * Multi-attempt numeric capture (eg. skinfold with 2 measures, CMJ with 3).
 * Renders N input slots; computes the suggested final value via
 * `selection_strategy`. Commit produces N MeasurementInput rows so
 * history is preserved server-side.
 */
export function MultiAttemptInput({
    test_id,
    metric_key,
    label,
    unit,
    attempts,
    selection_strategy,
    hint,
    initialAttempts,
    onAttemptsChange,
    onCommit,
}: MultiAttemptInputProps) {
    const [raw, setRaw] = React.useState<string[]>(() => {
        const seed = initialAttempts ?? [];
        const arr = Array(attempts).fill('');
        for (let i = 0; i < Math.min(attempts, seed.length); i++) {
            arr[i] = String(seed[i]).replace('.', ',');
        }
        return arr;
    });

    const parsed = useMemo(
        () => raw.map((s) => parseDecimal(s)),
        [raw],
    );

    const validValues = useMemo(
        () => parsed.filter((v): v is number => v !== null),
        [parsed],
    );

    React.useEffect(() => {
        onAttemptsChange?.(validValues);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [validValues.length, ...validValues]);

    const allFilled = validValues.length === attempts;

    // best_max/best_min: o valor final É uma das tentativas (marca a própria).
    // mean/median: o agregado não coincide com nenhuma tentativa crua → precisa
    // de uma linha selecionada à parte carregando o valor calculado (C5).
    const aggregateIsAttempt =
        selection_strategy === 'best_max' || selection_strategy === 'best_min';

    const finalValue = useMemo(() => {
        if (!allFilled) return null;
        return applyStrategy(validValues, selection_strategy);
    }, [allFilled, validValues, selection_strategy]);

    const selectedIndex = useMemo(() => {
        if (finalValue === null || !allFilled) return -1;
        // Pick the index whose value is closest to finalValue (handles
        // median/mean which may not equal any single attempt).
        let bestI = 0;
        let bestDelta = Number.POSITIVE_INFINITY;
        for (let i = 0; i < parsed.length; i++) {
            const v = parsed[i];
            if (v === null) continue;
            const d = Math.abs(v - finalValue);
            if (d < bestDelta) { bestDelta = d; bestI = i; }
        }
        return bestI;
    }, [parsed, finalValue, allFilled]);

    const updateSlot = useCallback((idx: number, text: string) => {
        setRaw((prev) => {
            const next = [...prev];
            next[idx] = text;
            return next;
        });
    }, []);

    const reset = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setRaw(Array(attempts).fill(''));
    }, [attempts]);

    const handleCommit = useCallback(() => {
        if (!allFilled || finalValue === null) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const attemptRows: MeasurementInput[] = parsed.map((v, i) => ({
            metric_key,
            value_numeric: v as number,
            value_unit: unit,
            side: null,
            attempt_number: i + 1,
            // mean/median: tentativas viram histórico (is_selected=false); o valor
            // final vai na linha agregada abaixo. best_max/best_min: marca a tentativa.
            is_selected: aggregateIsAttempt && i === selectedIndex,
            raw_input: { test_id, selection_strategy },
        }));

        const rows: MeasurementInput[] = aggregateIsAttempt
            ? attemptRows
            : [
                ...attemptRows,
                {
                    // C5: persiste a média/mediana CALCULADA como a linha selecionada.
                    // Sem isto, pickNumeric/extractSkinfolds liam uma tentativa crua
                    // (a mais próxima) em vez do valor final exibido — corrompendo
                    // % gordura / IMC / RCQ silenciosamente.
                    metric_key,
                    value_numeric: finalValue,
                    value_unit: unit,
                    side: null,
                    attempt_number: attempts + 1,
                    is_selected: true,
                    raw_input: { test_id, selection_strategy, aggregate: true },
                },
            ];
        onCommit(rows);
    }, [allFilled, finalValue, parsed, metric_key, unit, test_id, selectedIndex, selection_strategy, aggregateIsAttempt, attempts, onCommit]);

    return (
        <View style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text
                    style={{
                        fontSize: 13,
                        fontWeight: '600',
                        color: colors.text.secondary,
                        textTransform: 'uppercase',
                        letterSpacing: 1.2,
                    }}>
                    {label} — {attempts} tentativas
                </Text>
                <TouchableOpacity
                    onPress={reset}
                    accessibilityRole="button"
                    accessibilityLabel="Limpar tentativas"
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4, padding: 4 }}>
                    <RotateCcw size={14} color={colors.text.tertiary} />
                    <Text style={{ fontSize: 12, color: colors.text.tertiary }}>Limpar</Text>
                </TouchableOpacity>
            </View>

            <View style={{ gap: 8 }}>
                {Array.from({ length: attempts }).map((_, i) => (
                    <Slot
                        key={i}
                        index={i}
                        value={raw[i] ?? ''}
                        onChange={(t) => updateSlot(i, t)}
                        unit={unit}
                        valid={parsed[i] !== null}
                        isSelected={aggregateIsAttempt && i === selectedIndex && allFilled}
                    />
                ))}
            </View>

            {finalValue !== null && (
                <View
                    style={{
                        backgroundColor: colors.brand.primaryLight,
                        borderRadius: 12,
                        padding: 14,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                    }}>
                    <Text style={{ fontSize: 13, color: colors.brand.primaryDark, fontWeight: '600' }}>
                        Valor final ({strategyLabel(selection_strategy)})
                    </Text>
                    <Text style={{ fontSize: 22, fontWeight: '800', color: colors.brand.primaryDark }}>
                        {finalValue.toFixed(1)} {unit}
                    </Text>
                </View>
            )}

            {hint && (
                <Text style={{ fontSize: 13, color: colors.text.tertiary, lineHeight: 18 }}>
                    {hint}
                </Text>
            )}

            <TouchableOpacity
                onPress={handleCommit}
                disabled={!allFilled}
                accessibilityRole="button"
                accessibilityLabel="Confirmar medição"
                accessibilityState={{ disabled: !allFilled }}
                style={{
                    marginTop: 4,
                    backgroundColor: allFilled ? colors.brand.primary : colors.background.inset,
                    borderRadius: 14,
                    paddingVertical: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                }}>
                <Check size={18} color={allFilled ? colors.text.inverse : colors.text.tertiary} />
                <Text
                    style={{
                        fontSize: 15,
                        fontWeight: '700',
                        color: allFilled ? colors.text.inverse : colors.text.tertiary,
                    }}>
                    Confirmar
                </Text>
            </TouchableOpacity>
        </View>
    );
}

function Slot(props: {
    index: number;
    value: string;
    onChange: (v: string) => void;
    unit: MeasurementUnit;
    valid: boolean;
    isSelected: boolean;
}) {
    return (
        <View
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.background.card,
                borderRadius: 14,
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderWidth: 1,
                borderColor: props.isSelected
                    ? colors.brand.primary
                    : props.valid
                        ? colors.border.secondary
                        : colors.border.primary,
            }}>
            <Text
                style={{
                    width: 28,
                    fontSize: 12,
                    fontWeight: '700',
                    color: colors.text.tertiary,
                }}>
                #{props.index + 1}
            </Text>
            <TextInput
                value={props.value}
                onChangeText={props.onChange}
                placeholder="0"
                placeholderTextColor={colors.text.quaternary}
                keyboardType="decimal-pad"
                inputMode="decimal"
                accessibilityLabel={`Tentativa ${props.index + 1} em ${props.unit}`}
                style={{
                    flex: 1,
                    fontSize: 24,
                    lineHeight: 30,
                    fontWeight: '700',
                    color: colors.text.primary,
                    paddingVertical: 0,
                }}
            />
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text.tertiary, marginLeft: 4 }}>
                {props.unit}
            </Text>
            {props.isSelected && (
                <View style={{ marginLeft: 8 }}>
                    <Check size={16} color={colors.brand.primary} />
                </View>
            )}
        </View>
    );
}

function applyStrategy(values: number[], s: SelectionStrategy): number {
    if (values.length === 0) return 0;
    if (s === 'best_max') return Math.max(...values);
    if (s === 'best_min') return Math.min(...values);
    if (s === 'mean') return values.reduce((a, b) => a + b, 0) / values.length;
    // median
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function strategyLabel(s: SelectionStrategy): string {
    switch (s) {
        case 'best_max': return 'melhor';
        case 'best_min': return 'menor';
        case 'mean': return 'média';
        case 'median': return 'mediana';
    }
}

function parseDecimal(text: string): number | null {
    if (!text || !text.trim()) return null;
    const n = Number(text.trim().replace(',', '.'));
    if (!Number.isFinite(n) || n < 0) return null;
    return n;
}
