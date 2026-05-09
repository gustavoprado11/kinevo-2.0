import React from "react";
import { View, Text, Modal, Pressable } from "react-native";
import * as Haptics from "expo-haptics";

export type EditScope = "only_this" | "this_and_future" | "whole_series";

interface EditScopeDialogProps {
    visible: boolean;
    /** Title shown above the options. */
    title: string;
    /** When `true` removes the "this and future" option (used for cancel). */
    excludeThisAndFuture?: boolean;
    onSelect: (scope: EditScope) => void;
    onClose: () => void;
}

export function EditScopeDialog({
    visible,
    title,
    excludeThisAndFuture,
    onSelect,
    onClose,
}: EditScopeDialogProps) {
    const handlePick = (scope: EditScope) => {
        Haptics.selectionAsync();
        onSelect(scope);
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <Pressable
                onPress={onClose}
                style={{
                    flex: 1,
                    backgroundColor: "rgba(0,0,0,0.45)",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 24,
                }}
            >
                <Pressable
                    onPress={() => undefined}
                    style={{
                        width: "100%",
                        maxWidth: 360,
                        backgroundColor: "#ffffff",
                        borderRadius: 18,
                        padding: 18,
                    }}
                >
                    <Text style={{ fontSize: 16, fontWeight: "700", color: "#0f172a", textAlign: "center" }}>
                        {title}
                    </Text>

                    <View style={{ marginTop: 16, gap: 8 }}>
                        <ScopeOption
                            label="Apenas esta ocorrência"
                            description="Mantém as demais como estão"
                            onPress={() => handlePick("only_this")}
                        />
                        {!excludeThisAndFuture && (
                            <ScopeOption
                                label="Esta e futuras"
                                description="Encerra a série atual e cria uma nova"
                                onPress={() => handlePick("this_and_future")}
                            />
                        )}
                        <ScopeOption
                            label="Toda a série"
                            description="Aplica a todas as ocorrências"
                            onPress={() => handlePick("whole_series")}
                        />
                    </View>

                    <Pressable
                        onPress={onClose}
                        style={({ pressed }) => ({
                            marginTop: 14,
                            paddingVertical: 10,
                            alignItems: "center",
                            borderRadius: 10,
                            opacity: pressed ? 0.6 : 1,
                        })}
                    >
                        <Text style={{ fontSize: 14, fontWeight: "600", color: "#64748b" }}>Cancelar</Text>
                    </Pressable>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

function ScopeOption({
    label,
    description,
    onPress,
}: {
    label: string;
    description: string;
    onPress: () => void;
}) {
    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => ({
                paddingVertical: 12,
                paddingHorizontal: 14,
                borderRadius: 12,
                backgroundColor: "#f8fafc",
                borderWidth: 1,
                borderColor: "#e2e8f0",
                opacity: pressed ? 0.7 : 1,
            })}
        >
            <Text style={{ fontSize: 14, fontWeight: "600", color: "#0f172a" }}>{label}</Text>
            <Text style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{description}</Text>
        </Pressable>
    );
}
