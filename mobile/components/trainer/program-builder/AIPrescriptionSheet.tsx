import React, { useCallback, useState } from "react";
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Sparkles, X, AlertTriangle, RotateCcw, Check, ChevronRight } from "lucide-react-native";
import { supabase } from "../../../lib/supabase";
import { colors } from "@/theme";
import { PrescriptionProfileForm } from "../prescription/PrescriptionProfileForm";
import { usePrescriptionData } from "../../../hooks/usePrescriptionData";
import { useAIPrescriptionAgent, type AgentResult } from "../../../hooks/useAIPrescriptionAgent";
import { AgentQuestionsStep } from "./AgentQuestionsStep";

interface Props {
    visible: boolean;
    studentId: string;
    studentName: string;
    onClose: () => void;
    onSuccess: (result: AgentResult) => void;
}

export function AIPrescriptionSheet({ visible, studentId, studentName, onClose, onSuccess }: Props) {
    const insets = useSafeAreaInsets();
    const { profile } = usePrescriptionData(studentId);
    const [isSavingProfile, setIsSavingProfile] = useState(false);
    const [profileError, setProfileError] = useState<string | null>(null);

    const {
        pageState,
        questions,
        answers,
        error,
        result,
        setAnswer,
        startAnalysis,
        submitAnswersAndGenerate,
        skipQuestionsAndGenerate,
        reset,
    } = useAIPrescriptionAgent(studentId, { onSuccess });

    const handleClose = useCallback(() => {
        // Hard reset so a re-open starts at anamnese; Sheet is unmounted-style.
        reset();
        setProfileError(null);
        onClose();
    }, [onClose, reset]);

    const handleSubmitProfile = useCallback(
        async (data: {
            training_level: string;
            goal: string;
            available_days: number[];
            session_duration_minutes: number;
            available_equipment: string[];
            medical_restrictions: { description: string; severity?: string }[];
            ai_mode: string;
        }) => {
            setIsSavingProfile(true);
            setProfileError(null);
            try {
                const { error: upsertError } = await supabase.rpc("upsert_prescription_profile" as any, {
                    p_student_id: studentId,
                    p_training_level: data.training_level,
                    p_goal: data.goal,
                    p_available_days: data.available_days,
                    p_session_duration_minutes: data.session_duration_minutes,
                    p_available_equipment: data.available_equipment,
                    p_medical_restrictions: JSON.stringify(data.medical_restrictions),
                    p_ai_mode: data.ai_mode,
                });
                if (upsertError) throw new Error(upsertError.message);

                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                await startAnalysis();
            } catch (err) {
                const message = err instanceof Error ? err.message : "Erro ao salvar anamnese.";
                setProfileError(message);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
            } finally {
                setIsSavingProfile(false);
            }
        },
        [studentId, startAnalysis],
    );

    const handleConfirmGeneration = useCallback(() => {
        if (!result) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        onSuccess(result);
        handleClose();
    }, [result, onSuccess, handleClose]);

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={handleClose}
        >
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
                <View
                    style={{
                        flex: 1,
                        backgroundColor: colors.background.primary,
                        paddingTop: insets.top || 12,
                    }}
                >
                    {/* Header */}
                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            paddingHorizontal: 16,
                            paddingVertical: 12,
                            backgroundColor: colors.background.card,
                            borderBottomWidth: 0.5,
                            borderBottomColor: colors.border.primary,
                        }}
                    >
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            <Sparkles size={18} color={colors.brand.primary} />
                            <Text style={{ fontSize: 17, fontWeight: "700", color: colors.text.primary }}>
                                Prescrição IA
                            </Text>
                        </View>
                        <TouchableOpacity
                            onPress={handleClose}
                            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                            accessibilityRole="button"
                            accessibilityLabel="Fechar"
                            style={{
                                width: 30,
                                height: 30,
                                borderRadius: 15,
                                backgroundColor: colors.background.primary,
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <X size={16} color={colors.text.secondary} />
                        </TouchableOpacity>
                    </View>

                    {/* Student badge */}
                    <View style={{ paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.background.card }}>
                        <Text style={{ fontSize: 13, color: colors.text.secondary }}>
                            Prescrevendo para{" "}
                            <Text style={{ fontWeight: "600", color: colors.text.primary }}>{studentName}</Text>
                        </Text>
                    </View>

                    {/* Body */}
                    {pageState === "anamnese" && (
                        <View style={{ flex: 1 }}>
                            {profileError && (
                                <View
                                    style={{
                                        marginHorizontal: 16,
                                        marginTop: 12,
                                        padding: 12,
                                        borderRadius: 10,
                                        backgroundColor: colors.error.light,
                                    }}
                                >
                                    <Text style={{ color: colors.error.default, fontSize: 13 }}>
                                        {profileError}
                                    </Text>
                                </View>
                            )}
                            <PrescriptionProfileForm
                                existingProfile={profile}
                                isSaving={isSavingProfile}
                                onSubmit={handleSubmitProfile}
                            />
                        </View>
                    )}

                    {pageState === "analyzing" && <CenteredSpinner label="Analisando contexto…" hint="Lendo o perfil e o histórico do aluno" />}

                    {pageState === "questions" && (
                        <AgentQuestionsStep
                            questions={questions}
                            answers={answers}
                            onAnswer={setAnswer}
                            onSubmit={submitAnswersAndGenerate}
                            onSkip={skipQuestionsAndGenerate}
                            isLoading={false}
                        />
                    )}

                    {pageState === "generating" && <CenteredSpinner label="Gerando programa…" hint="Pode levar até 1 minuto" />}

                    {pageState === "done" && result && (
                        <DoneStep
                            result={result}
                            onConfirm={handleConfirmGeneration}
                            onDiscard={handleClose}
                            insetsBottom={insets.bottom}
                        />
                    )}

                    {pageState === "error" && (
                        <ErrorStep
                            message={error || "Erro inesperado."}
                            onRetry={() => {
                                reset();
                            }}
                            onClose={handleClose}
                        />
                    )}
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

// ============================================================================
// Sub-components
// ============================================================================

function CenteredSpinner({ label, hint }: { label: string; hint?: string }) {
    return (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
            <ActivityIndicator size="large" color={colors.brand.primary} />
            <Text style={{ fontSize: 15, fontWeight: "600", color: colors.text.primary, marginTop: 18 }}>
                {label}
            </Text>
            {hint && (
                <Text style={{ fontSize: 13, color: colors.text.secondary, marginTop: 6 }}>{hint}</Text>
            )}
        </View>
    );
}

function DoneStep({
    result,
    onConfirm,
    onDiscard,
    insetsBottom,
}: {
    result: AgentResult;
    onConfirm: () => void;
    onDiscard: () => void;
    insetsBottom: number;
}) {
    const program = result.outputSnapshot.program;
    const workouts = result.outputSnapshot.workouts;
    const totalExercises = workouts.reduce((acc, w) => acc + w.items.length, 0);
    return (
        <View style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
                <View
                    style={{
                        backgroundColor: colors.success.light,
                        borderRadius: 14,
                        padding: 16,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                        marginBottom: 16,
                    }}
                >
                    <Check size={18} color={colors.success.default} />
                    <Text style={{ fontSize: 14, color: colors.success.default, fontWeight: "600", flex: 1 }}>
                        Programa gerado com sucesso
                    </Text>
                </View>

                <Text style={{ fontSize: 11, color: colors.text.tertiary, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 6 }}>
                    Programa
                </Text>
                <Text style={{ fontSize: 17, fontWeight: "700", color: colors.text.primary, marginBottom: 14 }}>
                    {program.name}
                </Text>

                <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
                    <Stat label="Treinos" value={String(workouts.length)} />
                    <Stat label="Exercícios" value={String(totalExercises)} />
                    {program.duration_weeks > 0 && <Stat label="Semanas" value={String(program.duration_weeks)} />}
                </View>

                <Text style={{ fontSize: 13, color: colors.text.secondary, lineHeight: 20 }}>
                    Toque em <Text style={{ fontWeight: "600", color: colors.text.primary }}>Usar geração</Text> para
                    abrir o programa no editor — você ainda pode ajustar tudo antes de salvar.
                </Text>
            </ScrollView>

            <View
                style={{
                    paddingHorizontal: 16,
                    paddingTop: 12,
                    paddingBottom: insetsBottom + 12,
                    borderTopWidth: 0.5,
                    borderTopColor: colors.border.primary,
                    backgroundColor: colors.background.card,
                    gap: 10,
                }}
            >
                <TouchableOpacity
                    onPress={onConfirm}
                    accessibilityRole="button"
                    accessibilityLabel="Usar geração"
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        paddingVertical: 14,
                        borderRadius: 12,
                        backgroundColor: colors.brand.primary,
                    }}
                >
                    <ChevronRight size={16} color={colors.text.inverse} />
                    <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text.inverse }}>
                        Usar geração
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={onDiscard}
                    accessibilityRole="button"
                    accessibilityLabel="Descartar"
                    style={{
                        paddingVertical: 12,
                        alignItems: "center",
                    }}
                >
                    <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text.secondary }}>
                        Descartar
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

function ErrorStep({ message, onRetry, onClose }: { message: string; onRetry: () => void; onClose: () => void }) {
    return (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
            <View
                style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: colors.error.light,
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 16,
                }}
            >
                <AlertTriangle size={24} color={colors.error.default} />
            </View>
            <Text style={{ fontSize: 16, fontWeight: "600", color: colors.text.primary, marginBottom: 8 }}>
                Erro
            </Text>
            <Text style={{ fontSize: 13, color: colors.text.secondary, textAlign: "center", marginBottom: 24 }}>
                {message}
            </Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
                <TouchableOpacity
                    onPress={onClose}
                    style={{ paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 }}
                >
                    <Text style={{ fontSize: 14, color: colors.text.secondary, fontWeight: "600" }}>Fechar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={onRetry}
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        paddingHorizontal: 18,
                        paddingVertical: 10,
                        borderRadius: 10,
                        backgroundColor: colors.brand.primaryLight,
                    }}
                >
                    <RotateCcw size={14} color={colors.brand.primary} />
                    <Text style={{ fontSize: 14, color: colors.brand.primary, fontWeight: "600" }}>
                        Tentar novamente
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <View
            style={{
                flex: 1,
                backgroundColor: colors.background.card,
                borderRadius: 12,
                paddingVertical: 12,
                alignItems: "center",
            }}
        >
            <Text style={{ fontSize: 22, fontWeight: "800", color: colors.brand.primary }}>{value}</Text>
            <Text style={{ fontSize: 11, color: colors.text.tertiary, marginTop: 2, textTransform: "uppercase", letterSpacing: 0.5 }}>
                {label}
            </Text>
        </View>
    );
}
