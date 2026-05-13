import React from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { ChevronLeft, Save } from "lucide-react-native";
import { useV2Colors } from "@/hooks/useV2Colors";

export interface ProgramBuilderCompactBarProps {
    /** Nome do programa pra exibir truncado no centro (1 linha). */
    programName: string;
    /** Placeholder quando programName está vazio. */
    placeholder?: string;
    onBack: () => void;
    onSave: () => void;
    isSaving?: boolean;
    /** Quando false, esconde o botão Salvar (ex.: tablet com layout próprio). */
    showSave?: boolean;
}

/**
 * Barra compacta sempre visível no topo do program-builder.
 *
 * O header full (nome, descrição, stats, workout selector, workout detail
 * header, hint) vive como `ListHeaderComponent` da DraggableFlatList e rola
 * com a lista — quando o trainer rola pra baixo, apenas esta barra continua
 * acessível, dando ~60-70% mais espaço pros cards de exercício.
 *
 * Layout: Voltar (esquerda) + Nome programa truncado (centro flex:1) +
 * Salvar pequeno (direita). Altura ~50pt, hairline border bottom.
 *
 * NÃO usa SafeAreaView porque o parent já aplica `paddingTop: insets.top`
 * no wrapper externo.
 */
export function ProgramBuilderCompactBar({
    programName,
    placeholder = "Sem nome",
    onBack,
    onSave,
    isSaving = false,
    showSave = true,
}: ProgramBuilderCompactBarProps) {
    const colors = useV2Colors();
    const trimmed = (programName || "").trim();
    const hasName = trimmed.length > 0;
    const displayName = hasName ? trimmed : placeholder;

    return (
        <View
            style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 12,
                paddingVertical: 8,
                minHeight: 50,
                backgroundColor: colors.surface.canvas,
                borderBottomWidth: 1,
                borderBottomColor: colors.border.subtle,
                gap: 8,
            }}
        >
            <TouchableOpacity
                onPress={onBack}
                accessibilityRole="button"
                accessibilityLabel="Voltar"
                hitSlop={8}
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 4,
                    paddingVertical: 6,
                    marginLeft: -4,
                }}
            >
                <ChevronLeft size={22} color={colors.purple[600]} />
            </TouchableOpacity>

            <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={{
                    flex: 1,
                    fontSize: 15,
                    fontWeight: "700",
                    color: hasName ? colors.text.primary : colors.text.tertiary,
                    letterSpacing: -0.2,
                }}
            >
                {displayName}
            </Text>

            {showSave && (
                <TouchableOpacity
                    onPress={onSave}
                    disabled={isSaving}
                    accessibilityRole="button"
                    accessibilityLabel="Salvar programa"
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        backgroundColor: colors.purple[600],
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 8,
                        opacity: isSaving ? 0.6 : 1,
                        gap: 4,
                    }}
                >
                    {isSaving ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                        <Save size={13} color="#FFFFFF" />
                    )}
                    <Text style={{ fontSize: 13, fontWeight: "600", color: "#FFFFFF" }}>
                        Salvar
                    </Text>
                </TouchableOpacity>
            )}
        </View>
    );
}
