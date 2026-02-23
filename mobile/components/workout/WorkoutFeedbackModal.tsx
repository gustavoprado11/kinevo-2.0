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
    SafeAreaView,
} from 'react-native';
import { X, Check, Zap } from 'lucide-react-native';

interface WorkoutFeedbackModalProps {
    visible: boolean;
    onClose: () => void;
    onConfirm: (rpe: number, feedback: string) => void;
}

// Semantic color map for each RPE level
const RPE_CONFIG: Record<
    number,
    { bg: string; shadow: string; label: string; emoji: string }
> = {
    1: { bg: '#34d399', shadow: 'rgba(52, 211, 153, 0.35)', label: 'Muito Leve', emoji: '😴' },
    2: { bg: '#34d399', shadow: 'rgba(52, 211, 153, 0.35)', label: 'Muito Leve', emoji: '😴' },
    3: { bg: '#10b981', shadow: 'rgba(16, 185, 129, 0.35)', label: 'Leve', emoji: '🙂' },
    4: { bg: '#10b981', shadow: 'rgba(16, 185, 129, 0.35)', label: 'Leve', emoji: '🙂' },
    5: { bg: '#f59e0b', shadow: 'rgba(245, 158, 11, 0.35)', label: 'Moderado', emoji: '😐' },
    6: { bg: '#f59e0b', shadow: 'rgba(245, 158, 11, 0.35)', label: 'Moderado', emoji: '😐' },
    7: { bg: '#f97316', shadow: 'rgba(249, 115, 22, 0.35)', label: 'Intenso', emoji: '😤' },
    8: { bg: '#f97316', shadow: 'rgba(249, 115, 22, 0.35)', label: 'Intenso', emoji: '😤' },
    9: { bg: '#ef4444', shadow: 'rgba(239, 68, 68, 0.35)', label: 'Muito Intenso', emoji: '🥵' },
    10: { bg: '#dc2626', shadow: 'rgba(220, 38, 38, 0.4)', label: 'Exaustivo', emoji: '💀' },
};

export function WorkoutFeedbackModal({ visible, onClose, onConfirm }: WorkoutFeedbackModalProps) {
    const [rpe, setRpe] = useState<number | null>(null);
    const [feedback, setFeedback] = useState('');
    const [isFocused, setIsFocused] = useState(false);

    const handleConfirm = () => {
        if (rpe === null) return;
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
            {/* Backdrop */}
            <View style={styles.backdrop}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.kavContainer}
                >
                    {/* Sheet */}
                    <View style={styles.sheet}>
                        {/* Drag handle */}
                        <View style={styles.handle} />

                        {/* Header */}
                        <View style={styles.header}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.title}>Como foi o treino?</Text>
                                <Text style={styles.subtitle}>Avalie seu esforço e deixe observações.</Text>
                            </View>
                            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
                                <X size={18} color="#64748B" strokeWidth={2.5} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                            contentContainerStyle={{ paddingBottom: 12 }}
                        >
                            {/* ── RPE Card ── */}
                            <View style={styles.card}>
                                <View style={styles.rpeHeaderRow}>
                                    <Zap size={14} color="#7c3aed" strokeWidth={2.5} />
                                    <Text style={styles.cardLabel}>PERCEPÇÃO DE ESFORÇO (PSE)</Text>
                                </View>

                                {/* Number Grid */}
                                <View style={styles.rpeGrid}>
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => {
                                        const isSelected = rpe === value;
                                        const cfg = RPE_CONFIG[value];
                                        return (
                                            <TouchableOpacity
                                                key={value}
                                                onPress={() => setRpe(value)}
                                                activeOpacity={0.75}
                                                style={[
                                                    styles.rpeBtn,
                                                    isSelected
                                                        ? {
                                                            backgroundColor: cfg.bg,
                                                            borderColor: cfg.bg,
                                                            shadowColor: cfg.bg,
                                                            shadowOpacity: 0.4,
                                                            shadowOffset: { width: 0, height: 4 },
                                                            shadowRadius: 8,
                                                            elevation: 6,
                                                        }
                                                        : styles.rpeBtnInactive,
                                                ]}
                                            >
                                                <Text
                                                    style={[
                                                        styles.rpeBtnText,
                                                        { color: isSelected ? '#fff' : '#64748b' },
                                                    ]}
                                                >
                                                    {value}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>

                                {/* Semantic label */}
                                <View style={styles.rpeLabelRow}>
                                    {selectedConfig ? (
                                        <View style={styles.rpeLabelPill}>
                                            <Text style={styles.rpeLabelEmoji}>{selectedConfig.emoji}</Text>
                                            <Text style={[styles.rpeLabelText, { color: selectedConfig.bg }]}>
                                                {selectedConfig.label}
                                            </Text>
                                        </View>
                                    ) : (
                                        <Text style={styles.rpePlaceholder}>
                                            Selecione um número para avaliar seu esforço
                                        </Text>
                                    )}
                                </View>

                                {/* Scale extremes */}
                                <View style={styles.rpeExtremes}>
                                    <Text style={styles.rpeExtreme}>😴 Muito Leve</Text>
                                    <Text style={styles.rpeExtreme}>💀 Exaustivo</Text>
                                </View>
                            </View>

                            {/* ── Notes Card ── */}
                            <View style={styles.card}>
                                <Text style={styles.notesLabel}>Observações</Text>
                                <Text style={styles.notesSubLabel}>Opcional — descreva como se sentiu</Text>
                                <TextInput
                                    style={[
                                        styles.textarea,
                                        isFocused && styles.textareaFocused,
                                    ]}
                                    placeholder="Senti dor no joelho? Carga estava leve? Escreva aqui..."
                                    placeholderTextColor="#94a3b8"
                                    multiline
                                    textAlignVertical="top"
                                    value={feedback}
                                    onChangeText={setFeedback}
                                    onFocus={() => setIsFocused(true)}
                                    onBlur={() => setIsFocused(false)}
                                />
                            </View>
                        </ScrollView>

                        {/* ── Fixed Submit Button ── */}
                        <SafeAreaView edges={['bottom']} style={styles.footerSafe}>
                            <TouchableOpacity
                                onPress={handleConfirm}
                                disabled={rpe === null}
                                activeOpacity={0.85}
                                style={[
                                    styles.submitBtn,
                                    rpe === null && styles.submitBtnDisabled,
                                    rpe !== null && {
                                        shadowColor: '#7c3aed',
                                        shadowOffset: { width: 0, height: 8 },
                                        shadowOpacity: 0.35,
                                        shadowRadius: 16,
                                        elevation: 8,
                                    },
                                ]}
                            >
                                <Check size={20} color={rpe !== null ? '#fff' : '#94A3B8'} strokeWidth={2.5} />
                                <Text style={[styles.submitText, { color: rpe !== null ? '#fff' : '#94a3b8' }]}>
                                    Salvar e Finalizar
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
        backgroundColor: 'rgba(15, 23, 42, 0.5)',
        justifyContent: 'flex-end',
    },
    kavContainer: {
        width: '100%',
    },
    sheet: {
        backgroundColor: '#F2F2F7',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        paddingTop: 12,
        paddingHorizontal: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -6 },
        shadowOpacity: 0.12,
        shadowRadius: 20,
        elevation: 14,
        maxHeight: '90%',
    },
    handle: {
        width: 40,
        height: 4,
        backgroundColor: '#d1d5db',
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 20,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 20,
        paddingHorizontal: 4,
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: '#0f172a',
        letterSpacing: -0.3,
    },
    subtitle: {
        fontSize: 14,
        color: '#64748b',
        marginTop: 4,
    },
    closeBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#e2e8f0',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 4,
    },
    card: {
        backgroundColor: '#ffffff',
        borderRadius: 24,
        padding: 20,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 2,
    },
    rpeHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 16,
    },
    cardLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#94a3b8',
        letterSpacing: 1.5,
        textTransform: 'uppercase',
    },
    rpeGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 12,
    },
    rpeBtn: {
        width: '17%',
        aspectRatio: 1,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
    },
    rpeBtnInactive: {
        backgroundColor: '#f8fafc',
        borderColor: '#e2e8f0',
    },
    rpeBtnText: {
        fontSize: 17,
        fontWeight: '700',
    },
    rpeLabelRow: {
        alignItems: 'center',
        marginBottom: 12,
        minHeight: 36,
        justifyContent: 'center',
    },
    rpeLabelPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#f8fafc',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    rpeLabelEmoji: {
        fontSize: 18,
    },
    rpeLabelText: {
        fontSize: 15,
        fontWeight: '700',
    },
    rpePlaceholder: {
        fontSize: 13,
        color: '#94a3b8',
        textAlign: 'center',
    },
    rpeExtremes: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    rpeExtreme: {
        fontSize: 11,
        fontWeight: '600',
        color: '#94a3b8',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    notesLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#0f172a',
        marginBottom: 2,
    },
    notesSubLabel: {
        fontSize: 13,
        color: '#94a3b8',
        marginBottom: 12,
    },
    textarea: {
        backgroundColor: '#f8fafc',
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        borderRadius: 16,
        padding: 14,
        minHeight: 100,
        fontSize: 15,
        color: '#0f172a',
        lineHeight: 22,
    },
    textareaFocused: {
        borderColor: '#7c3aed',
        backgroundColor: '#faf5ff',
    },
    footerSafe: {
        paddingTop: 12,
        paddingBottom: 8,
    },
    submitBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        backgroundColor: '#7c3aed',
        borderRadius: 18,
        paddingVertical: 18,
        marginHorizontal: 4,
        marginBottom: 4,
    },
    submitBtnDisabled: {
        backgroundColor: '#e2e8f0',
        shadowOpacity: 0,
        elevation: 0,
    },
    submitText: {
        fontSize: 17,
        fontWeight: '700',
        letterSpacing: -0.2,
    },
});
