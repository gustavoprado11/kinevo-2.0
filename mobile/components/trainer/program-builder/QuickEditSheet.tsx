import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Pressable, Keyboard } from 'react-native';
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet';
import { Minus, Plus } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useV2Colors } from '@/hooks/useV2Colors';

export interface QuickEditValues {
    sets: number;
    reps: string;
    rest_seconds: number;
}

interface QuickEditSheetProps {
    visible: boolean;
    exerciseName: string;
    initial: QuickEditValues;
    onClose: () => void;
    onSave: (next: QuickEditValues) => void;
    /** Abre a edição avançada (set scheme com fases/métodos). */
    onOpenAdvanced?: () => void;
}

/**
 * Bottom sheet de edição rápida do exercício: séries, reps e descanso.
 * Pra ajustes finos sem entrar no editor avançado (fases/métodos).
 *
 * Reps aceita texto livre ("8", "8-12", "AMRAP") porque o resto do app já
 * trata reps como string. Sets e rest são inteiros com steppers.
 */
export function QuickEditSheet({
    visible,
    exerciseName,
    initial,
    onClose,
    onSave,
    onOpenAdvanced,
}: QuickEditSheetProps) {
    const colors = useV2Colors();
    const sheetRef = useRef<BottomSheet>(null);
    const snapPoints = useMemo(() => ['55%'], []);

    const [sets, setSets] = useState(initial.sets);
    const [reps, setReps] = useState(initial.reps);
    const [rest, setRest] = useState(initial.rest_seconds);

    useEffect(() => {
        if (visible) {
            setSets(initial.sets);
            setReps(initial.reps);
            setRest(initial.rest_seconds);
            sheetRef.current?.snapToIndex(0);
        } else {
            sheetRef.current?.close();
        }
    }, [visible, initial.sets, initial.reps, initial.rest_seconds]);

    const handleSave = useCallback(() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
        onSave({
            sets: Math.max(1, Math.min(99, Math.round(sets))),
            reps: reps.trim() || '0',
            rest_seconds: Math.max(0, Math.min(600, Math.round(rest))),
        });
        onClose();
    }, [sets, reps, rest, onSave, onClose]);

    const renderBackdrop = useCallback(
        (props: any) => (
            <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" />
        ),
        [],
    );

    if (!visible) return null;

    return (
        <BottomSheet
            ref={sheetRef}
            index={0}
            snapPoints={snapPoints}
            onClose={onClose}
            enablePanDownToClose
            backdropComponent={renderBackdrop}
            backgroundStyle={{ backgroundColor: colors.surface.card }}
            handleIndicatorStyle={{ backgroundColor: colors.text.quaternary }}
            keyboardBehavior="interactive"
            keyboardBlurBehavior="restore"
        >
            <BottomSheetView style={{ flex: 1, paddingHorizontal: 20, paddingTop: 8 }}>
                {/* Header */}
                <View style={{ paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border.subtle }}>
                    <Text
                        style={{
                            fontSize: 11,
                            fontWeight: '700',
                            letterSpacing: 1.1,
                            textTransform: 'uppercase',
                            color: colors.text.tertiary,
                        }}
                    >
                        Edição rápida
                    </Text>
                    <Text
                        style={{
                            fontSize: 18,
                            fontWeight: '800',
                            color: colors.text.primary,
                            marginTop: 2,
                        }}
                        numberOfLines={1}
                    >
                        {exerciseName}
                    </Text>
                </View>

                {/* Sets stepper */}
                <FieldRow label="Séries">
                    <Stepper
                        value={sets}
                        onChange={setSets}
                        min={1}
                        max={99}
                        format={(v) => String(v)}
                    />
                </FieldRow>

                {/* Reps free-text */}
                <FieldRow label="Reps">
                    <TextInput
                        value={reps}
                        onChangeText={setReps}
                        placeholder="8 ou 8-12"
                        placeholderTextColor={colors.text.quaternary}
                        style={{
                            flex: 1,
                            textAlign: 'right',
                            fontSize: 22,
                            fontWeight: '800',
                            letterSpacing: -0.5,
                            color: colors.purple[500],
                            paddingVertical: 4,
                        }}
                        keyboardType="default"
                        returnKeyType="done"
                        onSubmitEditing={Keyboard.dismiss}
                        maxLength={12}
                    />
                </FieldRow>

                {/* Rest stepper (in seconds, ±15s) */}
                <FieldRow label="Descanso">
                    <Stepper
                        value={rest}
                        onChange={setRest}
                        min={0}
                        max={600}
                        step={15}
                        format={(v) => `${v}s`}
                    />
                </FieldRow>

                {/* Actions */}
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
                    {onOpenAdvanced && (
                        <TouchableOpacity
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
                                onClose();
                                // Pequeno delay pro sheet fechar antes do próximo abrir
                                setTimeout(() => onOpenAdvanced(), 200);
                            }}
                            style={{
                                flex: 1,
                                paddingVertical: 14,
                                borderRadius: 12,
                                borderWidth: 1,
                                borderColor: colors.border.default,
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                            accessibilityRole="button"
                            accessibilityLabel="Abrir edição avançada"
                        >
                            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text.secondary }}>
                                Edição avançada
                            </Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity
                        onPress={handleSave}
                        style={{
                            flex: 1,
                            paddingVertical: 14,
                            borderRadius: 12,
                            backgroundColor: colors.purple[600],
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                        accessibilityRole="button"
                        accessibilityLabel="Salvar alterações"
                    >
                        <Text style={{ fontSize: 14, fontWeight: '800', color: '#FFFFFF' }}>
                            Salvar
                        </Text>
                    </TouchableOpacity>
                </View>
            </BottomSheetView>
        </BottomSheet>
    );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
    const colors = useV2Colors();
    return (
        <View
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 14,
                borderBottomWidth: 1,
                borderBottomColor: colors.border.subtle,
            }}
        >
            <Text
                style={{
                    fontSize: 11,
                    fontWeight: '700',
                    letterSpacing: 1.1,
                    textTransform: 'uppercase',
                    color: colors.text.tertiary,
                    width: 110,
                }}
            >
                {label}
            </Text>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }}>
                {children}
            </View>
        </View>
    );
}

function Stepper({
    value,
    onChange,
    min,
    max,
    step = 1,
    format,
}: {
    value: number;
    onChange: (v: number) => void;
    min: number;
    max: number;
    step?: number;
    format: (v: number) => string;
}) {
    const colors = useV2Colors();
    const dec = () => {
        Haptics.selectionAsync().catch(() => { });
        onChange(Math.max(min, value - step));
    };
    const inc = () => {
        Haptics.selectionAsync().catch(() => { });
        onChange(Math.min(max, value + step));
    };
    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Pressable
                onPress={dec}
                disabled={value <= min}
                style={({ pressed }) => ({
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: pressed ? colors.surface.canvas : colors.surface.card2,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: value <= min ? 0.4 : 1,
                })}
                accessibilityRole="button"
                accessibilityLabel="Diminuir"
            >
                <Minus size={16} color={colors.text.secondary} />
            </Pressable>
            <Text
                style={{
                    fontSize: 22,
                    fontWeight: '800',
                    letterSpacing: -0.5,
                    color: colors.purple[500],
                    minWidth: 56,
                    textAlign: 'center',
                }}
            >
                {format(value)}
            </Text>
            <Pressable
                onPress={inc}
                disabled={value >= max}
                style={({ pressed }) => ({
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: pressed ? colors.surface.canvas : colors.surface.card2,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: value >= max ? 0.4 : 1,
                })}
                accessibilityRole="button"
                accessibilityLabel="Aumentar"
            >
                <Plus size={16} color={colors.text.secondary} />
            </Pressable>
        </View>
    );
}
