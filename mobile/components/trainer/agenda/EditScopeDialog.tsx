import React from "react";
import { View, Text, Modal, Pressable } from "react-native";
import * as Haptics from "expo-haptics";
import { useV2Colors, type V2Palette } from "../../../hooks/useV2Colors";

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
    const colors = useV2Colors();
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
                        backgroundColor: colors.surface.card,
                        borderRadius: 18,
                        padding: 18,
                    }}
                >
                    <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text.primary, textAlign: "center" }}>
                        {title}
                    </Text>

                    <View style={{ marginTop: 16, gap: 8 }}>
                        <ScopeOption
                            colors={colors}
                            label="Apenas esta ocorrência"
                            description="Mantém as demais como estão"
                            onPress={() => handlePick("only_this")}
                        />
                        {!excludeThisAndFuture && (
                            <ScopeOption
                                colors={colors}
                                label="Esta e futuras"
                                description="Encerra a série atual e cria uma nova"
                                onPress={() => handlePick("this_and_future")}
                            />
                        )}
                        <ScopeOption
                            colors={colors}
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
                        <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text.tertiary }}>Cancelar</Text>
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
    colors,
}: {
    label: string;
    description: string;
    onPress: () => void;
    colors: V2Palette;
}) {
    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => ({
                paddingVertical: 12,
                paddingHorizontal: 14,
                borderRadius: 12,
                backgroundColor: colors.surface.card2,
                borderWidth: 1,
                borderColor: colors.border.default,
                opacity: pressed ? 0.7 : 1,
            })}
        >
            <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text.primary }}>{label}</Text>
            <Text style={{ fontSize: 12, color: colors.text.tertiary, marginTop: 2 }}>{description}</Text>
        </Pressable>
    );
}
