import React from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Linking } from "react-native";
import { CheckCircle, AlertTriangle, XCircle } from "lucide-react-native";
import type { StripeConnectStatus } from "../../types/financial";

const STRIPE_DASHBOARD_URL = "https://dashboard.stripe.com";

interface Props {
    status: StripeConnectStatus | null;
    isLoading: boolean;
}

export function StripeStatusCard({ status, isLoading }: Props) {
    if (isLoading) {
        return (
            <View
                style={{
                    backgroundColor: "#ffffff",
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
                    backgroundColor: "#fef2f2",
                    borderRadius: 16,
                    padding: 16,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                }}
            >
                <XCircle size={20} color="#ef4444" />
                <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: "#991b1b" }}>
                        Stripe não conectado
                    </Text>
                    <Text style={{ fontSize: 12, color: "#b91c1c", marginTop: 2 }}>
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
                    backgroundColor: "#fffbeb",
                    borderRadius: 16,
                    padding: 16,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                }}
            >
                <AlertTriangle size={20} color="#f59e0b" />
                <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: "#92400e" }}>
                        Configuração pendente
                    </Text>
                    <Text style={{ fontSize: 12, color: "#a16207", marginTop: 2 }}>
                        Complete seu cadastro no Stripe para ativar cobranças
                    </Text>
                </View>
            </TouchableOpacity>
        );
    }

    return (
        <View
            style={{
                backgroundColor: "#f0fdf4",
                borderRadius: 16,
                padding: 16,
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
            }}
        >
            <CheckCircle size={20} color="#16a34a" />
            <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: "600", color: "#166534" }}>
                    Stripe conectado
                </Text>
                <Text style={{ fontSize: 12, color: "#15803d", marginTop: 2 }}>
                    Cobranças e pagamentos ativos
                </Text>
            </View>
        </View>
    );
}
