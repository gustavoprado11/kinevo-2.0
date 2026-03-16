import React, { useState } from 'react';
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Clock, Dumbbell, Target, TrendingUp } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

interface WorkoutSummaryData {
    duration: string;
    exerciseCount: number;
    completedSets: number;
    totalSets: number;
    totalVolume: number;
}

interface WorkoutFeedbackModalProps {
    visible: boolean;
    onClose: () => void;
    onConfirm: (rpe: number, feedback: string) => void;
    summary?: WorkoutSummaryData;
}

const RPE_CONFIG: Record<number, { color: string; label: string }> = {
    1: { color: '#34c759', label: 'Muito leve' },
    2: { color: '#34c759', label: 'Muito leve' },
    3: { color: '#34c759', label: 'Leve' },
    4: { color: '#34c759', label: 'Leve' },
    5: { color: '#ff9f0a', label: 'Moderado' },
    6: { color: '#ff9f0a', label: 'Moderado' },
    7: { color: '#ff6b35', label: 'Intenso' },
    8: { color: '#ff6b35', label: 'Intenso' },
    9: { color: '#ff3b30', label: 'Máximo' },
    10: { color: '#ff3b30', label: 'Máximo' },
};

function formatVolume(kg: number): string {
    if (kg >= 1000) {
        return `${(kg / 1000).toFixed(1).replace('.0', '')} t`;
    }
    return `${Math.round(kg)} kg`;
}

function SummaryItem({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
    return (
        <View style={styles.summaryItem}>
            {icon}
            <Text style={styles.summaryValue}>{value}</Text>
            <Text style={styles.summaryLabel}>{label}</Text>
        </View>
    );
}

export function WorkoutFeedbackModal({ visible, onClose, onConfirm, summary }: WorkoutFeedbackModalProps) {
    const [rpe, setRpe] = useState<number | null>(null);
    const [feedback, setFeedback] = useState('');
    const [isFocused, setIsFocused] = useState(false);

    const handleConfirm = () => {
        if (rpe === null) return;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onConfirm(rpe, feedback);
        setRpe(null);
        setFeedback('');
    };

    const selectedConfig = rpe ? RPE_CONFIG[rpe] : null;

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.backdrop}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.kavContainer}
                >
                    <View style={styles.sheet}>
                        {/* Drag handle */}
                        <View style={styles.handle} />

                        {/* Header */}
                        <View style={styles.header}>
                            <Text style={styles.title}>Como foi o treino?</Text>
                            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={12} activeOpacity={0.7}>
                                <X size={18} color="#aeaeb2" strokeWidth={2.5} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                            contentContainerStyle={{ paddingBottom: 12 }}
                        >
                            {/* Workout Summary */}
                            {summary && (
                                <View style={styles.summaryGrid}>
                                    <SummaryItem
                                        icon={<Clock size={15} color="#7c3aed" strokeWidth={2} />}
                                        value={summary.duration}
                                        label="Duração"
                                    />
                                    <SummaryItem
                                        icon={<Dumbbell size={15} color="#7c3aed" strokeWidth={2} />}
                                        value={String(summary.exerciseCount)}
                                        label="Exercícios"
                                    />
                                    <SummaryItem
                                        icon={<Target size={15} color="#7c3aed" strokeWidth={2} />}
                                        value={`${summary.completedSets}/${summary.totalSets}`}
                                        label="Séries"
                                    />
                                    <SummaryItem
                                        icon={<TrendingUp size={15} color="#7c3aed" strokeWidth={2} />}
                                        value={formatVolume(summary.totalVolume)}
                                        label="Volume"
                                    />
                                </View>
                            )}

                            {/* Intensity Section */}
                            <View style={styles.intensitySection}>
                                <Text style={styles.intensityTitle}>Intensidade</Text>

                                {/* Selected value display */}
                                <View style={styles.intensityValueRow}>
                                    {selectedConfig ? (
                                        <>
                                            <Text style={[styles.intensityValue, { color: selectedConfig.color }]}>
                                                {rpe}
                                            </Text>
                                            <Text style={styles.intensityOf}>/10</Text>
                                            <View style={[styles.intensityBadge, { backgroundColor: selectedConfig.color + '18' }]}>
                                                <Text style={[styles.intensityBadgeText, { color: selectedConfig.color }]}>
                                                    {selectedConfig.label}
                                                </Text>
                                            </View>
                                        </>
                                    ) : (
                                        <Text style={styles.intensityPlaceholder}>
                                            Toque para avaliar seu esforço
                                        </Text>
                                    )}
                                </View>

                                {/* Single row of 1-10 buttons */}
                                <View style={styles.buttonsRow}>
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => {
                                        const isSelected = rpe === value;
                                        const cfg = RPE_CONFIG[value];
                                        return (
                                            <TouchableOpacity
                                                key={value}
                                                onPress={() => {
                                                    setRpe(value);
                                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                                }}
                                                activeOpacity={0.75}
                                                style={[
                                                    styles.rpeBtn,
                                                    isSelected && {
                                                        backgroundColor: cfg.color,
                                                        shadowColor: cfg.color,
                                                        shadowOpacity: 0.4,
                                                        shadowOffset: { width: 0, height: 3 },
                                                        shadowRadius: 6,
                                                        elevation: 4,
                                                    },
                                                ]}
                                            >
                                                <Text
                                                    style={[
                                                        styles.rpeBtnText,
                                                        isSelected && { color: '#fff', fontWeight: '700' },
                                                    ]}
                                                >
                                                    {value}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>

                                {/* Anchors */}
                                <View style={styles.anchorsRow}>
                                    <Text style={styles.anchorText}>Leve</Text>
                                    <Text style={styles.anchorText}>Máximo</Text>
                                </View>
                            </View>

                            {/* Observations */}
                            <View style={styles.observationsSection}>
                                <Text style={styles.observationsTitle}>
                                    Observações{' '}
                                    <Text style={styles.optional}>(opcional)</Text>
                                </Text>
                                <TextInput
                                    style={[
                                        styles.textarea,
                                        isFocused && styles.textareaFocused,
                                    ]}
                                    placeholder="Como você se sentiu?"
                                    placeholderTextColor="#c7c7cc"
                                    multiline
                                    textAlignVertical="top"
                                    maxLength={500}
                                    value={feedback}
                                    onChangeText={setFeedback}
                                    onFocus={() => setIsFocused(true)}
                                    onBlur={() => setIsFocused(false)}
                                />
                            </View>
                        </ScrollView>

                        {/* Submit Button */}
                        <SafeAreaView edges={['bottom']} style={styles.footerSafe}>
                            <TouchableOpacity
                                onPress={handleConfirm}
                                disabled={rpe === null}
                                activeOpacity={0.8}
                                style={[
                                    styles.submitBtn,
                                    rpe === null && styles.submitBtnDisabled,
                                ]}
                            >
                                <Text style={[
                                    styles.submitText,
                                    rpe === null && styles.submitTextDisabled,
                                ]}>
                                    Finalizar Treino
                                </Text>
                            </TouchableOpacity>
                        </SafeAreaView>
                    </View>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        justifyContent: 'flex-end',
    },
    kavContainer: {
        width: '100%',
    },
    sheet: {
        backgroundColor: '#F2F2F7',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingTop: 12,
        paddingHorizontal: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
        elevation: 14,
        maxHeight: '90%',
    },
    handle: {
        width: 36,
        height: 5,
        backgroundColor: '#d1d1d6',
        borderRadius: 2.5,
        alignSelf: 'center',
        marginBottom: 18,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
        paddingHorizontal: 4,
    },
    title: {
        fontSize: 22,
        fontWeight: '700',
        color: '#1c1c1e',
        letterSpacing: -0.3,
    },
    closeBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#e5e5ea',
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Summary
    summaryGrid: {
        flexDirection: 'row',
        backgroundColor: '#ffffff',
        borderRadius: 14,
        padding: 14,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
        elevation: 1,
    },
    summaryItem: {
        flex: 1,
        alignItems: 'center',
        gap: 4,
    },
    summaryValue: {
        fontSize: 17,
        fontWeight: '700',
        color: '#1c1c1e',
        fontVariant: ['tabular-nums'],
    },
    summaryLabel: {
        fontSize: 11,
        color: '#8e8e93',
        fontWeight: '500',
    },

    // Intensity
    intensitySection: {
        marginBottom: 20,
        paddingHorizontal: 4,
    },
    intensityTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1c1c1e',
        marginBottom: 10,
    },
    intensityValueRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 4,
        marginBottom: 14,
        minHeight: 40,
    },
    intensityValue: {
        fontSize: 34,
        fontWeight: '700',
        fontVariant: ['tabular-nums'],
    },
    intensityOf: {
        fontSize: 17,
        color: '#8e8e93',
        fontWeight: '500',
    },
    intensityBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        marginLeft: 8,
    },
    intensityBadgeText: {
        fontSize: 13,
        fontWeight: '600',
    },
    intensityPlaceholder: {
        fontSize: 14,
        color: '#aeaeb2',
    },
    buttonsRow: {
        flexDirection: 'row',
        gap: 6,
        marginBottom: 8,
    },
    rpeBtn: {
        flex: 1,
        aspectRatio: 1,
        borderRadius: 10,
        backgroundColor: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
        maxHeight: 38,
    },
    rpeBtnText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#3a3a3c',
        fontVariant: ['tabular-nums'],
    },
    anchorsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 2,
    },
    anchorText: {
        fontSize: 11,
        color: '#aeaeb2',
        fontWeight: '500',
    },

    // Observations
    observationsSection: {
        marginBottom: 8,
        paddingHorizontal: 4,
    },
    observationsTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1c1c1e',
        marginBottom: 8,
    },
    optional: {
        fontWeight: '400',
        color: '#aeaeb2',
    },
    textarea: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        padding: 14,
        minHeight: 80,
        maxHeight: 120,
        fontSize: 15,
        color: '#1c1c1e',
        lineHeight: 22,
    },
    textareaFocused: {
        shadowColor: '#7c3aed',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 2,
    },

    // Footer
    footerSafe: {
        paddingTop: 12,
        paddingBottom: 8,
    },
    submitBtn: {
        height: 52,
        borderRadius: 14,
        backgroundColor: '#7c3aed',
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 4,
        marginBottom: 4,
    },
    submitBtnDisabled: {
        backgroundColor: '#e5e5ea',
    },
    submitText: {
        fontSize: 17,
        fontWeight: '600',
        color: '#fff',
    },
    submitTextDisabled: {
        color: '#aeaeb2',
    },
});
