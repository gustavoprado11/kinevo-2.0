import React from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Linking } from "react-native";
import { CheckCircle, AlertTriangle, XCircle } from "lucide-react-native";
import type { StripeConnectStatus } from "../../types/financial";
import { useV2Colors } from "../../hooks/useV2Colors";

const STRIPE_DASHBOARD_URL = "https://dashboard.stripe.com";

interface Props {
    status: StripeConnectStatus | null;
    isLoading: boolean;
}

export function StripeStatusCard({ status, isLoading }: Props) {
    const colors = useV2Colors();
    if (isLoading) {
        return (
            <View
                style={{
                    backgroundColor: colors.surface.card,
                    borderRadius: 16,
                    padding: 16,
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: 60,
                }}
            >
                <ActivityIndicator color="#7c3aed" size="small" />
            </View>
        );
    }

    if (!status || !status.connected) {
        return (
            <TouchableOpacity
                onPress={() => Linking.openURL("https://app.kinevo.com.br/financial")}
                activeOpacity={0.7}
                style={{
                    backgroundColor: "rgba(239,68,68,0.12)",
                    borderRadius: 16,
                    padding: 16,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                }}
            >
                <XCircle size={20} color="#ef4444" />
                <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: "#ef4444" }}>
                        Stripe não conectado
                    </Text>
                    <Text style={{ fontSize: 12, color: "#ef4444", marginTop: 2 }}>
                        Configure pelo painel web para receber pagamentos
                    </Text>
                </View>
            </TouchableOpacity>
        );
    }

    if (!status.charges_enabled || !status.details_submitted) {
        return (
            <TouchableOpacity
                onPress={() => Linking.openURL(STRIPE_DASHBOARD_URL)}
                activeOpacity={0.7}
                style={{
                    backgroundColor: "rgba(245,158,11,0.12)",
                    borderRadius: 16,
                    padding: 16,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                }}
            >
                <AlertTriangle size={20} color="#f59e0b" />
                <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: "#f59e0b" }}>
                        Configuração pendente
                    </Text>
                    <Text style={{ fontSize: 12, color: "#f59e0b", marginTop: 2 }}>
                        Complete seu cadastro no Stripe para ativar cobranças
                    </Text>
                </View>
            </TouchableOpacity>
        );
    }

    return (
        <View
            style={{
                backgroundColor: "rgba(34,197,94,0.12)",
                borderRadius: 16,
                padding: 16,
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
            }}
        >
            <CheckCircle size={20} color="#16a34a" />
            <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: "600", color: "#16a34a" }}>
                    Stripe conectado
                </Text>
                <Text style={{ fontSize: 12, color: "#16a34a", marginTop: 2 }}>
                    Cobranças e pagamentos ativos
                </Text>
            </View>
        </View>
    );
}
