import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useStudentSubscription } from "../../hooks/useStudentSubscription";
import {
    CreditCard,
    Calendar,
    Tag,
    CircleDot,
    ChevronRight,
    Clock,
    AlertTriangle,
    FileText,
} from "lucide-react-native";

const intervalLabels: Record<string, string> = {
    month: "/mês",
    quarter: "/trimestre",
    year: "/ano",
};

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    active: { label: "Ativo", color: "#34d399", bg: "rgba(52,211,153,0.1)" },
    past_due: { label: "Pendente", color: "#fbbf24", bg: "rgba(251,191,36,0.1)" },
    canceled: { label: "Cancelado", color: "#f87171", bg: "rgba(239,68,68,0.1)" },
};

const billingTypeLabels: Record<string, string> = {
    stripe_auto: "Automático (Stripe)",
    manual_recurring: "Manual",
    manual_one_off: "Avulso",
    courtesy: "Cortesia",
};

function formatCurrency(value: number): string {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
    }).format(value);
}

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("pt-BR", {
        day: "numeric",
        month: "long",
        year: "numeric",
    });
}

export default function SubscriptionScreen() {
    const router = useRouter();
    const { contract, isLoading } = useStudentSubscription();

    if (isLoading) {
        return (
            <>
                <Stack.Screen options={{ title: "Minha Assinatura" }} />
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                    <ActivityIndicator color="#8b5cf6" />
                    <Text style={{ color: "#64748b", marginTop: 12, fontSize: 13 }}>
                        Carregando...
                    </Text>
                </View>
            </>
        );
    }

    if (!contract) {
        return (
            <>
                <Stack.Screen options={{ title: "Minha Assinatura" }} />
                <View
                    style={{
                        flex: 1,
                        alignItems: "center",
                        justifyContent: "center",
                        paddingHorizontal: 32,
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
                        <FileText size={28} color="#64748b" strokeWidth={1.5} />
                    </View>
                    <Text
                        style={{
                            fontSize: 16,
                            fontWeight: "700",
                            color: "#e2e8f0",
                            marginBottom: 6,
                        }}
                    >
                        Nenhuma assinatura
                    </Text>
                    <Text
                        style={{
                            fontSize: 13,
                            color: "#64748b",
                            textAlign: "center",
                            lineHeight: 20,
                        }}
                    >
                        Você não possui uma assinatura ativa no momento.
                    </Text>
                </View>
            </>
        );
    }

    const status = statusConfig[contract.status] || statusConfig.canceled;
    const billingLabel = billingTypeLabels[contract.billing_type] || contract.billing_type;
    const isCourtesy = contract.billing_type === "courtesy";

    return (
        <>
            <Stack.Screen options={{ title: "Minha Assinatura" }} />
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40 }}
                showsVerticalScrollIndicator={false}
            >
                {/* Plan Overview Card */}
                <View
                    style={{
                        backgroundColor: "#1A1A2E",
                        borderRadius: 16,
                        padding: 24,
                        alignItems: "center",
                        marginBottom: 20,
                    }}
                >
                    <Text
                        style={{
                            fontSize: 18,
                            fontWeight: "700",
                            color: "#f1f5f9",
                            marginBottom: 8,
                            textAlign: "center",
                        }}
                    >
                        {contract.plan?.title || "Plano"}
                    </Text>

                    {isCourtesy ? (
                        <Text
                            style={{
                                fontSize: 24,
                                fontWeight: "800",
                                color: "#34d399",
                            }}
                        >
                            Cortesia
                        </Text>
                    ) : (
                        <View style={{ flexDirection: "row", alignItems: "baseline" }}>
                            <Text
                                style={{
                                    fontSize: 28,
                                    fontWeight: "800",
                                    color: "#f1f5f9",
                                }}
                            >
                                {formatCurrency(contract.amount)}
                            </Text>
                            <Text
                                style={{
                                    fontSize: 14,
                                    color: "#64748b",
                                    marginLeft: 4,
                                }}
                            >
                                {intervalLabels[contract.plan?.interval || "month"] || "/mês"}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Details Card */}
                <View
                    style={{
                        backgroundColor: "#1A1A2E",
                        borderRadius: 16,
                        overflow: "hidden",
                        marginBottom: 20,
                    }}
                >
                    {/* Status */}
                    <DetailRow
                        icon={<CircleDot size={20} color={status.color} strokeWidth={1.5} />}
                        label="Status"
                        value={
                            <View
                                style={{
                                    backgroundColor: status.bg,
                                    paddingHorizontal: 10,
                                    paddingVertical: 4,
                                    borderRadius: 8,
                                }}
                            >
                                <Text
                                    style={{
                                        fontSize: 12,
                                        fontWeight: "700",
                                        color: status.color,
                                    }}
                                >
                                    {status.label}
                                </Text>
                            </View>
                        }
                    />

                    <Divider />

                    {/* Billing Type */}
                    <DetailRow
                        icon={<Tag size={20} color="#64748b" strokeWidth={1.5} />}
                        label="Tipo de Cobrança"
                        value={
                            <Text style={{ fontSize: 13, fontWeight: "600", color: "#cbd5e1" }}>
                                {billingLabel}
                            </Text>
                        }
                    />

                    {/* Next Billing */}
                    {contract.current_period_end && contract.status === "active" && (
                        <>
                            <Divider />
                            <DetailRow
                                icon={<Calendar size={20} color="#64748b" strokeWidth={1.5} />}
                                label="Próxima Cobrança"
                                value={
                                    <Text
                                        style={{
                                            fontSize: 13,
                                            fontWeight: "600",
                                            color: "#cbd5e1",
                                        }}
                                    >
                                        {formatDate(contract.current_period_end)}
                                    </Text>
                                }
                            />
                        </>
                    )}

                    {/* Cancel at period end warning */}
                    {contract.cancel_at_period_end && (
                        <>
                            <Divider />
                            <View
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    paddingVertical: 14,
                                    paddingHorizontal: 20,
                                    gap: 12,
                                    backgroundColor: "rgba(251,191,36,0.05)",
                                }}
                            >
                                <AlertTriangle size={18} color="#fbbf24" strokeWidth={1.5} />
                                <Text
                                    style={{
                                        fontSize: 12,
                                        color: "#fbbf24",
                                        flex: 1,
                                        lineHeight: 18,
                                    }}
                                >
                                    Assinatura será cancelada ao final do período atual.
                                </Text>
                            </View>
                        </>
                    )}
                </View>

                {/* Payment History Link */}
                <TouchableOpacity
                    onPress={() => router.push("/profile/payment-history")}
                    activeOpacity={0.6}
                    style={{
                        backgroundColor: "#1A1A2E",
                        borderRadius: 16,
                        flexDirection: "row",
                        alignItems: "center",
                        paddingVertical: 16,
                        paddingHorizontal: 20,
                    }}
                >
                    <View
                        style={{
                            height: 40,
                            width: 40,
                            borderRadius: 12,
                            backgroundColor: "rgba(255,255,255,0.04)",
                            alignItems: "center",
                            justifyContent: "center",
                            marginRight: 14,
                        }}
                    >
                        <Clock size={20} color="#64748b" strokeWidth={1.5} />
                    </View>
                    <Text
                        style={{
                            fontSize: 14,
                            fontWeight: "500",
                            color: "#cbd5e1",
                            flex: 1,
                        }}
                    >
                        Histórico de Pagamentos
                    </Text>
                    <ChevronRight size={16} color="#475569" strokeWidth={1.5} />
                </TouchableOpacity>
            </ScrollView>
        </>
    );
}

/* ─── Helper Components ─── */

function DetailRow({
    icon,
    label,
    value,
}: {
    icon: React.ReactNode;
    label: string;
    value: React.ReactNode;
}) {
    return (
        <View
            style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 14,
                paddingHorizontal: 20,
            }}
        >
            <View
                style={{
                    height: 40,
                    width: 40,
                    borderRadius: 12,
                    backgroundColor: "rgba(255,255,255,0.04)",
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 14,
                }}
            >
                {icon}
            </View>
            <Text
                style={{
                    fontSize: 13,
                    color: "#64748b",
                    flex: 1,
                }}
            >
                {label}
            </Text>
            {value}
        </View>
    );
}

function Divider() {
    return (
        <View
            style={{
                height: 1,
                backgroundColor: "rgba(255,255,255,0.04)",
                marginHorizontal: 20,
            }}
        />
    );
}
