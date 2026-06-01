import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, AlertCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { colors } from '@/theme';
import type {
    AssessmentTest,
    BilateralNumericTest,
    MultiAttemptNumericTest,
    NumericUnitTest,
    MeasurementUnit,
} from '@kinevo/shared/types/assessments';

interface Props {
    test: AssessmentTest | null;
    duplicateKey: boolean;
    onSave: (next: AssessmentTest) => void;
    onClose: () => void;
}

const UNIT_OPTIONS: MeasurementUnit[] = [
    'kg', 'g', 'cm', 'mm', 'm', '%', 's', 'ms', 'reps', 'rpm', 'w', 'kg/m²',
];

const STRATEGY_OPTIONS: { id: MultiAttemptNumericTest['selection_strategy']; label: string }[] = [
    { id: 'best_max', label: 'Melhor (máximo)' },
    { id: 'best_min', label: 'Melhor (mínimo)' },
    { id: 'median', label: 'Mediana' },
    { id: 'mean', label: 'Média' },
];

// M10A/B2 — bottom sheet pra editar propriedades de um teste.
// Edita campos comuns (label, metric_key) + campos específicos por tipo.
// Computed e Protocol têm shape fixo (só label editável).
export function TestPropertiesSheet({ test, duplicateKey, onSave, onClose }: Props) {
    const insets = useSafeAreaInsets();
    const sheetRef = useRef<BottomSheet>(null);
    const snapPoints = useMemo(() => ['75%', '95%'], []);
    const [draft, setDraft] = useState<AssessmentTest | null>(test);

    useEffect(() => {
        setDraft(test);
        if (test) {
            sheetRef.current?.expand();
        } else {
            sheetRef.current?.close();
        }
    }, [test]);

    const renderBackdrop = useCallback(
        (props: any) => (
            <BottomSheetBackdrop
                {...props}
                disappearsOnIndex={-1}
                appearsOnIndex={0}
                opacity={0.5}
            />
        ),
        [],
    );

    const handleSave = useCallback(() => {
        if (!draft) return;
        if (draft.label.trim().length === 0) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onSave({ ...draft, label: draft.label.trim() });
        onClose();
    }, [draft, onSave, onClose]);

    if (!test) return null;

    return (
        <BottomSheet
            ref={sheetRef}
            snapPoints={snapPoints}
            index={0}
            topInset={insets.top}
            enableDynamicSizing={false}
            enablePanDownToClose
            onClose={onClose}
            backdropComponent={renderBackdrop}
            backgroundStyle={{ backgroundColor: colors.background.card }}
            handleIndicatorStyle={{ backgroundColor: colors.text.quaternary }}
        >
            <View style={{ flex: 1 }}>
                {/* Header */}
                <View
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 16,
                        paddingVertical: 8,
                        borderBottomWidth: 1,
                        borderBottomColor: colors.border.secondary,
                    }}
                >
                    <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: colors.text.primary }}>
                        Propriedades
                    </Text>
                    <TouchableOpacity
                        onPress={handleSave}
                        disabled={!draft || draft.label.trim().length === 0}
                        style={{
                            paddingHorizontal: 14,
                            paddingVertical: 6,
                            borderRadius: 8,
                            backgroundColor:
                                draft && draft.label.trim().length > 0
                                    ? colors.brand.primary
                                    : colors.background.elevated,
                        }}
                    >
                        <Text
                            style={{
                                color:
                                    draft && draft.label.trim().length > 0
                                        ? '#fff'
                                        : colors.text.tertiary,
                                fontSize: 12,
                                fontWeight: '600',
                            }}
                        >
                            Salvar
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={onClose} hitSlop={8} style={{ padding: 4, marginLeft: 8 }}>
                        <X size={18} color={colors.text.secondary} />
                    </TouchableOpacity>
                </View>

                <BottomSheetScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 48 }}
                    keyboardShouldPersistTaps="handled"
                >
                    {duplicateKey && (
                        <View
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 6,
                                backgroundColor: colors.error.light,
                                borderColor: colors.error.default + '40',
                                borderWidth: 1,
                                borderRadius: 10,
                                padding: 10,
                                marginBottom: 12,
                            }}
                        >
                            <AlertCircle size={14} color={colors.error.default} />
                            <Text style={{ fontSize: 12, color: colors.error.default, flex: 1 }}>
                                Outro teste já usa essa chave de métrica.
                            </Text>
                        </View>
                    )}

                    {/* Label */}
                    <FieldLabel>Nome do teste</FieldLabel>
                    <TextInput
                        value={draft?.label ?? ''}
                        onChangeText={t => setDraft(d => (d ? { ...d, label: t } as AssessmentTest : d))}
                        placeholder="Ex.: Peso corporal"
                        placeholderTextColor={colors.text.quaternary}
                        style={inputStyle}
                    />

                    {/* Type-specific fields */}
                    {draft?.type === 'numeric_unit' && (
                        <NumericUnitFields
                            test={draft}
                            onChange={(next) => setDraft(next)}
                        />
                    )}
                    {draft?.type === 'bilateral_numeric' && (
                        <BilateralFields
                            test={draft}
                            onChange={(next) => setDraft(next)}
                        />
                    )}
                    {draft?.type === 'multi_attempt_numeric' && (
                        <MultiAttemptFields
                            test={draft}
                            onChange={(next) => setDraft(next)}
                        />
                    )}
                    {draft?.type === 'computed' && (
                        <ReadOnlyNote>
                            Cálculo automático com base em {draft.inputs.join(', ')}.
                        </ReadOnlyNote>
                    )}
                    {draft?.type === 'protocol' && (
                        <ReadOnlyNote>
                            Protocolo &quot;{draft.protocol}&quot; com fórmula fixa.
                        </ReadOnlyNote>
                    )}
                </BottomSheetScrollView>
            </View>
        </BottomSheet>
    );
}

const inputStyle = {
    backgroundColor: colors.background.inset,
    borderWidth: 1,
    borderColor: colors.border.secondary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text.primary,
    marginBottom: 14,
} as const;

function FieldLabel({ children }: { children: React.ReactNode }) {
    return (
        <Text
            style={{
                fontSize: 11,
                fontWeight: '700',
                letterSpacing: 1,
                color: colors.text.tertiary,
                marginBottom: 6,
            }}
        >
            {children}
        </Text>
    );
}

function ReadOnlyNote({ children }: { children: React.ReactNode }) {
    return (
        <View
            style={{
                backgroundColor: colors.brand.primary + '10',
                borderColor: colors.brand.primary + '30',
                borderWidth: 1,
                borderRadius: 10,
                padding: 12,
                marginTop: 4,
            }}
        >
            <Text style={{ fontSize: 12, color: colors.brand.primary }}>{children}</Text>
        </View>
    );
}

// ─── Type-specific fields ────────────────────────────────────────────────

function NumericUnitFields({
    test,
    onChange,
}: {
    test: NumericUnitTest;
    onChange: (next: NumericUnitTest) => void;
}) {
    return (
        <>
            <FieldLabel>Chave de métrica (sem espaços)</FieldLabel>
            <TextInput
                value={test.metric_key}
                onChangeText={t => onChange({ ...test, metric_key: t })}
                placeholder="ex.: weight_kg"
                placeholderTextColor={colors.text.quaternary}
                autoCapitalize="none"
                style={inputStyle}
            />

            <FieldLabel>Unidade</FieldLabel>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                {UNIT_OPTIONS.map(unit => {
                    const active = test.unit === unit;
                    return (
                        <TouchableOpacity
                            key={unit}
                            onPress={() => onChange({ ...test, unit })}
                            style={chipStyle(active)}
                        >
                            <Text style={chipLabelStyle(active)}>{unit}</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                    <FieldLabel>Mínimo</FieldLabel>
                    <TextInput
                        value={test.min == null ? '' : String(test.min)}
                        onChangeText={t => {
                            const n = t.length === 0 ? undefined : parseFloat(t);
                            onChange({ ...test, min: Number.isFinite(n) ? n : undefined });
                        }}
                        keyboardType="numeric"
                        placeholder="(opcional)"
                        placeholderTextColor={colors.text.quaternary}
                        style={inputStyle}
                    />
                </View>
                <View style={{ flex: 1 }}>
                    <FieldLabel>Máximo</FieldLabel>
                    <TextInput
                        value={test.max == null ? '' : String(test.max)}
                        onChangeText={t => {
                            const n = t.length === 0 ? undefined : parseFloat(t);
                            onChange({ ...test, max: Number.isFinite(n) ? n : undefined });
                        }}
                        keyboardType="numeric"
                        placeholder="(opcional)"
                        placeholderTextColor={colors.text.quaternary}
                        style={inputStyle}
                    />
                </View>
            </View>

            <RequiredToggle
                value={!!test.required}
                onChange={v => onChange({ ...test, required: v })}
            />
        </>
    );
}

function BilateralFields({
    test,
    onChange,
}: {
    test: BilateralNumericTest;
    onChange: (next: BilateralNumericTest) => void;
}) {
    return (
        <>
            <FieldLabel>Chave de métrica (sem espaços)</FieldLabel>
            <TextInput
                value={test.metric_key}
                onChangeText={t => onChange({ ...test, metric_key: t })}
                placeholder="ex.: arm_cm"
                placeholderTextColor={colors.text.quaternary}
                autoCapitalize="none"
                style={inputStyle}
            />

            <FieldLabel>Unidade</FieldLabel>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                {UNIT_OPTIONS.map(unit => {
                    const active = test.unit === unit;
                    return (
                        <TouchableOpacity
                            key={unit}
                            onPress={() => onChange({ ...test, unit })}
                            style={chipStyle(active)}
                        >
                            <Text style={chipLabelStyle(active)}>{unit}</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            <RequiredToggle
                value={!!test.required}
                onChange={v => onChange({ ...test, required: v })}
            />
        </>
    );
}

function MultiAttemptFields({
    test,
    onChange,
}: {
    test: MultiAttemptNumericTest;
    onChange: (next: MultiAttemptNumericTest) => void;
}) {
    return (
        <>
            <FieldLabel>Chave de métrica (sem espaços)</FieldLabel>
            <TextInput
                value={test.metric_key}
                onChangeText={t => onChange({ ...test, metric_key: t })}
                placeholder="ex.: vertical_jump_cm"
                placeholderTextColor={colors.text.quaternary}
                autoCapitalize="none"
                style={inputStyle}
            />

            <FieldLabel>Unidade</FieldLabel>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                {UNIT_OPTIONS.map(unit => {
                    const active = test.unit === unit;
                    return (
                        <TouchableOpacity
                            key={unit}
                            onPress={() => onChange({ ...test, unit })}
                            style={chipStyle(active)}
                        >
                            <Text style={chipLabelStyle(active)}>{unit}</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            <FieldLabel>Tentativas</FieldLabel>
            <TextInput
                value={String(test.attempts)}
                onChangeText={t => {
                    const n = parseInt(t, 10);
                    onChange({ ...test, attempts: Number.isFinite(n) && n > 0 ? n : 1 });
                }}
                keyboardType="numeric"
                style={inputStyle}
            />

            <FieldLabel>Estratégia de seleção</FieldLabel>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {STRATEGY_OPTIONS.map(opt => {
                    const active = test.selection_strategy === opt.id;
                    return (
                        <TouchableOpacity
                            key={opt.id}
                            onPress={() => onChange({ ...test, selection_strategy: opt.id })}
                            style={chipStyle(active)}
                        >
                            <Text style={chipLabelStyle(active)}>{opt.label}</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </>
    );
}

function RequiredToggle({
    value,
    onChange,
}: {
    value: boolean;
    onChange: (v: boolean) => void;
}) {
    return (
        <TouchableOpacity
            onPress={() => onChange(!value)}
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingVertical: 12,
                marginTop: 4,
            }}
        >
            <View
                style={{
                    width: 18,
                    height: 18,
                    borderRadius: 4,
                    borderWidth: 1.5,
                    borderColor: value ? colors.brand.primary : colors.border.secondary,
                    backgroundColor: value ? colors.brand.primary : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                {value && <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>✓</Text>}
            </View>
            <Text style={{ fontSize: 13, color: colors.text.primary }}>Campo obrigatório</Text>
        </TouchableOpacity>
    );
}

function chipStyle(active: boolean) {
    return {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: active ? colors.brand.primary : colors.border.secondary,
        backgroundColor: active ? colors.brand.primary + '15' : 'transparent',
    } as const;
}

function chipLabelStyle(active: boolean) {
    return {
        fontSize: 12,
        fontWeight: '600' as const,
        color: active ? colors.brand.primary : colors.text.secondary,
    };
}
