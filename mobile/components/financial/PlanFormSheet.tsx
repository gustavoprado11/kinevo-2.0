import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Modal,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    ActivityIndicator,
    Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import type { TrainerPlan } from "../../hooks/useTrainerPlans";

const INTERVALS: { key: string; label: string }[] = [
    { key: "month", label: "Mensal" },
    { key: "quarter", label: "Trimestral" },
    { key: "year", label: "Anual" },
];

interface PlanFormSheetProps {
    visible: boolean;
    onClose: () => void;
    onSubmit: (data: { title: string; price: number; interval: string; description: string }) => Promise<{ success: boolean; error?: string }>;
    onUpdate?: (planId: string, data: { title: string; description: string }) => Promise<{ success: boolean; error?: string }>;
    plan?: TrainerPlan | null;
}

export function PlanFormSheet({ visible, onClose, onSubmit, onUpdate, plan }: PlanFormSheetProps) {
    const isEditing = !!plan;

    const [title, setTitle] = useState("");
    const [price, setPrice] = useState("");
    const [interval, setInterval] = useState("month");
    const [description, setDescription] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (plan) {
            setTitle(plan.title);
            setPrice(plan.price.toFixed(2).replace(".", ","));
            setInterval(plan.interval);
            setDescription(plan.description || "");
        } else {
            setTitle("");
            setPrice("");
            setInterval("month");
            setDescription("");
        }
    }, [plan, visible]);

    const handleSave = async () => {
        if (!title.trim()) {
            Alert.alert("Erro", "Digite o nome do plano");
            return;
        }

        const priceNum = parseFloat(price.replace(",", "."));

        if (!isEditing && (!priceNum || priceNum <= 0)) {
            Alert.alert("Erro", "Digite um valor válido");
            return;
        }

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setLoading(true);

        try {
            let result;
            if (isEditing && onUpdate) {
                result = await onUpdate(plan!.id, { title: title.trim(), description: description.trim() });
            } else {
                result = await onSubmit({
                    title: title.trim(),
                    price: priceNum,
                    interval,
                    description: description.trim(),
                });
            }

            if (result.success) {
                onClose();
            } else {
                Alert.alert("Erro", result.error || "Falha ao salvar plano");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <SafeAreaView style={{ flex: 1, backgroundColor: "#F2F2F7" }} edges={["top"]}>
                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior={Platform.OS === "ios" ? "padding" : undefined}
                >
                    {/* Header */}
                    <View style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        paddingHorizontal: 20,
                        paddingVertical: 14,
                        borderBottomWidth: 1,
                        borderBottomColor: "rgba(0,0,0,0.06)",
                    }}>
                        <TouchableOpacity onPress={onClose} hitSlop={8}>
                            <X size={22} color="#64748b" />
                        </TouchableOpacity>
                        <Text style={{ fontSize: 17, fontWeight: "600", color: "#0f172a" }}>
                            {isEditing ? "Editar Plano" : "Novo Plano"}
                        </Text>
                        <View style={{ width: 22 }} />
                    </View>

                    <ScrollView
                        style={{ flex: 1 }}
                        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* Title */}
                        <Text style={{ fontSize: 13, fontWeight: "600", color: "#64748b", marginBottom: 6 }}>
                            Nome do plano *
                        </Text>
                        <TextInput
                            value={title}
                            onChangeText={setTitle}
                            placeholder="Ex: Plano Mensal"
                            placeholderTextColor="#94a3b8"
                            style={{
                                backgroundColor: "#ffffff",
                                borderRadius: 12,
                                padding: 14,
                                fontSize: 15,
                                color: "#0f172a",
                                borderWidth: 1,
                                borderColor: "rgba(0,0,0,0.06)",
                                marginBottom: 18,
                            }}
                        />

                        {/* Price */}
                        <Text style={{ fontSize: 13, fontWeight: "600", color: "#64748b", marginBottom: 6 }}>
                            Valor (R$) *
                        </Text>
                        <TextInput
                            value={price}
                            onChangeText={setPrice}
                            placeholder="150,00"
                            placeholderTextColor="#94a3b8"
                            keyboardType="decimal-pad"
                            editable={!isEditing}
                            style={{
                                backgroundColor: isEditing ? "#f1f5f9" : "#ffffff",
                                borderRadius: 12,
                                padding: 14,
                                fontSize: 15,
                                color: isEditing ? "#94a3b8" : "#0f172a",
                                borderWidth: 1,
                                borderColor: "rgba(0,0,0,0.06)",
                                marginBottom: isEditing ? 6 : 18,
                            }}
                        />
                        {isEditing && (
                            <Text style={{ fontSize: 11, color: "#94a3b8", marginBottom: 18 }}>
                                Valor e recorrência não podem ser alterados após a criação
                            </Text>
                        )}

                        {/* Interval */}
                        <Text style={{ fontSize: 13, fontWeight: "600", color: "#64748b", marginBottom: 8 }}>
                            Recorrência *
                        </Text>
                        <View style={{ flexDirection: "row", gap: 8, marginBottom: 18 }}>
                            {INTERVALS.map((item) => {
                                const active = interval === item.key;
                                return (
                                    <TouchableOpacity
                                        key={item.key}
                                        onPress={() => !isEditing && setInterval(item.key)}
                                        disabled={isEditing}
                                        style={{
                                            flex: 1,
                                            paddingVertical: 12,
                                            borderRadius: 12,
                                            alignItems: "center",
                                            backgroundColor: active ? "#7c3aed" : isEditing ? "#f1f5f9" : "#ffffff",
                                            borderWidth: active ? 0 : 1,
                                            borderColor: "rgba(0,0,0,0.06)",
                                        }}
                                    >
                                        <Text style={{
                                            fontSize: 14,
                                            fontWeight: "600",
                                            color: active ? "#ffffff" : isEditing ? "#94a3b8" : "#475569",
                                        }}>
                                            {item.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        {/* Description */}
                        <Text style={{ fontSize: 13, fontWeight: "600", color: "#64748b", marginBottom: 6 }}>
                            Descrição (opcional)
                        </Text>
                        <TextInput
                            value={description}
                            onChangeText={setDescription}
                            placeholder="Descreva o que está incluído..."
                            placeholderTextColor="#94a3b8"
                            multiline
                            numberOfLines={3}
                            textAlignVertical="top"
                            style={{
                                backgroundColor: "#ffffff",
                                borderRadius: 12,
                                padding: 14,
                                fontSize: 15,
                                color: "#0f172a",
                                borderWidth: 1,
                                borderColor: "rgba(0,0,0,0.06)",
                                minHeight: 80,
                                marginBottom: 28,
                            }}
                        />

                        {/* Save Button */}
                        <TouchableOpacity
                            onPress={handleSave}
                            disabled={loading}
                            activeOpacity={0.7}
                            style={{
                                backgroundColor: "#7c3aed",
                                borderRadius: 14,
                                paddingVertical: 16,
                                alignItems: "center",
                                justifyContent: "center",
                                opacity: loading ? 0.7 : 1,
                            }}
                        >
                            {loading ? (
                                <ActivityIndicator color="#ffffff" />
                            ) : (
                                <Text style={{ fontSize: 16, fontWeight: "700", color: "#ffffff" }}>
                                    {isEditing ? "Salvar Alterações" : "Criar Plano"}
                                </Text>
                            )}
                        </TouchableOpacity>
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </Modal>
    );
}
