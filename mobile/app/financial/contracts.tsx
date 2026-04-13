import React, { useState } from "react";
import * as Haptics from "expo-haptics";
import {
    View,
    Text,
    FlatList,
    TextInput,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, Stack } from "expo-router";
import { ChevronLeft, Search, FileText } from "lucide-react-native";
import { EmptyState } from "../../components/shared/EmptyState";
import { useTrainerContracts, ContractFilter } from "../../hooks/useTrainerContracts";
import { useTrainerPlans } from "../../hooks/useTrainerPlans";
import { useStripeStatus } from "../../hooks/useStripeStatus";
import { ContractCard } from "../../components/financial/ContractCard";
import { NewSubscriptionSheet } from "../../components/financial/NewSubscriptionSheet";
import type { FinancialStudent } from "../../types/financial";

const FILTERS: { key: ContractFilter; label: string }[] = [
    { key: "all", label: "Todos" },
    { key: "paying", label: "Pagantes" },
    { key: "courtesy", label: "Cortesia" },
    { key: "attention", label: "Atenção" },
    { key: "canceled", label: "Encerrados" },
];

export default function ContractsScreen() {
    const router = useRouter();
    const {
        contracts,
        counts,
        filter,
        setFilter,
        search,
        setSearch,
        isLoading,
        isRefreshing,
        refresh,
    } = useTrainerContracts();
    const { activePlans, refresh: refreshPlans } = useTrainerPlans();
    const { status: stripeStatus } = useStripeStatus();
    const [billingSheetVisible, setBillingSheetVisible] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState<FinancialStudent | null>(null);

    const hasStripeConnect = !!(stripeStatus?.connected && stripeStatus?.charges_enabled);

    const handleStudentPress = (item: FinancialStudent) => {
        if (item.contract_id) {
            router.push(`/financial/contract/${item.contract_id}` as any);
        } else {
            // No contract — open billing sheet to configure
            setSelectedStudent(item);
            setBillingSheetVisible(true);
        }
    };

    const renderItem = ({ item }: { item: FinancialStudent }) => (
        <ContractCard
            student={item}
            onPress={() => handleStudentPress(item)}
        />
    );

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
                        Assinaturas
                    </Text>

                    {/* Spacer */}
                    <View style={{ width: 24 }} />
                </View>
                {/* Search */}
                <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 }}>
                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            backgroundColor: "#ffffff",
                            borderRadius: 12,
                            paddingHorizontal: 12,
                            borderWidth: 1,
                            borderColor: "rgba(0,0,0,0.06)",
                        }}
                    >
                        <Search size={16} color="#94a3b8" />
                        <TextInput
                            value={search}
                            onChangeText={setSearch}
                            placeholder="Buscar por nome..."
                            placeholderTextColor="#94a3b8"
                            style={{
                                flex: 1,
                                paddingVertical: 10,
                                paddingHorizontal: 8,
                                fontSize: 14,
                                color: "#0f172a",
                            }}
                            returnKeyType="search"
                            autoCorrect={false}
                        />
                    </View>
                </View>

                {/* Filter Chips */}
                <View style={{ paddingHorizontal: 20, paddingVertical: 10 }}>
                    <FlatList
                        data={FILTERS}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        keyExtractor={(item) => item.key}
                        contentContainerStyle={{ gap: 8 }}
                        renderItem={({ item: f }) => {
                            const active = filter === f.key;
                            const count = counts[f.key];
                            return (
                                <TouchableOpacity
                                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setFilter(f.key); }}
                                    activeOpacity={0.7}
                                    style={{
                                        paddingHorizontal: 14,
                                        paddingVertical: 8,
                                        borderRadius: 100,
                                        backgroundColor: active ? "#7c3aed" : "#ffffff",
                                        borderWidth: active ? 0 : 1,
                                        borderColor: "rgba(0,0,0,0.08)",
                                    }}
                                >
                                    <Text
                                        style={{
                                            fontSize: 13,
                                            fontWeight: "600",
                                            color: active ? "#ffffff" : "#475569",
                                        }}
                                    >
                                        {f.label} {count > 0 ? `(${count})` : ""}
                                    </Text>
                                </TouchableOpacity>
                            );
                        }}
                    />
                </View>

                {/* Contract List */}
                {isLoading ? (
                    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                        <ActivityIndicator color="#7c3aed" size="large" />
                    </View>
                ) : (
                    <FlatList
                        data={contracts}
                        renderItem={renderItem}
                        keyExtractor={(item) => item.student_id}
                        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
                        showsVerticalScrollIndicator={false}
                        refreshControl={
                            <RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor="#7c3aed" />
                        }
                        ListEmptyComponent={
                            <EmptyState
                                icon={<FileText size={40} color="#cbd5e1" />}
                                title={search ? "Nenhum contrato encontrado" : "Nenhum contrato"}
                                description={search ? "Tente ajustar o termo de busca" : "Contratos aparecerão aqui quando criados"}
                            />
                        }
                    />
                )}
            </SafeAreaView>

            {/* Configure Billing Sheet */}
            <NewSubscriptionSheet
                visible={billingSheetVisible}
                onClose={() => { setBillingSheetVisible(false); setSelectedStudent(null); }}
                onSuccess={() => {
                    refresh();
                    refreshPlans();
                    setBillingSheetVisible(false);
                    setSelectedStudent(null);
                }}
                plans={activePlans}
                hasStripeConnect={hasStripeConnect}
                preSelectedStudent={selectedStudent ? {
                    id: selectedStudent.student_id,
                    name: selectedStudent.student_name,
                    avatar_url: selectedStudent.avatar_url,
                } : null}
            />
        </>
    );
}
