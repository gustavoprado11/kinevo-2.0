import React, { useState } from "react";
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, Stack } from "expo-router";
import * as Haptics from "expo-haptics";
import {
    ChevronLeft,
    ArrowRight,
    ArrowDownToLine,
    Send,
    Link2,
    Check,
    DollarSign,
    Users,
    Heart,
    AlertTriangle,
    Wallet,
    Repeat,
    KeyRound,
    Settings as SettingsIcon,
    Clock,
} from "lucide-react-native";
import type { KinevoWalletStatus } from "@kinevo/shared/types/asaas";
import { useFinancialDashboard } from "../../hooks/useFinancialDashboard";
import { useStripeStatus } from "../../hooks/useStripeStatus";
import { useTrainerPlans } from "../../hooks/useTrainerPlans";
import { useWallet } from "../../hooks/useWallet";
import { useWalletBalance } from "../../hooks/useWalletBalance";
import { useHasStripeLegacy } from "../../hooks/useHasStripeLegacy";
import { StatCard } from "../../components/trainer/StatCard";
import { StripeStatusCard } from "../../components/financial/StripeStatusCard";
import { TransactionRow } from "../../components/financial/TransactionRow";
import { NewSubscriptionSheet } from "../../components/financial/NewSubscriptionSheet";
import { AttentionCard } from "../../components/financial/AttentionCard";
import { PendingChargeRow } from "../../components/financial/PendingChargeRow";
import { AwaitingPayoutBanner } from "../../components/financial/AwaitingPayoutBanner";
import { useV2Colors, type V2Palette } from "../../hooks/useV2Colors";
import { toRgba } from "../../lib/brandColor";
import type { FinancialTransaction } from "../../types/financial";
import type { PendingCharge } from "../../hooks/useFinancialDashboard";
import { formatBRL } from "@/lib/currency";

const NON_APPROVED_COPY: Record<Exclude<KinevoWalletStatus, "approved">, { label: string; desc: string }> = {
    not_started: { label: "Carteira não ativada", desc: "Ative para receber via PIX, cartão e boleto direto no app." },
    pending: { label: "Carteira em análise", desc: "A Asaas está analisando seus dados (1 a 3 dias úteis)." },
    awaiting: { label: "Carteira em análise", desc: "A Asaas está analisando seus documentos. Avisamos quando liberar." },
    rejected: { label: "Carteira reprovada", desc: "A análise não foi aprovada. Confira os detalhes e tente novamente." },
    blocked: { label: "Carteira bloqueada", desc: "Sua carteira está suspensa por compliance. Fale com o suporte." },
};

export default function FinancialDashboardScreen() {
    const colors = useV2Colors();
    const router = useRouter();
    const { data, attentionStudents, pendingCharges, awaitingPayouts, isLoading, isRefreshing, refresh } = useFinancialDashboard();
    const { status: stripeStatus, isLoading: stripeLoading } = useStripeStatus();
    const { activePlans, refresh: refreshPlans } = useTrainerPlans();
    const { summary: wallet, refresh: refreshWallet } = useWallet();
    const { hasLegacy } = useHasStripeLegacy();

    const walletApproved = wallet?.status === "approved";
    const balance = useWalletBalance(walletApproved);

    const [subscriptionModalVisible, setSubscriptionModalVisible] = useState(false);
    const [feedVisibleCount, setFeedVisibleCount] = useState(15);

    const payingCount = data?.payingCount ?? 0;
    const courtesyCount = data?.courtesyCount ?? 0;
    const attentionCount = data?.attentionCount ?? 0;
    const plansCount = activePlans.length;

    // Feed unificado: transações + cobranças pendentes, ordenado por data (igual web).
    const feedAll: Array<{ key: string; created: string; kind: "tx" | "pending"; tx?: FinancialTransaction; charge?: PendingCharge }> = [
        ...(data?.recentTransactions ?? []).map((tx) => ({ key: tx.id, created: tx.created_at, kind: "tx" as const, tx })),
        ...pendingCharges.map((c) => ({ key: `pending-${c.contractId}`, created: c.createdAt, kind: "pending" as const, charge: c })),
    ]
        .sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
    // Paginação incremental ("Ver mais") — antes cortava em 15 fixo e cobranças
    // pendentes além disso sumiam da visão do treinador.
    const feed = feedAll.slice(0, feedVisibleCount);
    const hasMoreFeed = feedAll.length > feedVisibleCount;

    const onRefresh = () => {
        refresh();
        refreshPlans();
        refreshWallet();
        if (walletApproved) balance.refresh();
    };

    const openCharge = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setSubscriptionModalVisible(true);
    };

    const handleSubscriptionSuccess = () => {
        refresh();
        refreshPlans();
    };

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.canvas }} edges={["top"]}>
                {/* Header */}
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 }}>
                    <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Voltar" hitSlop={12}>
                        <ChevronLeft size={24} color={colors.text.primary} />
                    </TouchableOpacity>
                    <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text.primary }}>Financeiro</Text>
                    <View style={{ width: 24 }} />
                </View>

                {isLoading ? (
                    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                        <ActivityIndicator color={colors.purple[600]} size="large" />
                    </View>
                ) : (
                    <ScrollView
                        style={{ flex: 1 }}
                        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 100 }}
                        showsVerticalScrollIndicator={false}
                        refreshControl={<RefreshControl refreshing={isRefreshing || balance.isRefreshing} onRefresh={onRefresh} tintColor={colors.purple[600]} />}
                    >
                        {/* Subtítulo */}
                        <Text style={{ fontSize: 13, color: colors.text.tertiary, marginBottom: 16 }}>
                            Receba, cobre e controle tudo num lugar só.
                        </Text>

                        {/* HERO: Carteira */}
                        {walletApproved ? (
                            <View style={{ backgroundColor: toRgba(colors.purple[600], 0.06), borderWidth: 1, borderColor: toRgba(colors.purple[600], 0.15), borderRadius: 20, padding: 20, marginBottom: 20 }}>
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 }}>
                                    <Text style={{ fontSize: 12, fontWeight: "500", color: colors.text.secondary }}>Saldo disponível</Text>
                                    {wallet?.mode === "linked" ? (
                                        <View style={{ flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "rgba(100,116,139,0.15)", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 100 }}>
                                            <Link2 size={9} color={colors.text.secondary} />
                                            <Text style={{ fontSize: 10, fontWeight: "600", color: colors.text.secondary }}>Conta vinculada</Text>
                                        </View>
                                    ) : (
                                        <View style={{ flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "rgba(16,185,129,0.15)", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 100 }}>
                                            <Check size={9} color="#047857" strokeWidth={3} />
                                            <Text style={{ fontSize: 10, fontWeight: "600", color: "#047857" }}>Carteira ativa</Text>
                                        </View>
                                    )}
                                </View>
                                {balance.isLoading ? (
                                    <ActivityIndicator color={colors.purple[600]} style={{ alignSelf: "flex-start", marginVertical: 8 }} />
                                ) : (
                                    <Text style={{ fontSize: 34, fontWeight: "800", color: colors.text.primary, marginTop: 2, letterSpacing: -0.5 }}>
                                        {balance.balance !== null ? formatBRL(balance.available) : "—"}
                                    </Text>
                                )}
                                <TouchableOpacity onPress={() => router.push("/financial/wallet" as never)} activeOpacity={0.7} style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 }}>
                                    <Text style={{ fontSize: 12, color: colors.text.tertiary }}>Ver detalhes da Carteira</Text>
                                    <ArrowRight size={11} color={colors.text.tertiary} />
                                </TouchableOpacity>

                                <View style={{ gap: 10, marginTop: 16 }}>
                                    <TouchableOpacity
                                        onPress={openCharge}
                                        activeOpacity={0.85}
                                        style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.purple[600], borderRadius: 14, paddingVertical: 14 }}
                                    >
                                        <Send size={16} color="#ffffff" />
                                        <Text style={{ fontSize: 15, fontWeight: "700", color: "#ffffff" }}>Cobrar aluno</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => {
                                            if ((balance.available ?? 0) <= 0) return;
                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                            router.push("/financial/wallet/payout" as never);
                                        }}
                                        activeOpacity={(balance.available ?? 0) > 0 ? 0.7 : 1}
                                        style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.surface.card, borderWidth: 1, borderColor: colors.border.default, borderRadius: 14, paddingVertical: 14, opacity: (balance.available ?? 0) > 0 ? 1 : 0.5 }}
                                    >
                                        <ArrowDownToLine size={16} color={(balance.available ?? 0) > 0 ? colors.text.primary : colors.text.quaternary} />
                                        <Text style={{ fontSize: 15, fontWeight: "700", color: (balance.available ?? 0) > 0 ? colors.text.primary : colors.text.quaternary }}>Sacar via PIX</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : (
                            <NonApprovedWalletCard status={wallet?.status ?? "not_started"} colors={colors} onPress={() => router.push("/financial/wallet" as never)} />
                        )}

                        {/* Banner: saques aguardando confirmação SMS */}
                        <AwaitingPayoutBanner payouts={awaitingPayouts} onChanged={onRefresh} />

                        {/* Stripe Connect (legado) */}
                        {hasLegacy ? (
                            <>
                                <Text style={{ fontSize: 11, fontWeight: "600", color: colors.text.tertiary, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
                                    Stripe Connect (legado)
                                </Text>
                                <View style={{ marginBottom: 20 }}>
                                    <StripeStatusCard status={stripeStatus} isLoading={stripeLoading} />
                                </View>
                            </>
                        ) : null}

                        {/* Stats grid — células simétricas (flex:1) pra rows alinharem */}
                        <View style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
                            <View style={{ flex: 1 }}>
                                <StatCard label="Receita do mês" value={formatBRL(data?.monthlyRevenue ?? 0)} icon={DollarSign} iconColor="#16a34a" iconBg="#f0fdf4" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <StatCard label="Alunos pagantes" value={payingCount} icon={Users} iconColor={colors.purple[600]} iconBg={colors.purple[100]} />
                            </View>
                        </View>
                        <View style={{ flexDirection: "row", gap: 12, marginBottom: 20 }}>
                            <View style={{ flex: 1 }}>
                                <StatCard label="Cortesias" value={courtesyCount} icon={Heart} iconColor="#3b82f6" iconBg="#eff6ff" />
                            </View>
                            <TouchableOpacity
                                style={{ flex: 1 }}
                                activeOpacity={attentionCount > 0 ? 0.7 : 1}
                                onPress={() => { if (attentionCount > 0) router.push("/financial/contracts" as never); }}
                            >
                                <StatCard label="Precisam de atenção" value={attentionCount} icon={AlertTriangle} iconColor={attentionCount > 0 ? "#ef4444" : "#16a34a"} iconBg={attentionCount > 0 ? "#fef2f2" : "#f0fdf4"} />
                            </TouchableOpacity>
                        </View>

                        {/* Atividade recente */}
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                            <Text style={{ fontSize: 11, fontWeight: "600", color: colors.text.tertiary, letterSpacing: 1, textTransform: "uppercase" }}>
                                Atividade recente
                            </Text>
                            <Text style={{ fontSize: 11, color: colors.text.quaternary }}>últimos pagamentos e saques</Text>
                        </View>
                        <View style={{ backgroundColor: colors.surface.card, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: colors.border.subtle, marginBottom: 20 }}>
                            {feed.length > 0 ? (
                                feed.map((item, idx) => (
                                    <View key={item.key}>
                                        {item.kind === "tx" && item.tx ? (
                                            <TransactionRow transaction={item.tx} />
                                        ) : item.charge ? (
                                            <PendingChargeRow charge={item.charge} onChanged={onRefresh} />
                                        ) : null}
                                        {idx < feed.length - 1 && (
                                            <View style={{ height: 1, backgroundColor: colors.surface.card2, marginHorizontal: 16 }} />
                                        )}
                                    </View>
                                ))
                            ) : null}
                            {hasMoreFeed && (
                                <TouchableOpacity
                                    onPress={() => setFeedVisibleCount((c) => c + 15)}
                                    activeOpacity={0.7}
                                    style={{ paddingVertical: 14, alignItems: "center" }}
                                >
                                    <Text style={{ fontSize: 14, fontWeight: "600", color: colors.brand.primary }}>Ver mais</Text>
                                </TouchableOpacity>
                            )}
                            {feed.length === 0 && (
                                <View style={{ padding: 24, alignItems: "center" }}>
                                    <DollarSign size={32} color="#cbd5e1" style={{ marginBottom: 8 }} />
                                    <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text.tertiary }}>Nenhuma transação ainda</Text>
                                    <Text style={{ fontSize: 12, color: colors.text.quaternary, marginTop: 4, textAlign: "center" }}>Conforme seus alunos pagarem, os recebimentos aparecem aqui.</Text>
                                </View>
                            )}
                        </View>

                        {/* Precisam de atenção */}
                        <AttentionCard students={attentionStudents} onChanged={onRefresh} />

                        {/* Atalhos */}
                        <View style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
                            <QuickLink colors={colors} icon={Wallet} title="Planos" detail={plansCount === 0 ? "Nenhum criado" : `${plansCount} ${plansCount === 1 ? "plano" : "planos"}`} onPress={() => router.push("/financial/plans" as never)} />
                            <QuickLink colors={colors} icon={Repeat} title="Assinaturas" detail={payingCount === 0 ? "Nenhuma ativa" : `${payingCount} ${payingCount === 1 ? "ativa" : "ativas"}`} onPress={() => router.push("/financial/contracts" as never)} />
                        </View>
                        <View style={{ flexDirection: "row", gap: 12, marginBottom: 20 }}>
                            <QuickLink colors={colors} icon={KeyRound} title="Chaves PIX" detail="Pra sacar" onPress={() => router.push("/financial/wallet/pix-keys" as never)} />
                            <QuickLink colors={colors} icon={SettingsIcon} title="Configurações" detail="Carteira, taxas…" onPress={() => router.push("/financial/settings" as never)} />
                        </View>

                    </ScrollView>
                )}
            </SafeAreaView>

            <NewSubscriptionSheet
                visible={subscriptionModalVisible}
                onClose={() => setSubscriptionModalVisible(false)}
                onSuccess={handleSubscriptionSuccess}
                plans={activePlans}
                walletApproved={walletApproved}
            />
        </>
    );
}

function NonApprovedWalletCard({ status, colors, onPress }: {
    status: KinevoWalletStatus;
    colors: V2Palette;
    onPress: () => void;
}) {
    const copy = status === "approved" ? null : NON_APPROVED_COPY[status];
    if (!copy) return null;
    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={{ backgroundColor: colors.surface.card, borderWidth: 1, borderColor: colors.border.default, borderRadius: 20, padding: 20, marginBottom: 20 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: status === "rejected" || status === "blocked" ? "#fef2f2" : colors.purple[100] }}>
                    {status === "pending" || status === "awaiting" ? (
                        <Clock size={22} color="#b45309" />
                    ) : (
                        <Wallet size={22} color={status === "rejected" || status === "blocked" ? "#ef4444" : colors.purple[600]} />
                    )}
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text.primary }}>{copy.label}</Text>
                    <Text style={{ fontSize: 13, color: colors.text.secondary, marginTop: 2, lineHeight: 18 }}>{copy.desc}</Text>
                </View>
                <ArrowRight size={18} color={colors.text.tertiary} />
            </View>
        </TouchableOpacity>
    );
}

function QuickLink({ colors, icon: Icon, title, detail, onPress }: {
    colors: V2Palette;
    icon: typeof Wallet;
    title: string;
    detail: string;
    onPress: () => void;
}) {
    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={{ flex: 1, backgroundColor: colors.surface.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colors.border.subtle }}>
            <View style={{ width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface.card2, marginBottom: 10 }}>
                <Icon size={16} color={colors.text.primary} />
            </View>
            <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text.primary }}>{title}</Text>
            <Text style={{ fontSize: 11, color: colors.text.tertiary, marginTop: 2 }}>{detail}</Text>
        </TouchableOpacity>
    );
}
