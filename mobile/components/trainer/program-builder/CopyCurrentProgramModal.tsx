import React from "react";
import { Modal, View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { Copy } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useV2Colors } from "@/hooks/useV2Colors";

interface CopyCurrentProgramModalProps {
    visible: boolean;
    /** Nome do aluno para o corpo do texto (fallback "Este aluno"). */
    studentName: string | null;
    programName: string;
    workoutCount: number | null;
    durationWeeks: number | null;
    /** true = fonte é o programa ANTERIOR (aluno sem ativo) — muda os textos. */
    isPrevious?: boolean;
    /** Cópia em andamento: spinner no botão primário, ambos desabilitados. */
    copying: boolean;
    onStartBlank: () => void;
    onCopy: () => void;
}

/**
 * Escolha de partida ao criar um programa para aluno com programa ativo
 * (paridade com o modal do builder web): começar em branco × copiar o
 * programa atual como próximo ciclo. Sem dismiss por overlay — a escolha
 * é explícita, como no web.
 */
export function CopyCurrentProgramModal({
    visible,
    studentName,
    programName,
    workoutCount,
    durationWeeks,
    isPrevious = false,
    copying,
    onStartBlank,
    onCopy,
}: CopyCurrentProgramModalProps) {
    const colors = useV2Colors();

    const summary = [
        workoutCount != null
            ? `${workoutCount} ${workoutCount === 1 ? "treino" : "treinos"}`
            : null,
        durationWeeks != null
            ? `${durationWeeks} ${durationWeeks === 1 ? "semana" : "semanas"}`
            : null,
    ].filter(Boolean).join(" · ");

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onStartBlank}>
            <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 24 }}>
                <View
                    style={{
                        backgroundColor: colors.surface.card,
                        borderRadius: 16,
                        borderWidth: 1,
                        borderColor: colors.border.subtle,
                        padding: 20,
                    }}
                >
                    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                        <View
                            style={{
                                width: 36,
                                height: 36,
                                borderRadius: 10,
                                backgroundColor: colors.surface.card2,
                                borderWidth: 1,
                                borderColor: colors.border.subtle,
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <Copy size={17} color={colors.text.secondary} strokeWidth={1.75} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text.primary }}>
                                Como começar o novo programa?
                            </Text>
                            <Text style={{ marginTop: 4, fontSize: 13, lineHeight: 19, color: colors.text.secondary }}>
                                {isPrevious
                                    ? `${studentName || "Este aluno"} não tem um programa ativo, mas você pode partir do programa anterior e montar o próximo ciclo em cima do que ele executava.`
                                    : `${studentName || "Este aluno"} tem um programa ativo. Você pode partir dele e ajustar o próximo ciclo em cima do que já está sendo executado.`}
                            </Text>
                        </View>
                    </View>

                    <View
                        style={{
                            marginTop: 16,
                            backgroundColor: colors.surface.card2,
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: colors.border.subtle,
                            paddingHorizontal: 14,
                            paddingVertical: 11,
                        }}
                    >
                        <Text
                            style={{
                                fontSize: 11,
                                fontWeight: "700",
                                textTransform: "uppercase",
                                letterSpacing: 0.5,
                                color: colors.text.tertiary,
                            }}
                        >
                            {isPrevious ? "Programa anterior" : "Programa ativo"}
                        </Text>
                        <Text
                            numberOfLines={1}
                            style={{ marginTop: 4, fontSize: 14, fontWeight: "600", color: colors.text.primary }}
                        >
                            {programName}
                        </Text>
                        {summary.length > 0 && (
                            <Text style={{ marginTop: 2, fontSize: 12, color: colors.text.tertiary }}>
                                {summary}
                            </Text>
                        )}
                    </View>

                    <TouchableOpacity
                        disabled={copying}
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                            onCopy();
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={isPrevious ? "Copiar programa anterior" : "Copiar programa atual"}
                        style={{
                            marginTop: 18,
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 8,
                            backgroundColor: colors.purple[600],
                            borderRadius: 12,
                            paddingVertical: 13,
                            opacity: copying ? 0.85 : 1,
                        }}
                    >
                        {copying && <ActivityIndicator size="small" color="#ffffff" />}
                        <Text style={{ fontSize: 15, fontWeight: "600", color: "#ffffff" }}>
                            {copying
                                ? "Copiando programa…"
                                : isPrevious ? "Copiar programa anterior" : "Copiar programa atual"}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        disabled={copying}
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                            onStartBlank();
                        }}
                        accessibilityRole="button"
                        accessibilityLabel="Começar em branco"
                        style={{
                            marginTop: 10,
                            alignItems: "center",
                            justifyContent: "center",
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: colors.border.default,
                            paddingVertical: 13,
                            opacity: copying ? 0.5 : 1,
                        }}
                    >
                        <Text style={{ fontSize: 15, fontWeight: "500", color: colors.text.secondary }}>
                            Começar em branco
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}
