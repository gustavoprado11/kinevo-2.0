import React from "react";
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Stack } from "expo-router";
import {
    ArrowLeft,
    DollarSign,
    Users,
    Heart,
    AlertTriangle,
    ChevronRight,
} from "lucide-react-native";
import { useFinancialDashboard } from "../../hooks/useFinancialDashboard";
import { useStripeStatus } from "../../hooks/useStripeStatus";
import { EmptyState } from "../../components/shared/EmptyState";
import { StatCard } from "../../components/trainer/StatCard";
import { StripeStatusCard } from "../../components/financial/StripeStatusCard";
import { TransactionRow } from "../../components/financial/TransactionRow";

function formatCurrency(value: number): string {
    return `R$ ${value.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
}

export default function FinancialDashboardScreen() {
    const router = useRouter();
    const { data, isLoading, isRefreshing, refresh } = useFinancialDashboard();
    const { status: stripeStatus, isLoading: stripeLoading } = useStripeStatus();

    return (
        <>
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: "Financeiro",
                    headerShadowVisible: false,
                    headerStyle: { backgroundColor: "#F2F2F7" },
                    headerTitleStyle: { fontSize: 17, fontWeight: "600", color: "#0f172a" },
                    headerLeft: () => (
                        <TouchableOpacity onPress={() => router.back()} hitSlop={8} accessibilityLabel="Voltar" accessibilityRole="button">
                            <ArrowLeft size={22} color="#0f172a" />
                        </TouchableOpacity>
                    ),
                }}
            />
            <SafeAreaView style={{ flex: 1, backgroundColor: "#F2F2F7" }} edges={["bottom"]}>
                {isLoading ? (
                    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                        <ActivityIndicator color="#7c3aed" size="large" />
                    </View>
                ) : (
                    <ScrollView
                        style={{ flex: 1 }}
                        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 100 }}
                        showsVerticalScrollIndicator={false}
                        refreshControl={
                            <RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor="#7c3aed" />
                        }
                    >
                        {/* KPIs Row 1 */}
                        <View style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
                            <StatCard
                                label="RECEITA DO MÊS"
                                value={formatCurrency(data?.monthlyRevenue || 0)}
                                icon={DollarSign}
                                iconColor="#16a34a"
                                iconBg="#f0fdf4"
                            />
                            <StatCard
                                label="PAGANTES"
                                value={data?.payingCount || 0}
                                icon={Users}
                                iconColor="#7c3aed"
                                iconBg="#f5f3ff"
                            />
                        </View>

                        {/* KPIs Row 2 */}
                        <View style={{ flexDirection: "row", gap: 12, marginBottom: 20 }}>
                            <StatCard
                                label="CORTESIA"
                                value={data?.courtesyCount || 0}
                                icon={Heart}
                                iconColor="#3b82f6"
                                iconBg="#eff6ff"
                            />
                            <StatCard
                                label="ATENÇÃO"
                                value={data?.attentionCount || 0}
                                icon={AlertTriangle}
                                iconColor="#ef4444"
                                iconBg="#fef2f2"
                            />
                        </View>

                        {/* Stripe Status */}
                        <Text style={{ fontSize: 11, fontWeight: "600", color: "#94a3b8", letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
                            STRIPE CONNECT
                        </Text>
                        <View style={{ marginBottom: 20 }}>
                            <StripeStatusCard status={stripeStatus} isLoading={stripeLoading} />
                        </View>

                        {/* Recent Transactions */}
                        <Text style={{ fontSize: 11, fontWeight: "600", color: "#94a3b8", letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
                            TRANSAÇÕES RECENTES
                        </Text>
                        <View
                            style={{
                                backgroundColor: "#ffffff",
                                borderRadius: 16,
                                overflow: "hidden",
                                borderWidth: 1,
                                borderColor: "rgba(0,0,0,0.04)",
                                marginBottom: 20,
                            }}
                        >
                            {data?.recentTransactions && data.recentTransactions.length > 0 ? (
                                data.recentTransactions.map((tx, idx) => (
                                    <View key={tx.id}>
                                        <TransactionRow transaction={tx} />
                                        {idx < data.recentTransactions.length - 1 && (
                                            <View style={{ height: 1, backgroundColor: "#f1f5f9", marginHorizontal: 16 }} />
                                        )}
                                    </View>
                                ))
                            ) : (
                                <View style={{ padding: 24, alignItems: "center" }}>
                                    <DollarSign size={32} color="#cbd5e1" style={{ marginBottom: 8 }} />
                                    <Text style={{ fontSize: 14, fontWeight: "600", color: "#94a3b8" }}>
                                        Nenhuma transação recente
                                    </Text>
                                    <Text style={{ fontSize: 12, color: "#cbd5e1", marginTop: 4 }}>
                                        Transações aparecerão aqui automaticamente
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* CTA: View all contracts */}
                        <TouchableOpacity
                            onPress={() => router.push("/financial/contracts" as any)}
                            activeOpacity={0.7}
                            style={{
                                backgroundColor: "#7c3aed",
                                borderRadius: 16,
                                paddingVertical: 16,
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 8,
                            }}
                        >
                            <Text style={{ fontSize: 15, fontWeight: "700", color: "#ffffff" }}>
                                Ver todos os contratos
                            </Text>
                            <ChevronRight size={18} color="#ffffff" />
                        </TouchableOpacity>
                    </ScrollView>
                )}
            </SafeAreaView>
        </>
    );
}
