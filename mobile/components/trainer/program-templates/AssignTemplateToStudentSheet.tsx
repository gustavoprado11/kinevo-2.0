import React, { useState, useCallback, useMemo } from "react";
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    FlatList,
    TextInput,
    ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { X, ChevronRight, ChevronLeft, AlertTriangle, Check, Search, Calendar, Dumbbell } from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import { toast } from "@/lib/toast";
import { useV2Colors } from "@/hooks/useV2Colors";
import { Avatar } from "@/components/v2";
import { useTrainerStudentsList, type TrainerStudent } from "@/hooks/useTrainerStudentsList";

interface Props {
    visible: boolean;
    templateId: string | null;
    templateName: string;
    workoutCount: number;
    durationWeeks: number | null;
    onClose: () => void;
    onSuccess: () => void;
}

type Step = "student" | "configure";

/**
 * Assigns a program template to a student, picked from the Template Library.
 * Inverse of `AssignProgramWizard` (which is template-first from a student
 * screen): here the template is fixed and the trainer picks the student, then
 * chooses immediate vs scheduled. Uses the same `assign-program` edge function.
 */
export function AssignTemplateToStudentSheet({
    visible,
    templateId,
    templateName,
    workoutCount,
    durationWeeks,
    onClose,
    onSuccess,
}: Props) {
    const colors = useV2Colors();
    const insets = useSafeAreaInsets();
    const { students, isLoading, search, setSearch } = useTrainerStudentsList();
    const [step, setStep] = useState<Step>("student");
    const [selected, setSelected] = useState<TrainerStudent | null>(null);
    const [isImmediate, setIsImmediate] = useState(true);
    const [isAssigning, setIsAssigning] = useState(false);

    const pickableStudents = useMemo(
        () => students.filter((s) => !s.is_trainer_profile),
        [students],
    );

    const reset = useCallback(() => {
        setStep("student");
        setSelected(null);
        setIsImmediate(true);
        setSearch("");
    }, [setSearch]);

    const handleClose = () => {
        reset();
        onClose();
    };

    const handleSelectStudent = (s: TrainerStudent) => {
        Haptics.selectionAsync().catch(() => { });
        setSelected(s);
        setStep("configure");
    };

    const handleConfirm = useCallback(async () => {
        if (!templateId || !selected) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setIsAssigning(true);
        try {
            const { data, error } = await supabase.functions.invoke("assign-program", {
                body: {
                    studentId: selected.id,
                    templateId,
                    startDate: new Date().toISOString(),
                    isScheduled: !isImmediate,
                },
            });
            if (error) throw new Error(error.message || "Falha ao atribuir programa");
            if (data?.error) throw new Error(data.error);

            toast.success("Programa atribuído!", `"${templateName}" foi atribuído a ${selected.name}.`);
            reset();
            onSuccess();
        } catch (err) {
            const message = err instanceof Error ? err.message : "Falha ao atribuir programa.";
            toast.error("Erro", message);
        } finally {
            setIsAssigning(false);
        }
    }, [templateId, selected, isImmediate, templateName, reset, onSuccess]);

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
            <View style={{ flex: 1, backgroundColor: colors.surface.canvas }}>
                {/* Header */}
                <View
                    style={{
                        paddingTop: insets.top + 8,
                        paddingHorizontal: 20,
                        paddingBottom: 12,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        backgroundColor: colors.surface.card,
                        borderBottomWidth: 0.5,
                        borderBottomColor: colors.border.subtle,
                    }}
                >
                    <TouchableOpacity
                        onPress={step === "configure" ? () => setStep("student") : handleClose}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        accessibilityLabel={step === "configure" ? "Voltar" : "Fechar"}
                        accessibilityRole="button"
                    >
                        {step === "configure" ? (
                            <ChevronLeft size={24} color={colors.text.secondary} />
                        ) : (
                            <X size={24} color={colors.text.secondary} />
                        )}
                    </TouchableOpacity>
                    <Text style={{ fontSize: 17, fontWeight: "700", color: colors.text.primary }}>
                        {step === "student" ? "Escolher aluno" : "Confirmar"}
                    </Text>
                    <View style={{ width: 24 }} />
                </View>

                {/* Template chip */}
                <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
                    <View
                        style={{
                            backgroundColor: colors.surface.card,
                            borderRadius: 12,
                            padding: 12,
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 10,
                        }}
                    >
                        <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: colors.purple[100], alignItems: "center", justifyContent: "center" }}>
                            <Dumbbell size={16} color={colors.purple[600]} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text.primary }} numberOfLines={1}>
                                {templateName}
                            </Text>
                            <Text style={{ fontSize: 12, color: colors.text.tertiary, marginTop: 1 }}>
                                {durationWeeks ? `${durationWeeks} semanas · ` : ""}{workoutCount} treino(s)
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Step 1: pick student */}
                {step === "student" && (
                    <>
                        <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 }}>
                            <View
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    backgroundColor: colors.surface.card,
                                    borderRadius: 14,
                                    paddingHorizontal: 14,
                                    paddingVertical: 12,
                                    gap: 10,
                                }}
                            >
                                <Search size={18} color={colors.text.tertiary} />
                                <TextInput
                                    value={search}
                                    onChangeText={setSearch}
                                    placeholder="Buscar aluno..."
                                    placeholderTextColor="#8A8681"
                                    style={{ flex: 1, fontSize: 14, color: colors.text.primary }}
                                    accessibilityLabel="Buscar aluno"
                                />
                            </View>
                        </View>
                        {isLoading ? (
                            <ActivityIndicator style={{ marginTop: 40 }} color={colors.purple[600]} />
                        ) : (
                            <FlatList
                                data={pickableStudents}
                                keyExtractor={(item) => item.id}
                                contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 }}
                                keyboardShouldPersistTaps="handled"
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        onPress={() => handleSelectStudent(item)}
                                        activeOpacity={0.6}
                                        accessibilityRole="button"
                                        accessibilityLabel={`Atribuir a ${item.name}`}
                                        style={{
                                            flexDirection: "row",
                                            alignItems: "center",
                                            gap: 12,
                                            backgroundColor: colors.surface.card,
                                            borderRadius: 14,
                                            padding: 12,
                                            marginBottom: 8,
                                        }}
                                    >
                                        <Avatar name={item.name} size="md" src={item.avatar_url ?? undefined} />
                                        <View style={{ flex: 1, minWidth: 0 }}>
                                            <Text style={{ fontSize: 15, fontWeight: "600", color: colors.text.primary }} numberOfLines={1}>
                                                {item.name}
                                            </Text>
                                            <Text style={{ fontSize: 12, color: colors.text.tertiary, marginTop: 1 }} numberOfLines={1}>
                                                {item.program_name ? `Programa: ${item.program_name}` : "Sem programa ativo"}
                                            </Text>
                                        </View>
                                        <ChevronRight size={18} color={colors.text.tertiary} />
                                    </TouchableOpacity>
                                )}
                                ListEmptyComponent={
                                    <View style={{ alignItems: "center", marginTop: 60 }}>
                                        <Text style={{ fontSize: 15, fontWeight: "600", color: colors.text.tertiary }}>
                                            Nenhum aluno encontrado
                                        </Text>
                                    </View>
                                }
                            />
                        )}
                    </>
                )}

                {/* Step 2: configure + confirm */}
                {step === "configure" && selected && (
                    <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 16 }}>
                        {/* Selected student */}
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surface.card, borderRadius: 14, padding: 14, marginBottom: 16 }}>
                            <Avatar name={selected.name} size="md" src={selected.avatar_url ?? undefined} />
                            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text.primary }} numberOfLines={1}>
                                {selected.name}
                            </Text>
                        </View>

                        {/* Active program warning */}
                        {!!selected.program_name && (
                            <View
                                style={{
                                    flexDirection: "row",
                                    backgroundColor: colors.semantic.warning.bg,
                                    borderRadius: 12,
                                    padding: 14,
                                    marginBottom: 16,
                                    alignItems: "center",
                                }}
                            >
                                <AlertTriangle size={18} color={colors.semantic.warning.fg} />
                                <Text style={{ flex: 1, fontSize: 13, color: colors.semantic.warning.fg, marginLeft: 10, lineHeight: 18 }}>
                                    {selected.name} já tem um programa ativo. Ao atribuir imediatamente, o programa atual será encerrado.
                                </Text>
                            </View>
                        )}

                        {/* Start options */}
                        <Text style={{ fontSize: 12, fontWeight: "600", color: colors.text.tertiary, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
                            Quando iniciar
                        </Text>

                        <TouchableOpacity
                            onPress={() => setIsImmediate(true)}
                            accessibilityRole="button"
                            style={{
                                backgroundColor: isImmediate ? colors.purple[100] : colors.surface.card,
                                borderRadius: 14,
                                padding: 16,
                                marginBottom: 10,
                                borderWidth: isImmediate ? 2 : 0,
                                borderColor: isImmediate ? colors.purple[600] : "transparent",
                            }}
                        >
                            <Text style={{ fontSize: 15, fontWeight: "600", color: colors.text.primary }}>
                                Iniciar imediatamente
                            </Text>
                            <Text style={{ fontSize: 13, color: colors.text.tertiary, marginTop: 4 }}>
                                O programa começa agora e o anterior (se houver) é encerrado
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => setIsImmediate(false)}
                            accessibilityRole="button"
                            style={{
                                backgroundColor: !isImmediate ? colors.purple[100] : colors.surface.card,
                                borderRadius: 14,
                                padding: 16,
                                marginBottom: 20,
                                borderWidth: !isImmediate ? 2 : 0,
                                borderColor: !isImmediate ? colors.purple[600] : "transparent",
                            }}
                        >
                            <Text style={{ fontSize: 15, fontWeight: "600", color: colors.text.primary }}>
                                Agendar para depois
                            </Text>
                            <Text style={{ fontSize: 13, color: colors.text.tertiary, marginTop: 4 }}>
                                O programa fica agendado e não afeta o programa atual
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={handleConfirm}
                            disabled={isAssigning}
                            accessibilityRole="button"
                            accessibilityLabel="Confirmar atribuição"
                            style={{
                                backgroundColor: colors.purple[600],
                                borderRadius: 14,
                                paddingVertical: 16,
                                alignItems: "center",
                                flexDirection: "row",
                                justifyContent: "center",
                                gap: 8,
                                opacity: isAssigning ? 0.7 : 1,
                            }}
                            activeOpacity={0.8}
                        >
                            {isAssigning ? (
                                <ActivityIndicator color="#ffffff" />
                            ) : (
                                <>
                                    <Check size={18} color="#ffffff" />
                                    <Text style={{ fontSize: 16, fontWeight: "700", color: "#ffffff" }}>
                                        Confirmar atribuição
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </Modal>
    );
}
