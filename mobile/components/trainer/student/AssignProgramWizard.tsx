import React, { useState, useCallback } from "react";
import * as Haptics from "expo-haptics";
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    FlatList,
    ActivityIndicator,
    Alert,
} from "react-native";
import { X, ChevronRight, AlertTriangle, Check } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../../lib/supabase";
import {
    useTrainerProgramTemplates,
    ProgramTemplate,
} from "../../../hooks/useTrainerProgramTemplates";
import { ProgramTemplateCard } from "./ProgramTemplateCard";

interface Props {
    visible: boolean;
    studentId: string;
    studentName: string;
    hasActiveProgram: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

type Step = "select" | "configure" | "confirm";

export function AssignProgramWizard({
    visible,
    studentId,
    studentName,
    hasActiveProgram,
    onClose,
    onSuccess,
}: Props) {
    const insets = useSafeAreaInsets();
    const { templates, isLoading } = useTrainerProgramTemplates();
    const [step, setStep] = useState<Step>("select");
    const [selectedTemplate, setSelectedTemplate] = useState<ProgramTemplate | null>(null);
    const [isImmediate, setIsImmediate] = useState(true);
    const [isAssigning, setIsAssigning] = useState(false);

    const handleClose = () => {
        setStep("select");
        setSelectedTemplate(null);
        setIsImmediate(true);
        onClose();
    };

    const handleSelectTemplate = (t: ProgramTemplate) => {
        setSelectedTemplate(t);
        setStep("configure");
    };

    const handleConfirm = useCallback(async () => {
        if (!selectedTemplate) return;

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setIsAssigning(true);
        try {
            // Get current session token for API route
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData?.session?.access_token;
            if (!token) throw new Error("Sessão expirada");

            const apiUrl = process.env.EXPO_PUBLIC_WEB_URL || "https://app.kinevo.com.br";
            const response = await fetch(`${apiUrl}/api/programs/assign`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    studentId,
                    templateId: selectedTemplate.id,
                    startDate: new Date().toISOString(),
                    isScheduled: !isImmediate,
                }),
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "Falha ao atribuir programa");

            Alert.alert("Programa Atribuído!", `"${selectedTemplate.name}" foi atribuído a ${studentName}.`);
            onSuccess();
        } catch (err: any) {
            Alert.alert("Erro", err.message || "Falha ao atribuir programa.");
        } finally {
            setIsAssigning(false);
        }
    }, [selectedTemplate, studentId, studentName, isImmediate, onSuccess]);

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
            <View style={{ flex: 1, backgroundColor: "#F2F2F7" }}>
                {/* Header */}
                <View
                    style={{
                        paddingTop: insets.top + 8,
                        paddingHorizontal: 20,
                        paddingBottom: 12,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        backgroundColor: "#ffffff",
                        borderBottomWidth: 0.5,
                        borderBottomColor: "rgba(0,0,0,0.08)",
                    }}
                >
                    <TouchableOpacity onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <X size={24} color="#64748b" />
                    </TouchableOpacity>
                    <Text style={{ fontSize: 17, fontWeight: "700", color: "#1a1a2e" }}>
                        {step === "select" && "Selecionar Programa"}
                        {step === "configure" && "Configurar"}
                        {step === "confirm" && "Confirmar"}
                    </Text>
                    <View style={{ width: 24 }} />
                </View>

                {/* Step indicator */}
                <View style={{ flexDirection: "row", paddingHorizontal: 20, paddingVertical: 12, gap: 6 }}>
                    {(["select", "configure", "confirm"] as Step[]).map((s, idx) => (
                        <View
                            key={s}
                            style={{
                                flex: 1,
                                height: 3,
                                borderRadius: 1.5,
                                backgroundColor:
                                    idx <= ["select", "configure", "confirm"].indexOf(step)
                                        ? "#7c3aed"
                                        : "#e2e8f0",
                            }}
                        />
                    ))}
                </View>

                {/* Step 1: Select template */}
                {step === "select" && (
                    <FlatList
                        data={templates}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 }}
                        renderItem={({ item }) => (
                            <ProgramTemplateCard
                                template={item}
                                isSelected={selectedTemplate?.id === item.id}
                                onPress={() => handleSelectTemplate(item)}
                            />
                        )}
                        ListEmptyComponent={
                            isLoading ? (
                                <ActivityIndicator style={{ marginTop: 40 }} color="#7c3aed" />
                            ) : (
                                <View style={{ alignItems: "center", marginTop: 60 }}>
                                    <Text style={{ fontSize: 15, fontWeight: "600", color: "#94a3b8" }}>
                                        Nenhum template
                                    </Text>
                                    <Text style={{ fontSize: 13, color: "#94a3b8", marginTop: 4, textAlign: "center" }}>
                                        Crie templates de programa{"\n"}pelo site para usá-los aqui
                                    </Text>
                                </View>
                            )
                        }
                    />
                )}

                {/* Step 2: Configure */}
                {step === "configure" && selectedTemplate && (
                    <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 16 }}>
                        {/* Selected template summary */}
                        <View style={{ backgroundColor: "#ffffff", borderRadius: 14, padding: 16, marginBottom: 20 }}>
                            <Text style={{ fontSize: 16, fontWeight: "600", color: "#1a1a2e" }}>
                                {selectedTemplate.name}
                            </Text>
                            <Text style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
                                {selectedTemplate.duration_weeks ? `${selectedTemplate.duration_weeks} semanas · ` : ""}
                                {selectedTemplate.workout_count} treinos
                            </Text>
                        </View>

                        {/* Active program warning */}
                        {hasActiveProgram && (
                            <View
                                style={{
                                    flexDirection: "row",
                                    backgroundColor: "#fef3c7",
                                    borderRadius: 12,
                                    padding: 14,
                                    marginBottom: 20,
                                    alignItems: "center",
                                }}
                            >
                                <AlertTriangle size={18} color="#d97706" />
                                <Text style={{ flex: 1, fontSize: 13, color: "#92400e", marginLeft: 10, lineHeight: 18 }}>
                                    {studentName} já tem um programa ativo. Ao atribuir imediatamente, o programa atual será encerrado.
                                </Text>
                            </View>
                        )}

                        {/* Start options */}
                        <Text style={{ fontSize: 12, fontWeight: "600", color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
                            Quando iniciar
                        </Text>

                        <TouchableOpacity
                            onPress={() => setIsImmediate(true)}
                            style={{
                                backgroundColor: isImmediate ? "#f3f0ff" : "#ffffff",
                                borderRadius: 14,
                                padding: 16,
                                marginBottom: 10,
                                borderWidth: isImmediate ? 2 : 0,
                                borderColor: isImmediate ? "#7c3aed" : "transparent",
                            }}
                        >
                            <Text style={{ fontSize: 15, fontWeight: "600", color: "#1a1a2e" }}>
                                Iniciar Imediatamente
                            </Text>
                            <Text style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
                                O programa começa agora e o anterior (se houver) é encerrado
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => setIsImmediate(false)}
                            style={{
                                backgroundColor: !isImmediate ? "#f3f0ff" : "#ffffff",
                                borderRadius: 14,
                                padding: 16,
                                marginBottom: 20,
                                borderWidth: !isImmediate ? 2 : 0,
                                borderColor: !isImmediate ? "#7c3aed" : "transparent",
                            }}
                        >
                            <Text style={{ fontSize: 15, fontWeight: "600", color: "#1a1a2e" }}>
                                Agendar para Depois
                            </Text>
                            <Text style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
                                O programa fica agendado e não afeta o programa atual
                            </Text>
                        </TouchableOpacity>

                        {/* Next button */}
                        <TouchableOpacity
                            onPress={() => setStep("confirm")}
                            style={{
                                backgroundColor: "#7c3aed",
                                borderRadius: 14,
                                paddingVertical: 16,
                                alignItems: "center",
                                flexDirection: "row",
                                justifyContent: "center",
                                gap: 6,
                            }}
                            activeOpacity={0.7}
                        >
                            <Text style={{ fontSize: 16, fontWeight: "700", color: "#ffffff" }}>Continuar</Text>
                            <ChevronRight size={18} color="#ffffff" />
                        </TouchableOpacity>
                    </View>
                )}

                {/* Step 3: Confirm */}
                {step === "confirm" && selectedTemplate && (
                    <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 16 }}>
                        <View style={{ backgroundColor: "#ffffff", borderRadius: 14, padding: 20, marginBottom: 20 }}>
                            <Text style={{ fontSize: 12, fontWeight: "600", color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
                                Resumo
                            </Text>
                            <ConfirmRow label="Aluno" value={studentName} />
                            <ConfirmRow label="Programa" value={selectedTemplate.name} />
                            <ConfirmRow
                                label="Duração"
                                value={selectedTemplate.duration_weeks ? `${selectedTemplate.duration_weeks} semanas` : "Sem prazo"}
                            />
                            <ConfirmRow label="Treinos" value={`${selectedTemplate.workout_count}`} />
                            <ConfirmRow label="Início" value={isImmediate ? "Imediato" : "Agendado"} />
                        </View>

                        <TouchableOpacity
                            onPress={handleConfirm}
                            disabled={isAssigning}
                            style={{
                                backgroundColor: "#7c3aed",
                                borderRadius: 14,
                                paddingVertical: 16,
                                alignItems: "center",
                                flexDirection: "row",
                                justifyContent: "center",
                                gap: 8,
                            }}
                            activeOpacity={0.7}
                        >
                            {isAssigning ? (
                                <ActivityIndicator color="#ffffff" />
                            ) : (
                                <>
                                    <Check size={18} color="#ffffff" />
                                    <Text style={{ fontSize: 16, fontWeight: "700", color: "#ffffff" }}>
                                        Confirmar Atribuição
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => setStep("configure")}
                            style={{ alignItems: "center", marginTop: 14 }}
                        >
                            <Text style={{ fontSize: 14, color: "#64748b" }}>Voltar</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </Modal>
    );
}

function ConfirmRow({ label, value }: { label: string; value: string }) {
    return (
        <View
            style={{
                flexDirection: "row",
                justifyContent: "space-between",
                paddingVertical: 8,
                borderBottomWidth: 0.5,
                borderBottomColor: "rgba(0,0,0,0.04)",
            }}
        >
            <Text style={{ fontSize: 14, color: "#64748b" }}>{label}</Text>
            <Text style={{ fontSize: 14, fontWeight: "600", color: "#1a1a2e" }}>{value}</Text>
        </View>
    );
}
