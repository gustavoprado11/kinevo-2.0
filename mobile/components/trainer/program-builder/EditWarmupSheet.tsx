/**
 * EditWarmupSheet — modal pra editar a descrição de um aquecimento.
 *
 * V1: só warmup_type 'free' (sem dropdown). Caller é responsável por chamar
 * updateItem com `{ item_config: { warmup_type: 'free', description } }`.
 */
import React, { useEffect, useState } from "react";
import {
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    SafeAreaView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Flame, X } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useV2Colors } from "@/hooks/useV2Colors";

const ACCENT = "#F97316";

export interface EditWarmupSheetProps {
    visible: boolean;
    initialDescription: string;
    onSave: (description: string) => void;
    onClose: () => void;
}

export function EditWarmupSheet({
    visible,
    initialDescription,
    onSave,
    onClose,
}: EditWarmupSheetProps) {
    const colors = useV2Colors();
    const [description, setDescription] = useState(initialDescription);

    useEffect(() => {
        if (visible) setDescription(initialDescription);
    }, [visible, initialDescription]);

    const handleSave = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
        onSave(description.trim());
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
                <Pressable
                    onPress={onClose}
                    accessibilityLabel="Fechar"
                    accessibilityRole="button"
                    style={{
                        flex: 1,
                        backgroundColor: "rgba(0,0,0,0.45)",
                        justifyContent: "flex-end",
                    }}
                >
                    <Pressable
                        onPress={() => { }}
                        style={{
                            backgroundColor: colors.surface.canvas,
                            borderTopLeftRadius: 24,
                            borderTopRightRadius: 24,
                            paddingHorizontal: 16,
                            paddingTop: 8,
                            paddingBottom: 8,
                        }}
                    >
                        <SafeAreaView>
                            {/* Drag handle */}
                            <View style={{ alignItems: "center", marginBottom: 8 }}>
                                <View
                                    style={{
                                        width: 36,
                                        height: 4,
                                        borderRadius: 2,
                                        backgroundColor: colors.border.default,
                                    }}
                                />
                            </View>

                            {/* Header */}
                            <View
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    paddingVertical: 8,
                                }}
                            >
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                    <Flame size={18} color={ACCENT} strokeWidth={2.2} />
                                    <Text
                                        style={{
                                            fontSize: 18,
                                            fontWeight: "700",
                                            color: colors.text.primary,
                                        }}
                                    >
                                        Editar aquecimento
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    onPress={onClose}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                    accessibilityRole="button"
                                    accessibilityLabel="Fechar"
                                    style={{
                                        width: 30,
                                        height: 30,
                                        borderRadius: 15,
                                        backgroundColor: colors.surface.card2,
                                        alignItems: "center",
                                        justifyContent: "center",
                                    }}
                                >
                                    <X size={16} color={colors.text.secondary} />
                                </TouchableOpacity>
                            </View>

                            {/* Input */}
                            <View style={{ marginTop: 12, marginBottom: 16 }}>
                                <TextInput
                                    value={description}
                                    onChangeText={setDescription}
                                    multiline
                                    autoFocus
                                    placeholder="Ex: 5min esteira + mobilidade de ombros"
                                    placeholderTextColor={colors.text.tertiary}
                                    textAlignVertical="top"
                                    style={{
                                        backgroundColor: colors.surface.card,
                                        borderRadius: 14,
                                        borderWidth: 1,
                                        borderColor: colors.border.default,
                                        padding: 14,
                                        minHeight: 100,
                                        fontSize: 15,
                                        lineHeight: 22,
                                        color: colors.text.primary,
                                    }}
                                />
                            </View>

                            {/* Footer */}
                            <View style={{ flexDirection: "row", gap: 12, paddingBottom: 8 }}>
                                <TouchableOpacity
                                    onPress={onClose}
                                    accessibilityRole="button"
                                    accessibilityLabel="Cancelar"
                                    style={{
                                        flex: 1,
                                        height: 48,
                                        alignItems: "center",
                                        justifyContent: "center",
                                        borderRadius: 14,
                                    }}
                                >
                                    <Text
                                        style={{
                                            fontSize: 15,
                                            fontWeight: "600",
                                            color: colors.text.secondary,
                                        }}
                                    >
                                        Cancelar
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={handleSave}
                                    accessibilityRole="button"
                                    accessibilityLabel="Salvar aquecimento"
                                    activeOpacity={0.85}
                                    style={{ flex: 2, borderRadius: 14, overflow: "hidden" }}
                                >
                                    <LinearGradient
                                        colors={[colors.purple[500], colors.purple[700]]}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                        style={{
                                            height: 48,
                                            alignItems: "center",
                                            justifyContent: "center",
                                        }}
                                    >
                                        <Text
                                            style={{
                                                fontSize: 15,
                                                fontWeight: "700",
                                                color: "#FFFFFF",
                                            }}
                                        >
                                            Salvar
                                        </Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        </SafeAreaView>
                    </Pressable>
                </Pressable>
            </KeyboardAvoidingView>
        </Modal>
    );
}
