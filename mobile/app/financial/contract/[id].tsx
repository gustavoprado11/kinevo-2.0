import React, { useCallback, useState } from "react";
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Share,
    Image,
    Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams, Stack } from "expo-router";
import {
    ArrowLeft,
    DollarSign,
    Link as LinkIcon,
    Ban,
    MessageCircle,
    Calendar,
    CreditCard,
    AlertTriangle,
    Info,
} from "lucide-react-native";
import { supabase } from "../../../lib/supabase";
import { useContractDetail } from "../../../hooks/useContractDetail";
import { ContractTimeline } from "../../../components/financial/ContractTimeline";
import type { DisplayStatus } from "../../../types/financial";

const API_URL = process.env.EXPO_PUBLIC_WEB_URL || "https://app.kinevo.com.br";

const STATUS_CONFIG: Record<DisplayStatus, { bg: string; text: string; label: string }> = {
    courtesy: { bg: "#eff6ff", text: "#3b82f6", label: "Cortesia" },
    awaiting_payment: { bg: "#f0f9ff", text: "#0ea5e9", label: "Aguardando" },
    active: { bg: "#f0fdf4", text: "#16a34a", label: "Ativo" },
    grace_period: { bg: "#fff7ed", text: "#f97316", label: "Vence hoje" },
    canceling: { bg: "#fffbeb", text: "#f59e0b", label: "Cancelando" },
    overdue: { bg: "#fef2f2", text: "#ef4444", label: "Inadimplente" },
    canceled: { bg: "#f1f5f9", text: "#64748b", label: "Encerrado" },
};

const BILLING_LABELS: Record<string, string> = {
    stripe_auto: "Stripe (automático)",
    manual_recurring: "Manual recorrente",
    manual_one_off: "Avulso",
    courtesy: "Cortesia",
};

function formatCurrency(value: number | null): string {
    if (value === null || value === undefined) return "—";
    return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

function formatDate(dateStr: string | null): string {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("pt-BR", {
        day: "numeric",
        month: "long",
        year: "numeric",
    });
}

export default function ContractDetailScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const { student, events, isLoading, refresh } = useContractDetail(id || null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const getToken = useCallback(async () => {
        const { data } = await supabase.auth.getSession();
        return data?.session?.access_token || null;
    }, []);

    const handleMarkPaid = useCallback(async () => {
        if (!student?.contract_id) return;

        Alert.alert("Confirmar pagamento", "Deseja registrar o pagamento deste contrato?", [
            { text: "Cancelar", style: "cancel" },
            {
                text: "Confirmar",
                onPress: async () => {
                    setActionLoading("mark-paid");
                    try {
                        const token = await getToken();
                        if (!token) return;

                        const res = await fetch(`${API_URL}/api/financial/mark-paid`, {
                            method: "POST",
                            headers: {
                                Authorization: `Bearer ${token}`,
                                "Content-Type": "application/json",
                            },
                            body: JSON.stringify({ contractId: student.contract_id }),
                        });

                        const data = await res.json();
                        if (data.success) {
                            Alert.alert("Sucesso", "Pagamento registrado com sucesso.");
                            refresh();
                        } else {
                            Alert.alert("Erro", data.error || "Falha ao registrar pagamento");
                        }
                    } catch (err) {
                        Alert.alert("Erro", "Falha na conexão");
                    } finally {
                        setActionLoading(null);
                    }
                },
            },
        ]);
    }, [student, getToken, refresh]);

    const handleCheckoutLink = useCallback(async () => {
        if (!student?.student_id) return;

        setActionLoading("checkout");
        try {
            const token = await getToken();
            if (!token) return;

            // For now, we need to know the plan_id — we'll use the existing contract's plan
            // The checkout-link endpoint requires both studentId and planId
            // We don't have plan_id directly, but we can get it from the contract
            const res = await fetch(`${API_URL}/api/financial/checkout-link`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ studentId: student.student_id, planId: student.contract_id }),
            });

            const data = await res.json();
            if (data.success && data.url) {
                await Share.share({
                    message: `Link de pagamento: ${data.url}`,
                    url: data.url,
                });
            } else {
                Alert.alert("Erro", data.error || "Falha ao gerar link");
            }
        } catch (err) {
            Alert.alert("Erro", "Falha na conexão");
        } finally {
            setActionLoading(null);
        }
    }, [student, getToken]);

    const handleCancel = useCallback(async () => {
        if (!student?.contract_id) return;

        const isStripe = student.billing_type === "stripe_auto";

        if (isStripe) {
            // Stripe: 2 options
            Alert.alert("Cancelar contrato", "Como deseja cancelar este contrato Stripe?", [
                { text: "Voltar", style: "cancel" },
                {
                    text: "Ao fim do ciclo",
                    onPress: () => executeCancelContract(true),
                },
                {
                    text: "Imediatamente",
                    style: "destructive",
                    onPress: () => executeCancelContract(false),
                },
            ]);
        } else {
            // Manual: simple confirm
            Alert.alert("Cancelar contrato", "Tem certeza que deseja cancelar este contrato?", [
                { text: "Voltar", style: "cancel" },
                {
                    text: "Cancelar contrato",
                    style: "destructive",
                    onPress: () => executeCancelContract(false),
                },
            ]);
        }
    }, [student]);

    const executeCancelContract = useCallback(async (cancelAtPeriodEnd: boolean) => {
        if (!student?.contract_id) return;

        setActionLoading("cancel");
        try {
            const token = await getToken();
            if (!token) return;

            const res = await fetch(`${API_URL}/api/financial/cancel-contract`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    contractId: student.contract_id,
                    cancelAtPeriodEnd,
                }),
            });

            const data = await res.json();
            if (data.success) {
                const msg = data.scheduledCancellation
                    ? "Cancelamento agendado para o fim do ciclo."
                    : "Contrato cancelado com sucesso.";
                Alert.alert("Sucesso", msg);
                refresh();
            } else {
                Alert.alert("Erro", data.error || "Falha ao cancelar contrato");
            }
        } catch (err) {
            Alert.alert("Erro", "Falha na conexão");
        } finally {
            setActionLoading(null);
        }
    }, [student, getToken, refresh]);

    const handleWhatsApp = useCallback(() => {
        if (!student?.phone) {
            Alert.alert("Sem telefone", "Este aluno não possui telefone cadastrado.");
            return;
        }
        const phone = student.phone.replace(/\D/g, "");
        Linking.openURL(`https://wa.me/${phone}`);
    }, [student]);

    if (isLoading || !student) {
        return (
            <>
                <Stack.Screen
                    options={{
                        headerShown: true,
                        title: "Contrato",
                        headerShadowVisible: false,
                        headerStyle: { backgroundColor: "#F2F2F7" },
                        headerTitleStyle: { fontSize: 17, fontWeight: "600", color: "#0f172a" },
                        headerLeft: () => (
                            <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
                                <ArrowLeft size={22} color="#0f172a" />
                            </TouchableOpacity>
                        ),
                    }}
                />
                <SafeAreaView style={{ flex: 1, backgroundColor: "#F2F2F7", alignItems: "center", justifyContent: "center" }} edges={["bottom"]}>
                    {isLoading ? (
                        <ActivityIndicator color="#7c3aed" size="large" />
                    ) : (
                        <Text style={{ fontSize: 15, color: "#94a3b8" }}>Contrato não encontrado</Text>
                    )}
                </SafeAreaView>
            </>
        );
    }

    const statusCfg = STATUS_CONFIG[student.display_status] || STATUS_CONFIG.courtesy;
    const initials = student.student_name
        ?.split(" ")
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase() || "?";

    const isManual = student.billing_type === "manual_recurring" || student.billing_type === "manual_one_off";
    const showMarkPaid =
        isManual &&
        (student.display_status === "active" ||
            student.display_status === "grace_period" ||
            student.display_status === "overdue");

    const showWhatsApp =
        student.display_status === "grace_period" || student.display_status === "overdue";

    const showCheckoutLink = student.display_status === "awaiting_payment";
    const showCancel =
        student.display_status !== "canceled" &&
        student.display_status !== "courtesy" &&
        student.display_status !== "canceling";

    return (
        <>
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: student.student_name,
                    headerShadowVisible: false,
                    headerStyle: { backgroundColor: "#F2F2F7" },
                    headerTitleStyle: { fontSize: 17, fontWeight: "600", color: "#0f172a" },
                    headerLeft: () => (
                        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
                            <ArrowLeft size={22} color="#0f172a" />
                        </TouchableOpacity>
                    ),
                    headerRight: () => (
                        <View style={{ backgroundColor: statusCfg.bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100 }}>
                            <Text style={{ fontSize: 11, fontWeight: "700", color: statusCfg.text }}>{statusCfg.label}</Text>
                        </View>
                    ),
                }}
            />
            <SafeAreaView style={{ flex: 1, backgroundColor: "#F2F2F7" }} edges={["bottom"]}>
                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 100 }}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Student Info Card */}
                    <View
                        style={{
                            backgroundColor: "#ffffff",
                            borderRadius: 16,
                            padding: 20,
                            marginBottom: 16,
                            borderWidth: 1,
                            borderColor: "rgba(0,0,0,0.04)",
                        }}
                    >
                        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
                            {student.avatar_url ? (
                                <Image
                                    source={{ uri: student.avatar_url }}
                                    style={{ width: 52, height: 52, borderRadius: 16, marginRight: 14, backgroundColor: "#f1f5f9" }}
                                />
                            ) : (
                                <View
                                    style={{
                                        width: 52,
                                        height: 52,
                                        borderRadius: 16,
                                        backgroundColor: "#f5f3ff",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        marginRight: 14,
                                    }}
                                >
                                    <Text style={{ fontSize: 18, fontWeight: "700", color: "#7c3aed" }}>{initials}</Text>
                                </View>
                            )}
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 18, fontWeight: "700", color: "#0f172a" }}>
                                    {student.student_name}
                                </Text>
                                {student.plan_title && (
                                    <Text style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>
                                        {student.plan_title}
                                    </Text>
                                )}
                            </View>
                        </View>

                        {/* Details grid */}
                        <View style={{ gap: 10 }}>
                            <DetailRow
                                icon={DollarSign}
                                label="Valor"
                                value={formatCurrency(student.amount)}
                            />
                            <DetailRow
                                icon={CreditCard}
                                label="Cobrança"
                                value={student.billing_type ? BILLING_LABELS[student.billing_type] || student.billing_type : "—"}
                            />
                            {student.plan_interval && (
                                <DetailRow
                                    icon={Calendar}
                                    label="Intervalo"
                                    value={student.plan_interval === "month" ? "Mensal" : student.plan_interval === "quarter" ? "Trimestral" : "Anual"}
                                />
                            )}
                            {student.current_period_end && (
                                <DetailRow
                                    icon={Calendar}
                                    label="Vencimento"
                                    value={formatDate(student.current_period_end)}
                                />
                            )}
                            {student.stripe_subscription_id && (
                                <DetailRow
                                    icon={LinkIcon}
                                    label="Stripe ID"
                                    value={student.stripe_subscription_id.substring(0, 20) + "..."}
                                />
                            )}
                        </View>
                    </View>

                    {/* Canceling info */}
                    {student.display_status === "canceling" && (
                        <View
                            style={{
                                backgroundColor: "#fffbeb",
                                borderRadius: 12,
                                padding: 14,
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 10,
                                marginBottom: 16,
                            }}
                        >
                            <Info size={18} color="#f59e0b" />
                            <Text style={{ flex: 1, fontSize: 13, color: "#92400e", lineHeight: 18 }}>
                                Cancelamento agendado para o fim do ciclo atual
                                {student.current_period_end ? ` (${formatDate(student.current_period_end)})` : ""}.
                            </Text>
                        </View>
                    )}

                    {/* Actions */}
                    {(showMarkPaid || showCheckoutLink || showWhatsApp) && (
                        <View style={{ gap: 10, marginBottom: 16 }}>
                            {showMarkPaid && (
                                <ActionButton
                                    label="Marcar como pago"
                                    icon={DollarSign}
                                    color="#16a34a"
                                    bg="#f0fdf4"
                                    loading={actionLoading === "mark-paid"}
                                    onPress={handleMarkPaid}
                                />
                            )}
                            {showCheckoutLink && (
                                <ActionButton
                                    label="Gerar link de pagamento"
                                    icon={LinkIcon}
                                    color="#7c3aed"
                                    bg="#f5f3ff"
                                    loading={actionLoading === "checkout"}
                                    onPress={handleCheckoutLink}
                                />
                            )}
                            {showWhatsApp && (
                                <ActionButton
                                    label="Contatar via WhatsApp"
                                    icon={MessageCircle}
                                    color="#16a34a"
                                    bg="#f0fdf4"
                                    loading={false}
                                    onPress={handleWhatsApp}
                                />
                            )}
                        </View>
                    )}

                    {/* Cancel Contract */}
                    {showCancel && (
                        <TouchableOpacity
                            onPress={handleCancel}
                            disabled={actionLoading === "cancel"}
                            activeOpacity={0.7}
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 8,
                                paddingVertical: 14,
                                borderRadius: 14,
                                backgroundColor: "#fef2f2",
                                marginBottom: 20,
                            }}
                        >
                            {actionLoading === "cancel" ? (
                                <ActivityIndicator color="#ef4444" size="small" />
                            ) : (
                                <>
                                    <Ban size={16} color="#ef4444" />
                                    <Text style={{ fontSize: 14, fontWeight: "600", color: "#ef4444" }}>
                                        Cancelar contrato
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>
                    )}

                    {/* Timeline */}
                    <Text style={{ fontSize: 11, fontWeight: "600", color: "#94a3b8", letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>
                        HISTÓRICO
                    </Text>
                    <View
                        style={{
                            backgroundColor: "#ffffff",
                            borderRadius: 16,
                            padding: 16,
                            borderWidth: 1,
                            borderColor: "rgba(0,0,0,0.04)",
                        }}
                    >
                        <ContractTimeline events={events} isLoading={isLoading} />
                    </View>
                </ScrollView>
            </SafeAreaView>
        </>
    );
}

function DetailRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
    return (
        <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Icon size={14} color="#94a3b8" style={{ marginRight: 8 }} />
            <Text style={{ fontSize: 13, color: "#94a3b8", width: 90 }}>{label}</Text>
            <Text style={{ fontSize: 13, fontWeight: "500", color: "#0f172a", flex: 1 }}>{value}</Text>
        </View>
    );
}

function ActionButton({
    label,
    icon: Icon,
    color,
    bg,
    loading,
    onPress,
}: {
    label: string;
    icon: any;
    color: string;
    bg: string;
    loading: boolean;
    onPress: () => void;
}) {
    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={loading}
            activeOpacity={0.7}
            style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                paddingVertical: 14,
                borderRadius: 14,
                backgroundColor: bg,
            }}
        >
            {loading ? (
                <ActivityIndicator color={color} size="small" />
            ) : (
                <>
                    <Icon size={16} color={color} />
                    <Text style={{ fontSize: 14, fontWeight: "600", color }}>{label}</Text>
                </>
            )}
        </TouchableOpacity>
    );
}
