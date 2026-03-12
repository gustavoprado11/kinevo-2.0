import React, { useState, useMemo } from "react";
import * as Haptics from "expo-haptics";
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    FlatList,
    TextInput,
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Platform,
} from "react-native";
import { X, Search, Check, RefreshCw } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../../lib/supabase";
import { useTrainerStudentsList } from "../../../hooks/useTrainerStudentsList";
import type { FormTemplate } from "../../../hooks/useTrainerFormTemplates";

interface Props {
    visible: boolean;
    template: FormTemplate | null;
    onClose: () => void;
    onSuccess: () => void;
}

const DEADLINE_OPTIONS = [
    { label: "3 dias", days: 3 },
    { label: "1 semana", days: 7 },
    { label: "2 semanas", days: 14 },
    { label: "Sem prazo", days: 0 },
];

type Frequency = "daily" | "weekly" | "biweekly" | "monthly";

const FREQUENCY_OPTIONS: { key: Frequency; label: string }[] = [
    { key: "daily", label: "Diário" },
    { key: "weekly", label: "Semanal" },
    { key: "biweekly", label: "Quinzenal" },
    { key: "monthly", label: "Mensal" },
];

function computeNextDue(frequency: Frequency): string {
    const d = new Date();
    switch (frequency) {
        case "daily": d.setDate(d.getDate() + 1); break;
        case "weekly": d.setDate(d.getDate() + 7); break;
        case "biweekly": d.setDate(d.getDate() + 14); break;
        case "monthly": d.setMonth(d.getMonth() + 1); break;
    }
    return d.toISOString();
}

export function AssignFormModal({ visible, template, onClose, onSuccess }: Props) {
    const insets = useSafeAreaInsets();
    const { students, isLoading: studentsLoading } = useTrainerStudentsList();
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [deadlineDays, setDeadlineDays] = useState(7);
    const [message, setMessage] = useState("");
    const [search, setSearch] = useState("");
    const [isRecurring, setIsRecurring] = useState(false);
    const [frequency, setFrequency] = useState<Frequency>("weekly");
    const [isSending, setIsSending] = useState(false);

    const filteredStudents = useMemo(() => {
        if (!search.trim()) return students;
        const q = search.toLowerCase();
        return students.filter(
            (s) => s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)
        );
    }, [students, search]);

    const toggleStudent = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleAll = () => {
        if (selectedIds.size === filteredStudents.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredStudents.map((s) => s.id)));
        }
    };

    const handleSend = async () => {
        if (!template || selectedIds.size === 0) return;

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setIsSending(true);
        try {
            const dueAt =
                deadlineDays > 0
                    ? new Date(Date.now() + deadlineDays * 24 * 60 * 60 * 1000).toISOString()
                    : null;

            const { data, error } = await supabase.rpc("assign_form_to_students" as any, {
                p_form_template_id: template.id,
                p_student_ids: Array.from(selectedIds),
                p_due_at: dueAt,
                p_message: message.trim() || null,
            });

            if (error) throw error;

            const result = data as any;

            // If recurring, create schedules
            if (isRecurring) {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const studentIds = Array.from(selectedIds);
                    for (const studentId of studentIds) {
                        await (supabase as any)
                            .from("form_schedules")
                            .upsert({
                                trainer_id: user.id,
                                student_id: studentId,
                                form_template_id: template.id,
                                frequency,
                                next_due_at: computeNextDue(frequency),
                            }, { onConflict: "student_id,form_template_id,frequency" });
                    }
                }
            }

            const freqLabel = FREQUENCY_OPTIONS.find((f) => f.key === frequency)?.label ?? "";
            Alert.alert(
                "Enviado!",
                `Formulário enviado para ${result.assigned_count} aluno(s).${
                    result.skipped_count > 0 ? ` ${result.skipped_count} já tinham pendente.` : ""
                }${isRecurring ? ` Recorrência ${freqLabel.toLowerCase()} ativada.` : ""}`
            );

            setSelectedIds(new Set());
            setMessage("");
            setIsRecurring(false);
            setFrequency("weekly");
            onSuccess();
            onClose();
        } catch (err: any) {
            Alert.alert("Erro", err.message || "Falha ao enviar formulário.");
        } finally {
            setIsSending(false);
        }
    };

    const handleClose = () => {
        setSelectedIds(new Set());
        setSearch("");
        setMessage("");
        setIsRecurring(false);
        setFrequency("weekly");
        onClose();
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                style={{ flex: 1, backgroundColor: "#F2F2F7" }}
            >
                {/* Header */}
                <View
                    style={{
                        paddingTop: insets.top + 8,
                        paddingHorizontal: 20,
                        paddingBottom: 12,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        borderBottomWidth: 0.5,
                        borderBottomColor: "rgba(0,0,0,0.08)",
                        backgroundColor: "#ffffff",
                    }}
                >
                    <TouchableOpacity onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Fechar" accessibilityRole="button">
                        <X size={24} color="#64748b" />
                    </TouchableOpacity>
                    <Text style={{ fontSize: 17, fontWeight: "700", color: "#1a1a2e" }}>
                        Enviar Formulário
                    </Text>
                    <View style={{ width: 24 }} />
                </View>

                {/* Template info */}
                {template && (
                    <View style={{ paddingHorizontal: 20, paddingVertical: 12, backgroundColor: "#ffffff", marginBottom: 8 }}>
                        <Text style={{ fontSize: 15, fontWeight: "600", color: "#1a1a2e" }}>
                            {template.title}
                        </Text>
                        <Text style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>
                            {template.question_count} perguntas
                        </Text>
                    </View>
                )}

                {/* Deadline */}
                <View style={{ paddingHorizontal: 20, paddingVertical: 12 }}>
                    <Text style={{ fontSize: 12, fontWeight: "600", color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
                        Prazo
                    </Text>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                        {DEADLINE_OPTIONS.map((opt) => (
                            <TouchableOpacity
                                key={opt.days}
                                onPress={() => setDeadlineDays(opt.days)}
                                style={{
                                    paddingHorizontal: 14,
                                    paddingVertical: 8,
                                    borderRadius: 20,
                                    backgroundColor: deadlineDays === opt.days ? "#7c3aed" : "#ffffff",
                                }}
                            >
                                <Text
                                    style={{
                                        fontSize: 13,
                                        fontWeight: "600",
                                        color: deadlineDays === opt.days ? "#ffffff" : "#64748b",
                                    }}
                                >
                                    {opt.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Message */}
                <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
                    <TextInput
                        placeholder="Mensagem personalizada (opcional)"
                        value={message}
                        onChangeText={setMessage}
                        multiline
                        style={{
                            backgroundColor: "#ffffff",
                            borderRadius: 12,
                            padding: 14,
                            fontSize: 14,
                            color: "#1a1a2e",
                            minHeight: 50,
                            maxHeight: 80,
                        }}
                        placeholderTextColor="#94a3b8"
                    />
                </View>

                {/* Recurring toggle */}
                <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
                    <TouchableOpacity
                        onPress={() => setIsRecurring(!isRecurring)}
                        activeOpacity={0.7}
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            backgroundColor: "#ffffff",
                            borderRadius: 12,
                            padding: 14,
                        }}
                    >
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            <RefreshCw size={16} color={isRecurring ? "#7c3aed" : "#94a3b8"} />
                            <Text style={{ fontSize: 14, fontWeight: "600", color: "#1a1a2e" }}>
                                Envio recorrente
                            </Text>
                        </View>
                        <View
                            style={{
                                width: 44,
                                height: 24,
                                borderRadius: 12,
                                backgroundColor: isRecurring ? "#7c3aed" : "#d1d5db",
                                justifyContent: "center",
                                paddingHorizontal: 2,
                            }}
                        >
                            <View
                                style={{
                                    width: 20,
                                    height: 20,
                                    borderRadius: 10,
                                    backgroundColor: "#ffffff",
                                    alignSelf: isRecurring ? "flex-end" : "flex-start",
                                }}
                            />
                        </View>
                    </TouchableOpacity>
                    {isRecurring && (
                        <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                            {FREQUENCY_OPTIONS.map((opt) => (
                                <TouchableOpacity
                                    key={opt.key}
                                    onPress={() => setFrequency(opt.key)}
                                    style={{
                                        paddingHorizontal: 14,
                                        paddingVertical: 8,
                                        borderRadius: 20,
                                        backgroundColor: frequency === opt.key ? "#7c3aed" : "#ffffff",
                                    }}
                                >
                                    <Text
                                        style={{
                                            fontSize: 13,
                                            fontWeight: "600",
                                            color: frequency === opt.key ? "#ffffff" : "#64748b",
                                        }}
                                    >
                                        {opt.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </View>

                {/* Student search */}
                <View style={{ paddingHorizontal: 20, marginBottom: 8 }}>
                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            backgroundColor: "#ffffff",
                            borderRadius: 12,
                            paddingHorizontal: 12,
                        }}
                    >
                        <Search size={16} color="#94a3b8" />
                        <TextInput
                            placeholder="Buscar aluno..."
                            value={search}
                            onChangeText={setSearch}
                            style={{ flex: 1, paddingVertical: 10, paddingLeft: 8, fontSize: 14, color: "#1a1a2e" }}
                            placeholderTextColor="#94a3b8"
                        />
                    </View>
                </View>

                {/* Select all */}
                <TouchableOpacity
                    onPress={toggleAll}
                    style={{ paddingHorizontal: 20, paddingVertical: 8, flexDirection: "row", alignItems: "center" }}
                >
                    <Text style={{ fontSize: 13, fontWeight: "600", color: "#7c3aed" }}>
                        {selectedIds.size === filteredStudents.length && filteredStudents.length > 0
                            ? "Desmarcar todos"
                            : "Selecionar todos"}
                    </Text>
                    <Text style={{ fontSize: 13, color: "#94a3b8", marginLeft: 8 }}>
                        {selectedIds.size} selecionado(s)
                    </Text>
                </TouchableOpacity>

                {/* Student list */}
                <FlatList
                    data={filteredStudents}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
                    renderItem={({ item }) => {
                        const isSelected = selectedIds.has(item.id);
                        return (
                            <TouchableOpacity
                                onPress={() => toggleStudent(item.id)}
                                activeOpacity={0.6}
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    paddingVertical: 10,
                                    paddingHorizontal: 12,
                                    marginBottom: 4,
                                    backgroundColor: isSelected ? "#f3f0ff" : "#ffffff",
                                    borderRadius: 12,
                                    borderWidth: isSelected ? 1.5 : 0,
                                    borderColor: isSelected ? "#7c3aed" : "transparent",
                                }}
                            >
                                <View
                                    style={{
                                        width: 32,
                                        height: 32,
                                        borderRadius: 16,
                                        backgroundColor: "#e2e8f0",
                                        overflow: "hidden",
                                        marginRight: 10,
                                    }}
                                >
                                    {item.avatar_url ? (
                                        <Image source={{ uri: item.avatar_url }} style={{ width: 32, height: 32 }} />
                                    ) : (
                                        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                                            <Text style={{ fontSize: 13, fontWeight: "600", color: "#64748b" }}>
                                                {item.name.charAt(0)}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                                <Text style={{ flex: 1, fontSize: 14, fontWeight: "500", color: "#1a1a2e" }}>
                                    {item.name}
                                </Text>
                                {isSelected && (
                                    <View
                                        style={{
                                            width: 22,
                                            height: 22,
                                            borderRadius: 11,
                                            backgroundColor: "#7c3aed",
                                            alignItems: "center",
                                            justifyContent: "center",
                                        }}
                                    >
                                        <Check size={14} color="#ffffff" strokeWidth={3} />
                                    </View>
                                )}
                            </TouchableOpacity>
                        );
                    }}
                    ListEmptyComponent={
                        studentsLoading ? (
                            <ActivityIndicator style={{ marginTop: 40 }} color="#7c3aed" />
                        ) : (
                            <Text style={{ textAlign: "center", color: "#94a3b8", marginTop: 40 }}>
                                Nenhum aluno encontrado
                            </Text>
                        )
                    }
                />

                {/* Send button */}
                <View
                    style={{
                        paddingHorizontal: 20,
                        paddingVertical: 12,
                        paddingBottom: insets.bottom + 12,
                        backgroundColor: "#ffffff",
                        borderTopWidth: 0.5,
                        borderTopColor: "rgba(0,0,0,0.08)",
                    }}
                >
                    <TouchableOpacity
                        onPress={handleSend}
                        disabled={selectedIds.size === 0 || isSending}
                        style={{
                            backgroundColor: selectedIds.size === 0 ? "#d1d5db" : "#7c3aed",
                            borderRadius: 14,
                            paddingVertical: 16,
                            alignItems: "center",
                        }}
                        activeOpacity={0.7}
                    >
                        {isSending ? (
                            <ActivityIndicator color="#ffffff" />
                        ) : (
                            <Text style={{ fontSize: 16, fontWeight: "700", color: "#ffffff" }}>
                                Enviar para {selectedIds.size} aluno(s)
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}
