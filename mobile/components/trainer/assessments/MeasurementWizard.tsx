import React, { useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Modal,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, Check, AlertCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { colors } from '@/theme';

export interface RangePromptState {
    visible: boolean;
    label: string;
    value: number;
    unit: string;
    reason: 'below' | 'above';
    /** Called when the trainer confirms the out-of-range value. */
    onConfirm: () => void;
    /** Called when the trainer cancels and wants to re-enter. */
    onCancel: () => void;
}

export interface MeasurementWizardProps {
    title: string;
    subtitle?: string;
    /** Current step index, 0-based. */
    stepIndex: number;
    /** Total steps. */
    totalSteps: number;
    /** Whether the "next" CTA is enabled. */
    canAdvance: boolean;
    onPrev?: () => void;
    onNext: () => void;
    /** Whether this is the last step (changes "Próximo" to "Concluir"). */
    isLast?: boolean;
    /** Optional range prompt — when visible=true, renders a confirm modal. */
    rangePrompt?: RangePromptState;
    children: React.ReactNode;
}

/**
 * Container chrome for the wizard: header with title, sub-progress bar,
 * keyboard-avoiding scroll, footer CTAs, and a one-tap range-warning modal.
 *
 * Body content (the actual input component) is provided as children — this
 * component is structural only.
 */
export function MeasurementWizard(props: MeasurementWizardProps) {
    const insets = useSafeAreaInsets();
    const {
        title,
        subtitle,
        stepIndex,
        totalSteps,
        canAdvance,
        onPrev,
        onNext,
        isLast,
        rangePrompt,
        children,
    } = props;

    const progress = totalSteps > 0 ? Math.min(1, (stepIndex + 1) / totalSteps) : 0;

    const handleNext = useCallback(() => {
        if (!canAdvance) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onNext();
    }, [canAdvance, onNext]);

    const handlePrev = useCallback(() => {
        Haptics.selectionAsync();
        onPrev?.();
    }, [onPrev]);

    return (
        <View style={{ flex: 1, backgroundColor: colors.background.primary }}>
            {/* Header */}
            <View
                style={{
                    paddingTop: insets.top + 8,
                    paddingHorizontal: 16,
                    paddingBottom: 12,
                    backgroundColor: colors.background.card,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border.primary,
                }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    {onPrev && (
                        <TouchableOpacity
                            onPress={handlePrev}
                            accessibilityRole="button"
                            accessibilityLabel="Voltar"
                            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                            style={{ padding: 6 }}>
                            <ChevronLeft size={24} color={colors.text.primary} />
                        </TouchableOpacity>
                    )}
                    <View style={{ flex: 1 }}>
                        <Text
                            numberOfLines={1}
                            style={{ fontSize: 16, fontWeight: '700', color: colors.text.primary }}>
                            {title}
                        </Text>
                        {subtitle && (
                            <Text
                                numberOfLines={1}
                                style={{ fontSize: 12, color: colors.text.tertiary, marginTop: 2 }}>
                                {subtitle}
                            </Text>
                        )}
                    </View>
                    <Text
                        style={{
                            fontSize: 12,
                            fontWeight: '700',
                            color: colors.status.presencial,
                        }}>
                        {stepIndex + 1}/{totalSteps}
                    </Text>
                </View>

                {/* Progress bar */}
                <View
                    style={{
                        marginTop: 10,
                        height: 4,
                        borderRadius: 2,
                        backgroundColor: colors.background.inset,
                        overflow: 'hidden',
                    }}>
                    <View
                        style={{
                            width: `${progress * 100}%`,
                            height: 4,
                            backgroundColor: colors.status.presencial,
                            borderRadius: 2,
                        }}
                    />
                </View>
            </View>

            {/* Body */}
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
                <ScrollView
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 16 }}>
                    {children}
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Footer */}
            <View
                style={{
                    paddingHorizontal: 16,
                    paddingTop: 12,
                    paddingBottom: insets.bottom + 12,
                    backgroundColor: colors.background.card,
                    borderTopWidth: 1,
                    borderTopColor: colors.border.primary,
                }}>
                <TouchableOpacity
                    onPress={handleNext}
                    disabled={!canAdvance}
                    accessibilityRole="button"
                    accessibilityLabel={isLast ? 'Concluir' : 'Próximo'}
                    accessibilityState={{ disabled: !canAdvance }}
                    style={{
                        backgroundColor: canAdvance ? colors.brand.primary : colors.background.inset,
                        borderRadius: 14,
                        paddingVertical: 16,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                    }}>
                    {isLast ? (
                        <Check size={20} color={canAdvance ? colors.text.inverse : colors.text.tertiary} />
                    ) : null}
                    <Text
                        style={{
                            fontSize: 16,
                            fontWeight: '800',
                            color: canAdvance ? colors.text.inverse : colors.text.tertiary,
                        }}>
                        {isLast ? 'Concluir' : 'Próximo'}
                    </Text>
                    {!isLast ? (
                        <ChevronRight
                            size={20}
                            color={canAdvance ? colors.text.inverse : colors.text.tertiary}
                        />
                    ) : null}
                </TouchableOpacity>
            </View>

            {/* Range warning modal */}
            {rangePrompt?.visible && (
                <Modal transparent animationType="fade" onRequestClose={rangePrompt.onCancel}>
                    <View
                        style={{
                            flex: 1,
                            backgroundColor: 'rgba(0,0,0,0.45)',
                            justifyContent: 'center',
                            paddingHorizontal: 24,
                        }}>
                        <View
                            style={{
                                backgroundColor: colors.background.card,
                                borderRadius: 18,
                                padding: 22,
                                gap: 14,
                            }}>
                            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                                <AlertCircle size={22} color={colors.warning.default} />
                                <Text
                                    style={{
                                        fontSize: 17,
                                        fontWeight: '800',
                                        color: colors.text.primary,
                                    }}>
                                    Confirmar valor?
                                </Text>
                            </View>
                            <Text style={{ fontSize: 14, color: colors.text.secondary, lineHeight: 20 }}>
                                Você inseriu{' '}
                                <Text style={{ fontWeight: '700', color: colors.text.primary }}>
                                    {rangePrompt.value} {rangePrompt.unit}
                                </Text>{' '}
                                em {rangePrompt.label}.{' '}
                                {rangePrompt.reason === 'below'
                                    ? 'Esse valor parece muito baixo. Quer mesmo continuar?'
                                    : 'Esse valor parece muito alto. Quer mesmo continuar?'}
                            </Text>
                            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                                <TouchableOpacity
                                    onPress={rangePrompt.onCancel}
                                    accessibilityRole="button"
                                    style={{
                                        flex: 1,
                                        backgroundColor: colors.background.inset,
                                        borderRadius: 12,
                                        paddingVertical: 13,
                                        alignItems: 'center',
                                    }}>
                                    <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text.primary }}>
                                        Reescrever
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={rangePrompt.onConfirm}
                                    accessibilityRole="button"
                                    style={{
                                        flex: 1,
                                        backgroundColor: colors.warning.default,
                                        borderRadius: 12,
                                        paddingVertical: 13,
                                        alignItems: 'center',
                                    }}>
                                    <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text.inverse }}>
                                        Confirmar
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            )}
        </View>
    );
}
