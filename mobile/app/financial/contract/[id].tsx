import React, { useCallback, useState } from "react";
import * as Haptics from "expo-haptics";
import { formatBRL } from "@/lib/currency";
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
    ChevronLeft,
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
import { walletFetch } from "../../../lib/wallet-api";
import { useContractDetail } from "../../../hooks/useContractDetail";
import { useTrainerPlans } from "../../../hooks/useTrainerPlans";
import { useWallet } from "../../../hooks/useWallet";
import { ContractTimeline } from "../../../components/financial/ContractTimeline";
import { NewSubscriptionSheet } from "../../../components/financial/NewSubscriptionSheet";
import type { DisplayStatus } from "../../../types/financial";
import { useV2Colors } from "../../../hooks/useV2Colors";
import { parseAnchoredDate } from "@kinevo/shared/utils/format-br-date";

const API_URL = process.env.EXPO_PUBLIC_WEB_URL || "https://www.kinevoapp.com";

const STATUS_CONFIG: Record<DisplayStatus, { bg: string; text: string; label: string }> = {
    courtesy: { bg: "#eff6ff", text: "#3b82f6", label: "Cortesia" },
    awaiting_payment: { bg: "#f0f9ff", text: "#0ea5e9", label: "Aguardando" },
    active: { bg: "#f0fdf4", text: "#16a34a", label: "Ativo" },
    grace_period: { bg: "#fff7ed", text: "#f97316", label: "Vence hoje" },
    canceling: { bg: "#fffbeb", text: "#f59e0b", label: "Cancelando" },
    overdue: { bg: "#fef2f2", text: "#ef4444", label: "Inadimplente" },
    canceled: { bg: "#f1f5f9", text: "#64748b", label: "Encerrado" },
    expired: { bg: "#fef2f2", text: "#ef4444", label: "Expirado" },
};

const BILLING_LABELS: Record<string, string> = {
    asaas_auto: "Carteira (avulsa)",
    asaas_auto_recurring: "Carteira (assinatura)",
    stripe_auto: "Stripe (automático)",
    manual_recurring: "Manual recorrente",
    manual_one_off: "Avulso",
    courtesy: "Cortesia",
};

function formatCurrency(value: number | null): string {
    if (value === null || value === undefined) return "—";
    return formatBRL(value);
}

function formatDate(dateStr: string | null): string {
    if (!dateStr) return "—";
    // Vencimento Asaas é gravado à meia-noite UTC — new Date() cru exibia o
    // dia ANTERIOR em BRT. parseAnchoredDate re-ancora ao meio-dia UTC.
    const date = parseAnchoredDate(dateStr);
    if (!date) return "—";
    return date.toLocaleDateString("pt-BR", {
        day: "numeric",
        month: "long",
        year: "numeric",
    });
}

export default function ContractDetailScreen() {
    const colors = useV2Colors();
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const { student, contract, events, isLoading, error, refresh } = useContractDetail(id || null);
    const { activePlans, refresh: refreshPlans } = useTrainerPlans();
    const { summary: wallet } = useWallet();
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [billingSheetVisible, setBillingSheetVisible] = useState(false);

    const walletApproved = wallet?.status === "approved";

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
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
        if (!student?.student_id || !student?.contract_id) return;

        setActionLoading("checkout");
        try {
            const token = await getToken();
            if (!token) return;

            // O checkout-link exige o plan_id real (trainer_plans.id). O contrato guarda
            // esse vínculo em student_contracts.plan_id — resolver antes de chamar.
            const { data: contractRow } = await (supabase as any)
                .from("student_contracts")
                .select("plan_id")
                .eq("id", student.contract_id)
                .single();
            const planId = contractRow?.plan_id as string | undefined;
            if (!planId) {
                Alert.alert("Erro", "Não foi possível identificar o plano deste contrato.");
                return;
            }

            const res = await fetch(`${API_URL}/api/financial/checkout-link`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ studentId: student.student_id, planId }),
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

    // Re-compartilha o Payment Link Asaas existente (busca a URL viva no backend).
    const handleShareAsaasLink = useCallback(async () => {
        if (!student?.contract_id) return;
        setActionLoading("share-link");
        try {
            const data = await walletFetch<{ url: string | null }>(`/api/wallet/charges/${student.contract_id}`);
            if (data.url) {
                await Share.share({ message: `Link de pagamento Kinevo: ${data.url}`, url: data.url });
            } else {
                Alert.alert("Link indisponível", "Não encontramos um link ativo. Gere uma nova cobrança para este aluno.");
            }
        } catch (err) {
            Alert.alert("Erro", err instanceof Error ? err.message : "Falha ao buscar o link");
        } finally {
            setActionLoading(null);
        }
    }, [student]);

    // Verifica na Asaas se a cobrança já foi paga (fallback caso o webhook não chegue).
    const handleSyncAsaas = useCallback(async () => {
        if (!student?.contract_id) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setActionLoading("sync");
        try {
            const data = await walletFetch<{ synced: boolean; status: string; message?: string }>(
                `/api/wallet/charges/${student.contract_id}/sync`,
                { method: "POST" },
            );
            if (data.synced) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert("Pagamento confirmado", "A cobrança foi marcada como paga.");
                refresh();
            } else {
                Alert.alert("Ainda não consta pago", data.message || "Não recebemos a confirmação ainda. Tente de novo em alguns minutos.");
            }
        } catch (err) {
            Alert.alert("Erro", err instanceof Error ? err.message : "Falha ao verificar pagamento");
        } finally {
            setActionLoading(null);
        }
    }, [student, refresh]);

    // Cancela uma cobrança Asaas pendente (desativa o Payment Link).
    const executeCancelAsaasCharge = useCallback(async () => {
        if (!student?.contract_id) return;
        setActionLoading("cancel");
        try {
            await walletFetch(`/api/wallet/charges/${student.contract_id}`, { method: "DELETE" });
            Alert.alert("Cobrança cancelada", "O link de pagamento foi desativado.");
            refresh();
        } catch (err) {
            Alert.alert("Erro", err instanceof Error ? err.message : "Falha ao cancelar a cobrança");
        } finally {
            setActionLoading(null);
        }
    }, [student, refresh]);

    const handleCancel = useCallback(async () => {
        if (!student?.contract_id) return;

        // Cobrança Asaas pendente → desativa o Payment Link via Carteira.
        const isAsaasCharge = contract?.provider === "asaas" || (contract?.billing_type ?? "").startsWith("asaas");
        if (isAsaasCharge && contract?.status === "pending_payment") {
            Alert.alert("Cancelar cobrança", "Desativar o link de pagamento desta cobrança?", [
                { text: "Voltar", style: "cancel" },
                { text: "Cancelar cobrança", style: "destructive", onPress: executeCancelAsaasCharge },
            ]);
            return;
        }

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
    }, [student, contract, executeCancelAsaasCharge]);

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
                <Stack.Screen options={{ headerShown: false }} />
                <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.canvas }} edges={["top"]}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 }}>
                        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
                            <ChevronLeft size={24} color={colors.text.primary} />
                        </TouchableOpacity>
                        <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text.primary }}>Contrato</Text>
                        <View style={{ width: 24 }} />
                    </View>
                    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
                        {isLoading ? (
                            <ActivityIndicator color={colors.purple[600]} size="large" />
                        ) : error ? (
                            <>
                                <Text style={{ fontSize: 15, color: colors.text.tertiary, textAlign: "center" }}>
                                    {error}
                                </Text>
                                <TouchableOpacity onPress={() => void refresh()} hitSlop={12} style={{ marginTop: 12 }}>
                                    <Text style={{ fontSize: 15, fontWeight: "600", color: colors.purple[600] }}>
                                        Tentar de novo
                                    </Text>
                                </TouchableOpacity>
                            </>
                        ) : (
                            <Text style={{ fontSize: 15, color: colors.text.tertiary }}>Contrato não encontrado</Text>
                        )}
                    </View>
                </SafeAreaView>
            </>
        );
    }

    // Dados Asaas vêm do contrato real (a RPC não os expõe e classifica
    // pending_payment como cortesia). Corrigimos o status efetivo aqui.
    const isAsaasContract = contract?.provider === "asaas" || (contract?.billing_type ?? "").startsWith("asaas");
    const isAsaasAwaiting = isAsaasContract && contract?.status === "pending_payment";
    const effectiveStatus: DisplayStatus = isAsaasAwaiting ? "awaiting_payment" : student.display_status;

    const statusCfg = STATUS_CONFIG[effectiveStatus] || STATUS_CONFIG.courtesy;
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

    // Cobrança Asaas aguardando pagamento → re-compartilhar link + verificar.
    const showAsaasCharge = isAsaasAwaiting;
    // Stripe legado aguardando → checkout Stripe (fluxo antigo).
    const showStripeCheckout = !isAsaasContract && student.display_status === "awaiting_payment";
    const showCancel =
        effectiveStatus !== "canceled" &&
        effectiveStatus !== "courtesy" &&
        effectiveStatus !== "canceling";

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.canvas }} edges={["top"]}>
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
                        <ChevronLeft size={24} color={colors.text.primary} />
                    </TouchableOpacity>

                    <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text.primary }} numberOfLines={1}>
                        {student.student_name}
                    </Text>

                    <View style={{ backgroundColor: statusCfg.bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100 }}>
                        <Text style={{ fontSize: 11, fontWeight: "700", color: statusCfg.text }}>{statusCfg.label}</Text>
                    </View>
                </View>

                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 100 }}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Student Info Card */}
                    <View
                        style={{
                            backgroundColor: colors.surface.card,
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
                                    style={{ width: 52, height: 52, borderRadius: 16, marginRight: 14, backgroundColor: colors.surface.card2 }}
                                />
                            ) : (
                                <View
                                    style={{
                                        width: 52,
                                        height: 52,
                                        borderRadius: 16,
                                        backgroundColor: colors.purple[100],
                                        alignItems: "center",
                                        justifyContent: "center",
                                        marginRight: 14,
                                    }}
                                >
                                    <Text style={{ fontSize: 18, fontWeight: "700", color: colors.purple[600] }}>{initials}</Text>
                                </View>
                            )}
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text.primary }}>
                                    {student.student_name}
                                </Text>
                                {student.plan_title && (
                                    <Text style={{ fontSize: 13, color: colors.text.secondary, marginTop: 2 }}>
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

                    {/* Configure Billing - for courtesy or canceled students */}
                    {(effectiveStatus === "courtesy" || effectiveStatus === "canceled") && (
                        <TouchableOpacity
                            onPress={() => setBillingSheetVisible(true)}
                            activeOpacity={0.7}
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 8,
                                paddingVertical: 16,
                                borderRadius: 14,
                                backgroundColor: colors.purple[600],
                                marginBottom: 16,
                            }}
                        >
                            <CreditCard size={18} color="#ffffff" />
                            <Text style={{ fontSize: 15, fontWeight: "700", color: "#ffffff" }}>
                                Configurar Cobrança
                            </Text>
                        </TouchableOpacity>
                    )}

                    {/* Canceling info */}
                    {student.display_status === "canceling" && (
                        <View
                            style={{
                                backgroundColor: colors.semantic.warning.bg,
                                borderRadius: 12,
                                padding: 14,
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 10,
                                marginBottom: 16,
                            }}
                        >
                            <Info size={18} color="#f59e0b" />
                            <Text style={{ flex: 1, fontSize: 13, color: colors.semantic.warning.fg, lineHeight: 18 }}>
                                Cancelamento agendado para o fim do ciclo atual
                                {student.current_period_end ? ` (${formatDate(student.current_period_end)})` : ""}.
                            </Text>
                        </View>
                    )}

                    {/* Actions */}
                    {(showMarkPaid || showAsaasCharge || showStripeCheckout || showWhatsApp) && (
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
                            {showAsaasCharge && (
                                <>
                                    <ActionButton
                                        label="Compartilhar link de pagamento"
                                        icon={LinkIcon}
                                        color={colors.purple[600]}
                                        bg={colors.purple[100]}
                                        loading={actionLoading === "share-link"}
                                        onPress={handleShareAsaasLink}
                                    />
                                    <ActionButton
                                        label="Já paguei? Verificar"
                                        icon={DollarSign}
                                        color="#0ea5e9"
                                        bg="#f0f9ff"
                                        loading={actionLoading === "sync"}
                                        onPress={handleSyncAsaas}
                                    />
                                </>
                            )}
                            {showStripeCheckout && (
                                <ActionButton
                                    label="Gerar link de pagamento"
                                    icon={LinkIcon}
                                    color={colors.purple[600]}
                                    bg={colors.purple[100]}
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
                                backgroundColor: colors.semantic.danger.bg,
                                marginBottom: 20,
                            }}
                        >
                            {actionLoading === "cancel" ? (
                                <ActivityIndicator color="#ef4444" size="small" />
                            ) : (
                                <>
                                    <Ban size={16} color="#ef4444" />
                                    <Text style={{ fontSize: 14, fontWeight: "600", color: colors.semantic.danger.default }}>
                                        Cancelar contrato
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>
                    )}

                    {/* Timeline */}
                    <Text style={{ fontSize: 11, fontWeight: "600", color: colors.text.tertiary, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>
                        HISTÓRICO
                    </Text>
                    <View
                        style={{
                            backgroundColor: colors.surface.card,
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

            {/* Configure Billing Sheet */}
            <NewSubscriptionSheet
                visible={billingSheetVisible}
                onClose={() => setBillingSheetVisible(false)}
                onSuccess={() => {
                    refresh();
                    refreshPlans();
                }}
                plans={activePlans}
                walletApproved={walletApproved}
                preSelectedStudent={student ? {
                    id: student.student_id,
                    name: student.student_name,
                    avatar_url: student.avatar_url,
                } : null}
            />
        </>
    );
}

function DetailRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
    const colors = useV2Colors();
    return (
        <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Icon size={14} color={colors.text.tertiary} style={{ marginRight: 8 }} />
            <Text style={{ fontSize: 13, color: colors.text.tertiary, width: 90 }}>{label}</Text>
            <Text style={{ fontSize: 13, fontWeight: "500", color: colors.text.primary, flex: 1 }}>{value}</Text>
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
