// ============================================================================
// FeesSimulationCard — quanto o trainer recebe líquido por método (mobile)
// ============================================================================
// Porta RN do card homônimo do web. Pega o valor da cobrança + métodos aceitos
// e roda simulateNet (fonte única em @kinevo/shared/lib/asaas/fees).
// ============================================================================

import React from "react";
import { View, Text } from "react-native";
import { Sparkles } from "lucide-react-native";
import {
    simulateNet,
    formatBRL,
    PAYMENT_METHOD_LABELS,
    type PaymentMethod,
} from "@kinevo/shared/lib/asaas/fees";
import { useV2Colors } from "../../hooks/useV2Colors";
import { toRgba } from "../../lib/brandColor";

interface FeesSimulationCardProps {
    /** Valor da cobrança em BRL. */
    value: number;
    /** Métodos a simular. */
    methods: PaymentMethod[];
    /** Título do card. Default: "Você recebe líquido". */
    title?: string;
}

export function FeesSimulationCard({ value, methods, title = "Você recebe líquido" }: FeesSimulationCardProps) {
    const colors = useV2Colors();

    if (!Number.isFinite(value) || value <= 0) {
        return (
            <View style={{
                borderRadius: 12,
                borderWidth: 1,
                borderStyle: "dashed",
                borderColor: colors.border.default,
                padding: 14,
                alignItems: "center",
            }}>
                <Text style={{ fontSize: 12, color: colors.text.quaternary, textAlign: "center" }}>
                    Informe o valor para ver quanto você recebe líquido em cada método.
                </Text>
            </View>
        );
    }

    const rows = methods.map((m) => simulateNet(value, m));

    return (
        <View style={{
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border.subtle,
            backgroundColor: toRgba(colors.purple[600], 0.05),
            padding: 14,
        }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <Sparkles size={13} color={colors.purple[600]} />
                <Text style={{ fontSize: 11, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase", color: colors.text.tertiary }}>
                    {title}
                </Text>
            </View>
            {rows.map((r, idx) => (
                <View
                    key={r.method}
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                        marginBottom: idx < rows.length - 1 ? 7 : 0,
                    }}
                >
                    <Text style={{ fontSize: 13, color: colors.text.secondary }}>
                        {PAYMENT_METHOD_LABELS[r.method]}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
                        <Text style={{ fontSize: 11, color: colors.text.quaternary, fontVariant: ["tabular-nums"] }}>
                            taxa {formatBRL(r.asaasFee)}
                        </Text>
                        <Text style={{ fontSize: 13, fontWeight: "700", color: colors.semantic.success.fg, fontVariant: ["tabular-nums"] }}>
                            {formatBRL(r.trainerNet)}
                        </Text>
                    </View>
                </View>
            ))}
        </View>
    );
}
