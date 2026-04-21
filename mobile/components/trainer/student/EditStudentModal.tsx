import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Modal,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Alert,
} from "react-native";
import { X, User, Mail, Phone, Globe, MapPin, AlertCircle } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useUpdateStudent, type UpdateStudentInput } from "../../../hooks/useUpdateStudent";
import type { Student, StudentModality } from "../../../types/student";

interface EditStudentModalProps {
    visible: boolean;
    onClose: () => void;
    onSuccess: (updatedStudent: Student) => void;
    student: {
        id: string;
        name: string;
        email: string;
        phone: string | null;
        modality: StudentModality | null;
    };
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function EditStudentModal({ visible, onClose, onSuccess, student }: EditStudentModalProps) {
    const insets = useSafeAreaInsets();
    const { updateStudent, isUpdating } = useUpdateStudent();

    const [name, setName] = useState(student.name);
    const [email, setEmail] = useState(student.email);
    const [phone, setPhone] = useState(student.phone ?? "");
    const [modality, setModality] = useState<StudentModality>(
        (student.modality as StudentModality) ?? "online"
    );
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (visible) {
            setName(student.name);
            setEmail(student.email);
            setPhone(student.phone ?? "");
            setModality((student.modality as StudentModality) ?? "online");
            setError(null);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
    }, [visible, student.id, student.name, student.email, student.phone, student.modality]);

    const emailChanged = useMemo(
        () => email.trim().toLowerCase() !== student.email.trim().toLowerCase(),
        [email, student.email]
    );

    const hasChanges = useMemo(() => {
        return (
            name.trim() !== student.name.trim() ||
            emailChanged ||
            phone.trim() !== (student.phone ?? "").trim() ||
            modality !== ((student.modality as StudentModality) ?? "online")
        );
    }, [name, emailChanged, phone, modality, student]);

    const canSubmit = useMemo(() => {
        if (!name.trim()) return false;
        if (!EMAIL_REGEX.test(email.trim())) return false;
        return hasChanges;
    }, [name, email, hasChanges]);

    const handleRequestClose = useCallback(() => {
        if (isUpdating) return;
        if (!hasChanges) {
            onClose();
            return;
        }
        Alert.alert(
            "Descartar alterações?",
            "As alterações que você fez serão perdidas.",
            [
                { text: "Continuar editando", style: "cancel" },
                { text: "Descartar", style: "destructive", onPress: onClose },
            ]
        );
    }, [hasChanges, isUpdating, onClose]);

    const handleSubmit = useCallback(async () => {
        if (!canSubmit || isUpdating) return;
        setError(null);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        const input: UpdateStudentInput = { studentId: student.id };
        if (name.trim() !== student.name.trim()) input.name = name.trim();
        if (emailChanged) input.email = email.trim().toLowerCase();
        if (phone.trim() !== (student.phone ?? "").trim()) input.phone = phone.trim();
        if (modality !== ((student.modality as StudentModality) ?? "online")) input.modality = modality;

        const result = await updateStudent(input);

        if (!result.success) {
            setError(result.error);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            return;
        }

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onSuccess(result.student);
    }, [canSubmit, isUpdating, student, name, email, emailChanged, phone, modality, updateStudent, onSuccess]);

    return (
        <Modal
            // iOS swipe-to-dismiss do pageSheet fecha sem passar pelo guard de
            // descartar alterações — comportamento nativo aceito.
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={handleRequestClose}
        >
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
                    <TouchableOpacity
                        onPress={handleRequestClose}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        accessibilityLabel="Fechar"
                        accessibilityRole="button"
                        disabled={isUpdating}
                    >
                        <X size={24} color="#64748b" />
                    </TouchableOpacity>
                    <Text style={{ fontSize: 17, fontWeight: "700", color: "#1a1a2e" }}>
                        Editar aluno
                    </Text>
                    <View style={{ width: 24 }} />
                </View>

                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {error && (
                        <View
                            style={{
                                backgroundColor: "#fef2f2",
                                borderRadius: 12,
                                padding: 14,
                                marginBottom: 16,
                                borderWidth: 1,
                                borderColor: "#fecaca",
                            }}
                        >
                            <Text style={{ fontSize: 13, color: "#dc2626" }}>{error}</Text>
                        </View>
                    )}

                    {/* Name */}
                    <Text style={labelStyle}>Nome completo</Text>
                    <View style={inputRow}>
                        <User size={16} color="#94a3b8" />
                        <TextInput
                            value={name}
                            onChangeText={setName}
                            placeholder="Nome do aluno"
                            placeholderTextColor="#94a3b8"
                            style={inputStyle}
                            autoCapitalize="words"
                            accessibilityLabel="Nome do aluno"
                            editable={!isUpdating}
                        />
                    </View>

                    {/* Email */}
                    <Text style={labelStyle}>Email</Text>
                    <View style={inputRow}>
                        <Mail size={16} color="#94a3b8" />
                        <TextInput
                            value={email}
                            onChangeText={setEmail}
                            placeholder="aluno@email.com"
                            placeholderTextColor="#94a3b8"
                            style={inputStyle}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                            accessibilityLabel="Email do aluno"
                            editable={!isUpdating}
                        />
                    </View>
                    {emailChanged && (
                        <View
                            style={{
                                flexDirection: "row",
                                alignItems: "flex-start",
                                gap: 6,
                                marginTop: 6,
                                paddingHorizontal: 2,
                            }}
                        >
                            <AlertCircle size={12} color="#94a3b8" style={{ marginTop: 2 }} />
                            <Text style={{ flex: 1, fontSize: 12, color: "#64748b", lineHeight: 16 }}>
                                Ao alterar o email, o aluno precisará fazer login novamente com o novo endereço.
                            </Text>
                        </View>
                    )}

                    {/* Phone */}
                    <Text style={labelStyle}>Telefone (WhatsApp)</Text>
                    <View style={inputRow}>
                        <Phone size={16} color="#94a3b8" />
                        <TextInput
                            value={phone}
                            onChangeText={setPhone}
                            placeholder="(11) 99999-9999"
                            placeholderTextColor="#94a3b8"
                            style={inputStyle}
                            keyboardType="phone-pad"
                            accessibilityLabel="Telefone do aluno"
                            editable={!isUpdating}
                        />
                    </View>

                    {/* Modality */}
                    <Text style={labelStyle}>Modalidade</Text>
                    <View
                        style={{
                            flexDirection: "row",
                            backgroundColor: "#ffffff",
                            borderRadius: 12,
                            padding: 4,
                            borderWidth: 1,
                            borderColor: "rgba(0,0,0,0.05)",
                        }}
                    >
                        {(["online", "presential"] as const).map((opt) => {
                            const isActive = modality === opt;
                            const Icon = opt === "online" ? Globe : MapPin;
                            return (
                                <TouchableOpacity
                                    key={opt}
                                    onPress={() => {
                                        if (isUpdating) return;
                                        Haptics.selectionAsync();
                                        setModality(opt);
                                    }}
                                    accessibilityRole="button"
                                    accessibilityLabel={opt === "online" ? "Online" : "Presencial"}
                                    accessibilityState={{ selected: isActive }}
                                    style={{
                                        flex: 1,
                                        flexDirection: "row",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: 6,
                                        paddingVertical: 12,
                                        borderRadius: 10,
                                        backgroundColor: isActive ? "#7c3aed" : "transparent",
                                    }}
                                >
                                    <Icon size={16} color={isActive ? "#ffffff" : "#94a3b8"} />
                                    <Text
                                        style={{
                                            fontSize: 13,
                                            fontWeight: "600",
                                            color: isActive ? "#ffffff" : "#64748b",
                                        }}
                                    >
                                        {opt === "online" ? "Online" : "Presencial"}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </ScrollView>

                {/* Save button */}
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
                        onPress={handleSubmit}
                        disabled={!canSubmit || isUpdating}
                        activeOpacity={0.7}
                        accessibilityLabel="Salvar alterações"
                        accessibilityRole="button"
                        style={{
                            backgroundColor: canSubmit ? "#7c3aed" : "#d1d5db",
                            borderRadius: 14,
                            paddingVertical: 16,
                            alignItems: "center",
                        }}
                    >
                        {isUpdating ? (
                            <ActivityIndicator color="#ffffff" />
                        ) : (
                            <Text style={{ fontSize: 16, fontWeight: "700", color: "#ffffff" }}>
                                Salvar
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const labelStyle = {
    fontSize: 12,
    fontWeight: "600" as const,
    color: "#64748b",
    textTransform: "uppercase" as const,
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 16,
};

const inputRow = {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    paddingHorizontal: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.04)",
};

const inputStyle = {
    flex: 1,
    paddingVertical: 14,
    fontSize: 14,
    color: "#1a1a2e",
};
