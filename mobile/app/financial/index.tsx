import React, { useState } from "react";
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Stack } from "expo-router";
import {
    ChevronLeft,
    ArrowRight,
    DollarSign,
    Users,
    Heart,
    AlertTriangle,
    Wallet,
    Plus,
} from "lucide-react-native";
import { useFinancialDashboard } from "../../hooks/useFinancialDashboard";
import { useStripeStatus } from "../../hooks/useStripeStatus";
import { useTrainerPlans } from "../../hooks/useTrainerPlans";
import { EmptyState } from "../../components/shared/EmptyState";
import { StatCard } from "../../components/trainer/StatCard";
import { StripeStatusCard } from "../../components/financial/StripeStatusCard";
import { TransactionRow } from "../../components/financial/TransactionRow";
import { NewSubscriptionSheet } from "../../components/financial/NewSubscriptionSheet";

function formatCurrency(value: number): string {
    return `R$ ${value.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
}

export default function FinancialDashboardScreen() {
    const router = useRouter();
    const { data, isLoading, isRefreshing, refresh } = useFinancialDashboard();
    const { status: stripeStatus, isLoading: stripeLoading } = useStripeStatus();
    const { activePlans, refresh: refreshPlans } = useTrainerPlans();

    const [subscriptionModalVisible, setSubscriptionModalVisible] = useState(false);

    const hasStripeConnect = !!(stripeStatus?.connected && stripeStatus?.charges_enabled);

    const handleNewSubscription = () => {
        setSubscriptionModalVisible(true);
    };

    const handleSubscriptionSuccess = () => {
        refresh();
        refreshPlans();
    };

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <SafeAreaView style={{ flex: 1, backgroundColor: "#F2F2F7" }} edges={["top"]}>
                {/* Custom Header */}
                <View style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                }}>
                    <TouchableOpacity
                        onPress={() => router.back()}
                        accessibilityRole="button"
                        accessibilityLabel="Voltar"
                        hitSlop={12}
                    >
                        <ChevronLeft size={24} color="#0f172a" />
                    </TouchableOpacity>

                    <Text style={{ fontSize: 18, fontWeight: "700", color: "#0f172a" }}>
                        Financeiro
                    </Text>

                    <TouchableOpacity
                        onPress={handleNewSubscription}
                        activeOpacity={0.7}
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            backgroundColor: "#7c3aed",
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            borderRadius: 100,
                            gap: 4,
                        }}
                    >
                        <Plus size={14} color="#ffffff" strokeWidth={2.5} />
                        <Text style={{ fontSize: 13, fontWeight: "600", color: "#ffffff" }}>
                            Nova Cobrança
                        </Text>
                    </TouchableOpacity>
                </View>
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

                        {/* Quick Actions: Plans + Contracts */}
                        <View style={{ flexDirection: "row", gap: 12, marginBottom: 20 }}>
                            {/* Plans card */}
                            <TouchableOpacity
                                onPress={() => router.push("/financial/plans" as any)}
                                activeOpacity={0.7}
                                style={{
                                    flex: 1,
                                    backgroundColor: "#ffffff",
                                    borderRadius: 16,
                                    padding: 16,
                                    borderWidth: 1,
                                    borderColor: "rgba(0,0,0,0.04)",
                                }}
                            >
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                                    <Wallet size={14} color="#64748b" />
                                    <Text style={{ fontSize: 13, fontWeight: "600", color: "#0f172a" }}>Planos</Text>
                                </View>
                                <Text style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>
                                    {activePlans.length === 0
                                        ? "Nenhum plano criado"
                                        : `${activePlans.length} plano${activePlans.length > 1 ? "s" : ""} ativo${activePlans.length > 1 ? "s" : ""}`}
                                </Text>
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                                    <Text style={{ fontSize: 12, fontWeight: "600", color: "#7c3aed" }}>Gerenciar</Text>
                                    <ArrowRight size={12} color="#7c3aed" />
                                </View>
                            </TouchableOpacity>

                            {/* Contracts card */}
                            <TouchableOpacity
                                onPress={() => router.push("/financial/contracts" as any)}
                                activeOpacity={0.7}
                                style={{
                                    flex: 1,
                                    backgroundColor: "#ffffff",
                                    borderRadius: 16,
                                    padding: 16,
                                    borderWidth: 1,
                                    borderColor: "rgba(0,0,0,0.04)",
                                }}
                            >
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                                    <Users size={14} color="#64748b" />
                                    <Text style={{ fontSize: 13, fontWeight: "600", color: "#0f172a" }}>Assinaturas</Text>
                                </View>
                                <Text style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>
                                    {(data?.payingCount || 0) === 0
                                        ? "Nenhum aluno pagante"
                                        : `${data?.payingCount} aluno${(data?.payingCount || 0) > 1 ? "s" : ""} pagante${(data?.payingCount || 0) > 1 ? "s" : ""}`}
                                </Text>
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                                    <Text style={{ fontSize: 12, fontWeight: "600", color: "#7c3aed" }}>Gerenciar</Text>
                                    <ArrowRight size={12} color="#7c3aed" />
                                </View>
                            </TouchableOpacity>
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

                    </ScrollView>
                )}
            </SafeAreaView>

            {/* New Subscription Modal */}
            <NewSubscriptionSheet
                visible={subscriptionModalVisible}
                onClose={() => setSubscriptionModalVisible(false)}
                onSuccess={handleSubscriptionSuccess}
                plans={activePlans}
                hasStripeConnect={hasStripeConnect}
            />
        </>
    );
}
