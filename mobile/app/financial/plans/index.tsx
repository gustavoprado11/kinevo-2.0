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
    Alert,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, Stack } from "expo-router";
import { ChevronLeft, Search, Wallet, Plus } from "lucide-react-native";
import { useTrainerPlans, TrainerPlan } from "../../../hooks/useTrainerPlans";
import { PlanCard } from "../../../components/financial/PlanCard";
import { PlanFormSheet } from "../../../components/financial/PlanFormSheet";
import { EmptyState } from "../../../components/shared/EmptyState";

export default function PlansScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const {
        plans,
        isLoading,
        isRefreshing,
        refresh,
        togglePlan,
        deletePlan,
        createPlan,
        updatePlan,
    } = useTrainerPlans();

    const [search, setSearch] = useState("");
    const [togglingId, setTogglingId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [formVisible, setFormVisible] = useState(false);
    const [editingPlan, setEditingPlan] = useState<TrainerPlan | null>(null);

    const filteredPlans = plans.filter((p) =>
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        p.description?.toLowerCase().includes(search.toLowerCase())
    );

    const handleToggle = async (planId: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setTogglingId(planId);
        await togglePlan(planId);
        setTogglingId(null);
    };

    const handleDelete = (planId: string) => {
        Alert.alert(
            "Excluir plano",
            "Tem certeza que deseja excluir este plano?",
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Excluir",
                    style: "destructive",
                    onPress: async () => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        setDeletingId(planId);
                        await deletePlan(planId);
                        setDeletingId(null);
                    },
                },
            ]
        );
    };

    const handleEdit = (plan: TrainerPlan) => {
        setEditingPlan(plan);
        setFormVisible(true);
    };

    const handleCreate = () => {
        setEditingPlan(null);
        setFormVisible(true);
    };

    const renderItem = ({ item }: { item: TrainerPlan }) => (
        <PlanCard
            plan={item}
            onEdit={() => handleEdit(item)}
            onToggle={() => handleToggle(item.id)}
            onDelete={() => handleDelete(item.id)}
            isToggling={togglingId === item.id}
            isDeleting={deletingId === item.id}
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
                        Meus Planos
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
                            placeholder="Buscar planos..."
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

                {/* Plans List */}
                {isLoading ? (
                    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                        <ActivityIndicator color="#7c3aed" size="large" />
                    </View>
                ) : (
                    <FlatList
                        data={filteredPlans}
                        renderItem={renderItem}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 100 }}
                        showsVerticalScrollIndicator={false}
                        refreshControl={
                            <RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor="#7c3aed" />
                        }
                        ListEmptyComponent={
                            <EmptyState
                                icon={<Wallet size={40} color="#cbd5e1" />}
                                title={search ? "Nenhum plano encontrado" : "Nenhum plano criado"}
                                description={search ? "Tente ajustar o termo de busca" : "Crie seu primeiro plano para começar a cobrar"}
                            />
                        }
                    />
                )}

                {/* FAB - Create Plan */}
                <TouchableOpacity
                    onPress={handleCreate}
                    activeOpacity={0.8}
                    style={{
                        position: "absolute",
                        bottom: insets.bottom + 66,
                        right: 20,
                        width: 56,
                        height: 56,
                        borderRadius: 28,
                        backgroundColor: "#7c3aed",
                        alignItems: "center",
                        justifyContent: "center",
                        shadowColor: "#7c3aed",
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.3,
                        shadowRadius: 8,
                        elevation: 8,
                    }}
                >
                    <Plus size={26} color="#ffffff" strokeWidth={2.5} />
                </TouchableOpacity>
            </SafeAreaView>

            {/* Plan Form */}
            <PlanFormSheet
                visible={formVisible}
                onClose={() => { setFormVisible(false); setEditingPlan(null); }}
                onSubmit={createPlan}
                onUpdate={updatePlan}
                plan={editingPlan}
            />
        </>
    );
}
