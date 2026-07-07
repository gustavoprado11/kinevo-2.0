import { useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView, Alert } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useStudentSubscription } from "../../hooks/useStudentSubscription";
import { supabase } from "../../lib/supabase";
import {
    CreditCard,
    Calendar,
    Tag,
    CircleDot,
    ChevronRight,
    Clock,
    AlertTriangle,
    FileText,
    XCircle,
} from "lucide-react-native";
import { useV2Colors } from "../../hooks/useV2Colors";
import { formatBRL as formatCurrency } from "@/lib/currency";

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL || "https://www.kinevoapp.com";

const intervalLabels: Record<string, string> = {
    month: "/mês",
    quarter: "/trimestre",
    year: "/ano",
};

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    active: { label: "Ativo", color: "#34d399", bg: "rgba(52,211,153,0.1)" },
    past_due: { label: "Pendente", color: "#fbbf24", bg: "rgba(251,191,36,0.1)" },
    pending_payment: { label: "Aguardando pagamento", color: "#fbbf24", bg: "rgba(251,191,36,0.1)" },
    canceled: { label: "Cancelado", color: "#f87171", bg: "rgba(239,68,68,0.1)" },
};

const billingTypeLabels: Record<string, string> = {
    stripe_auto: "Automático (Stripe)",
    manual_recurring: "Manual",
    manual_one_off: "Avulso",
    courtesy: "Cortesia",
    asaas_auto: "Cobrança (Asaas)",
    asaas_auto_recurring: "Automático (cartão)",
};

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("pt-BR", {
        day: "numeric",
        month: "long",
        year: "numeric",
    });
}

export default function SubscriptionScreen() {
    const colors = useV2Colors();
    const router = useRouter();
    const { contract, isLoading, refresh } = useStudentSubscription();
    const [isCanceling, setIsCanceling] = useState(false);

    const canCancel =
        contract &&
        contract.billing_type === "stripe_auto" &&
        !contract.cancel_at_period_end &&
        contract.status === "active";

    async function handleCancelSubscription() {
        if (!contract) return;

        const periodEndLabel = contract.current_period_end
            ? formatDate(contract.current_period_end)
            : "o final do período atual";

        Alert.alert(
            "Cancelar Assinatura?",
            `A sua assinatura não será renovada, mas você continuará com acesso normal ao aplicativo até o dia ${periodEndLabel}.`,
            [
                { text: "Voltar", style: "cancel" },
                {
                    text: "Sim, Cancelar",
                    style: "destructive",
                    onPress: () => performCancellation(),
                },
            ]
        );
    }

    async function performCancellation() {
        if (!contract) return;
        setIsCanceling(true);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
                Alert.alert("Erro", "Sessão expirada. Faça login novamente.");
                return;
            }

            const res = await fetch(`${WEB_URL}/api/stripe/cancel-subscription`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ contract_id: contract.id }),
            });

            const data = await res.json();

            if (!res.ok) {
                Alert.alert("Erro", data.error || "Não foi possível cancelar a assinatura.");
                return;
            }

            Alert.alert(
                "Cancelamento Programado",
                "Sua assinatura não será renovada. Você mantém o acesso até o final do período pago."
            );
            refresh();
        } catch {
            Alert.alert("Erro de Conexão", "Verifique sua conexão e tente novamente.");
        } finally {
            setIsCanceling(false);
        }
    }

    if (isLoading) {
        return (
            <>
                <Stack.Screen options={{ title: "Minha Assinatura" }} />
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                    <ActivityIndicator color={colors.purple[500]} />
                    <Text style={{ color: colors.text.tertiary, marginTop: 12, fontSize: 13 }}>
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
                        backgroundColor: colors.surface.canvas,
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
                            backgroundColor: colors.neutral[100],
                            alignItems: "center",
                            justifyContent: "center",
                            marginBottom: 16,
                        }}
                    >
                        <FileText size={28} color="#94a3b8" strokeWidth={1.5} />
                    </View>
                    <Text
                        style={{
                            fontSize: 16,
                            fontWeight: "700",
                            color: colors.text.primary,
                            marginBottom: 6,
                        }}
                    >
                        Nenhuma assinatura
                    </Text>
                    <Text
                        style={{
                            fontSize: 13,
                            color: colors.text.tertiary,
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
                style={{ flex: 1, backgroundColor: colors.surface.canvas }}
                contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40 }}
                showsVerticalScrollIndicator={false}
            >
                {/* Plan Overview Card */}
                <View
                    style={{
                        backgroundColor: colors.surface.card,
                        borderRadius: 16,
                        padding: 24,
                        alignItems: "center",
                        marginBottom: 20,
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.05,
                        shadowRadius: 2,
                        elevation: 2,
                    }}
                >
                    <Text
                        style={{
                            fontSize: 18,
                            fontWeight: "700",
                            color: colors.text.primary,
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
                                    color: colors.text.primary,
                                }}
                            >
                                {formatCurrency(contract.amount)}
                            </Text>
                            <Text
                                style={{
                                    fontSize: 14,
                                    color: colors.text.tertiary,
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
                        backgroundColor: colors.surface.card,
                        borderRadius: 16,
                        overflow: "hidden",
                        marginBottom: 20,
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.05,
                        shadowRadius: 2,
                        elevation: 2,
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
                            <Text style={{ fontSize: 13, fontWeight: "600", color: colors.text.primary }}>
                                {billingLabel}
                            </Text>
                        }
                    />

                    {/* Next Billing */}
                    {contract.current_period_end && contract.status === "active" && !contract.cancel_at_period_end && (
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
                                            color: colors.text.primary,
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
                                    {contract.current_period_end
                                        ? `Cancelamento programado para ${formatDate(contract.current_period_end)}. Acesso mantido até esta data.`
                                        : "Assinatura será cancelada ao final do período atual."}
                                </Text>
                            </View>
                        </>
                    )}
                </View>

                {/* Pagar agora (P13): contrato aguardando pagamento/atrasado
                     tem caminho direto pro checkout in-app — antes esta tela
                     nem mostrava contratos pending_payment. */}
                {(contract.status === "pending_payment" || contract.status === "past_due") && (
                    <TouchableOpacity
                        onPress={() => router.push("/payment")}
                        activeOpacity={0.85}
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 8,
                            backgroundColor: colors.purple[600],
                            borderRadius: 16,
                            paddingVertical: 16,
                            marginBottom: 20,
                        }}
                    >
                        <CreditCard size={18} color="#ffffff" strokeWidth={2} />
                        <Text style={{ fontSize: 15, fontWeight: "700", color: "#ffffff" }}>Pagar agora</Text>
                    </TouchableOpacity>
                )}

                {/* Payment History Link */}
                <TouchableOpacity
                    onPress={() => router.push("/profile/payment-history")}
                    activeOpacity={0.6}
                    style={{
                        backgroundColor: colors.surface.card,
                        borderRadius: 16,
                        flexDirection: "row",
                        alignItems: "center",
                        paddingVertical: 16,
                        paddingHorizontal: 20,
                        marginBottom: canCancel ? 20 : 0,
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.05,
                        shadowRadius: 2,
                        elevation: 2,
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
                            color: colors.text.primary,
                            flex: 1,
                        }}
                    >
                        Histórico de Pagamentos
                    </Text>
                    <ChevronRight size={16} color="#94a3b8" strokeWidth={1.5} />
                </TouchableOpacity>

                {/* Cancel Subscription Button */}
                {canCancel && (
                    <TouchableOpacity
                        onPress={handleCancelSubscription}
                        disabled={isCanceling}
                        activeOpacity={0.6}
                        style={{
                            borderRadius: 16,
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            paddingVertical: 16,
                            paddingHorizontal: 20,
                            gap: 8,
                            borderWidth: 1,
                            borderColor: "rgba(239,68,68,0.3)",
                            backgroundColor: "rgba(239,68,68,0.04)",
                        }}
                    >
                        {isCanceling ? (
                            <ActivityIndicator size="small" color="#ef4444" />
                        ) : (
                            <>
                                <XCircle size={18} color="#ef4444" strokeWidth={1.5} />
                                <Text
                                    style={{
                                        fontSize: 14,
                                        fontWeight: "600",
                                        color: "#ef4444",
                                    }}
                                >
                                    Cancelar Assinatura
                                </Text>
                            </>
                        )}
                    </TouchableOpacity>
                )}
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
    const colors = useV2Colors();
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
                    backgroundColor: colors.neutral[100],
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
                    color: colors.text.tertiary,
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
    const colors = useV2Colors();
    return (
        <View
            style={{
                height: 1,
                backgroundColor: colors.neutral[100],
                marginHorizontal: 20,
            }}
        />
    );
}
