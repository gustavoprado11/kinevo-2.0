import { useState, useEffect, useCallback } from "react";
import { View, Text, FlatList, ActivityIndicator } from "react-native";
import { Stack } from "expo-router";
import { supabase } from "../../lib/supabase";
import { useStudentProfile } from "../../hooks/useStudentProfile";
import { CreditCard } from "lucide-react-native";

interface Transaction {
    id: string;
    amount_gross: number;
    currency: string;
    type: string;
    status: string;
    description: string | null;
    created_at: string;
}

const statusConfig: Record<string, { label: string; color: string }> = {
    succeeded: { label: "Pago", color: "#34d399" },
    paid: { label: "Pago", color: "#34d399" },
    pending: { label: "Pendente", color: "#fbbf24" },
    failed: { label: "Falhou", color: "#f87171" },
    canceled: { label: "Cancelado", color: "#64748b" },
    refunded: { label: "Estornado", color: "#64748b" },
};

function formatCurrency(value: number, currency: string = "brl"): string {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: currency.toUpperCase(),
    }).format(value);
}

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("pt-BR", {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

export default function PaymentHistoryScreen() {
    const { profile } = useStudentProfile();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchTransactions = useCallback(async () => {
        if (!profile?.id) {
            setIsLoading(false);
            return;
        }

        try {
            const { data, error }: { data: any; error: any } = await supabase
                .from("financial_transactions" as any)
                .select("id, amount_gross, currency, type, status, description, created_at")
                .eq("student_id", profile.id)
                .order("created_at", { ascending: false });

            if (error) {
                console.error("[payment-history] Error:", error);
                return;
            }

            if (data) {
                setTransactions(
                    data.map((t: any) => ({
                        id: t.id,
                        amount_gross: t.amount_gross ?? 0,
                        currency: t.currency ?? "brl",
                        type: t.type ?? "subscription",
                        status: t.status ?? "pending",
                        description: t.description,
                        created_at: t.created_at,
                    }))
                );
            }
        } catch (err) {
            console.error("[payment-history] Error:", err);
        } finally {
            setIsLoading(false);
        }
    }, [profile?.id]);

    useEffect(() => {
        fetchTransactions();
    }, [fetchTransactions]);

    const renderTransaction = ({ item }: { item: Transaction }) => {
        const st = statusConfig[item.status] || statusConfig.pending;

        return (
            <View
                style={{
                    backgroundColor: "#1A1A2E",
                    borderRadius: 14,
                    padding: 16,
                    marginBottom: 10,
                }}
            >
                {/* Top row: description + amount */}
                <View
                    style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        marginBottom: 8,
                    }}
                >
                    <Text
                        style={{
                            fontSize: 14,
                            fontWeight: "600",
                            color: "#e2e8f0",
                            flex: 1,
                            marginRight: 12,
                        }}
                        numberOfLines={2}
                    >
                        {item.description || "Pagamento"}
                    </Text>
                    <Text
                        style={{
                            fontSize: 14,
                            fontWeight: "700",
                            color: "#f1f5f9",
                        }}
                    >
                        {formatCurrency(item.amount_gross, item.currency)}
                    </Text>
                </View>

                {/* Bottom row: date + status */}
                <View
                    style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                    }}
                >
                    <Text style={{ fontSize: 12, color: "#64748b" }}>
                        {formatDate(item.created_at)}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <View
                            style={{
                                width: 6,
                                height: 6,
                                borderRadius: 3,
                                backgroundColor: st.color,
                            }}
                        />
                        <Text
                            style={{
                                fontSize: 11,
                                fontWeight: "600",
                                color: st.color,
                            }}
                        >
                            {st.label}
                        </Text>
                    </View>
                </View>
            </View>
        );
    };

    if (isLoading) {
        return (
            <>
                <Stack.Screen options={{ title: "Histórico de Pagamentos" }} />
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                    <ActivityIndicator color="#8b5cf6" />
                    <Text style={{ color: "#64748b", marginTop: 12, fontSize: 13 }}>
                        Carregando...
                    </Text>
                </View>
            </>
        );
    }

    return (
        <>
            <Stack.Screen options={{ title: "Histórico de Pagamentos" }} />
            <FlatList
                data={transactions}
                keyExtractor={(item) => item.id}
                renderItem={renderTransaction}
                contentContainerStyle={{
                    paddingHorizontal: 20,
                    paddingTop: 24,
                    paddingBottom: 40,
                    ...(transactions.length === 0 && { flex: 1 }),
                }}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                    <View
                        style={{
                            flex: 1,
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <View
                            style={{
                                width: 64,
                                height: 64,
                                borderRadius: 32,
                                backgroundColor: "#1A1A2E",
                                alignItems: "center",
                                justifyContent: "center",
                                marginBottom: 16,
                            }}
                        >
                            <CreditCard size={28} color="#64748b" strokeWidth={1.5} />
                        </View>
                        <Text
                            style={{
                                fontSize: 14,
                                color: "#64748b",
                                textAlign: "center",
                            }}
                        >
                            Nenhum pagamento registrado.
                        </Text>
                    </View>
                }
            />
        </>
    );
}
