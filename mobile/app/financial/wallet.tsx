import React from "react";
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, Stack } from "expo-router";
import * as Haptics from "expo-haptics";
import {
    ChevronLeft,
    ArrowUpRight,
    KeyRound,
    Wallet,
    Clock,
    CheckCircle2,
    XCircle,
    ShieldAlert,
    ExternalLink,
} from "lucide-react-native";
import type { KinevoWalletStatus } from "@kinevo/shared/types/asaas";
import { useWallet } from "../../hooks/useWallet";
import { useWalletBalance } from "../../hooks/useWalletBalance";
import { useV2Colors } from "../../hooks/useV2Colors";

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL || "https://www.kinevoapp.com";

function formatBRL(value: number): string {
    const [intPart, decPart] = value.toFixed(2).split(".");
    const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return `R$ ${grouped},${decPart}`;
}

interface StatusMeta {
    label: string;
    description: string;
    bg: string;
    fg: string;
    Icon: typeof Clock;
}

function statusMeta(status: KinevoWalletStatus, colors: ReturnType<typeof useV2Colors>): StatusMeta {
    switch (status) {
        case "approved":
            return {
                label: "Ativa",
                description: "Você já pode receber pagamentos e sacar via PIX.",
                bg: colors.semantic.success.bg,
                fg: colors.semantic.success.fg,
                Icon: CheckCircle2,
            };
        case "pending":
        case "awaiting":
            return {
                label: "Em análise",
                description: "A Asaas está analisando seus dados (1 a 3 dias úteis). Avisamos quando liberar.",
                bg: colors.semantic.warning.bg,
                fg: colors.semantic.warning.fg,
                Icon: Clock,
            };
        case "rejected":
            return {
                label: "Reprovada",
                description: "A análise não foi aprovada. Confira o motivo abaixo e tente novamente pelo site.",
                bg: colors.semantic.danger.bg,
                fg: colors.semantic.danger.fg,
                Icon: XCircle,
            };
        case "blocked":
            return {
                label: "Bloqueada",
                description: "Sua carteira está suspensa por compliance. Fale com o suporte.",
                bg: colors.semantic.danger.bg,
                fg: colors.semantic.danger.fg,
                Icon: ShieldAlert,
            };
        default:
            return {
                label: "Não ativada",
                description: "Ative sua Carteira para receber via PIX, cartão e boleto direto no app.",
                bg: colors.purple[100],
                fg: colors.purple[700],
                Icon: Wallet,
            };
    }
}

export default function WalletScreen() {
    const colors = useV2Colors();
    const router = useRouter();
    const { summary, isLoading, isRefreshing, error, refresh } = useWallet();

    const isApproved = summary?.status === "approved";
    const balance = useWalletBalance(isApproved);

    const onRefresh = () => {
        refresh();
        if (isApproved) balance.refresh();
    };

    const meta = summary ? statusMeta(summary.status, colors) : null;

    const openWebActivation = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        Linking.openURL(`${WEB_URL}/financial/wallet`);
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
                    <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text.primary }}>Carteira</Text>
                    <View style={{ width: 24 }} />
                </View>

                {isLoading ? (
                    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                        <ActivityIndicator color={colors.purple[600]} size="large" />
                    </View>
                ) : (
                    <ScrollView
                        style={{ flex: 1 }}
                        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 100 }}
                        showsVerticalScrollIndicator={false}
                        refreshControl={<RefreshControl refreshing={isRefreshing || balance.isRefreshing} onRefresh={onRefresh} tintColor="#7c3aed" />}
                    >
                        {error && !summary ? (
                            <View style={{ backgroundColor: colors.semantic.danger.bg, borderRadius: 16, padding: 16, marginTop: 8 }}>
                                <Text style={{ color: colors.semantic.danger.fg, fontSize: 14, fontWeight: "600" }}>{error}</Text>
                            </View>
                        ) : null}

                        {/* Status badge */}
                        {meta ? (
                            <View style={{ backgroundColor: colors.surface.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border.default, marginBottom: 16 }}>
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}>
                                    <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: meta.bg }}>
                                        <meta.Icon size={18} color={meta.fg} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontSize: 11, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase", color: colors.text.tertiary }}>Status da carteira</Text>
                                        <Text style={{ fontSize: 16, fontWeight: "700", color: meta.fg }}>{meta.label}</Text>
                                    </View>
                                </View>
                                <Text style={{ fontSize: 13, color: colors.text.secondary, lineHeight: 18 }}>{meta.description}</Text>
                                {summary?.status === "rejected" && summary.rejectionReason ? (
                                    <Text style={{ fontSize: 13, color: colors.semantic.danger.fg, marginTop: 8 }}>Motivo: {summary.rejectionReason}</Text>
                                ) : null}
                            </View>
                        ) : null}

                        {isApproved ? (
                            <>
                                {/* Balance hero */}
                                <View style={{ backgroundColor: colors.purple[600], borderRadius: 20, padding: 20, marginBottom: 16 }}>
                                    <Text style={{ fontSize: 12, fontWeight: "600", color: "rgba(255,255,255,0.8)", letterSpacing: 0.5, textTransform: "uppercase" }}>Saldo disponível</Text>
                                    {balance.isLoading ? (
                                        <ActivityIndicator color="#ffffff" style={{ alignSelf: "flex-start", marginTop: 10 }} />
                                    ) : (
                                        <Text style={{ fontSize: 34, fontWeight: "800", color: "#ffffff", marginTop: 4 }}>{formatBRL(balance.available)}</Text>
                                    )}
                                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 }}>
                                        <Clock size={13} color="rgba(255,255,255,0.8)" />
                                        <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.8)" }}>
                                            {formatBRL(balance.pending)} a liberar
                                        </Text>
                                    </View>
                                    {balance.error ? (
                                        <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.9)", marginTop: 8 }}>{balance.error}</Text>
                                    ) : null}
                                </View>

                                {/* Actions */}
                                <View style={{ flexDirection: "row", gap: 12 }}>
                                    <ActionCard
                                        label="Sacar"
                                        hint="PIX pra sua conta"
                                        Icon={ArrowUpRight}
                                        colors={colors}
                                        onPress={() => {
                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                            router.push("/financial/wallet/payout" as never);
                                        }}
                                    />
                                    <ActionCard
                                        label="Chaves PIX"
                                        hint="Onde receber o saque"
                                        Icon={KeyRound}
                                        colors={colors}
                                        onPress={() => {
                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                            router.push("/financial/wallet/pix-keys" as never);
                                        }}
                                    />
                                </View>
                            </>
                        ) : summary && summary.status === "not_started" ? (
                            <TouchableOpacity
                                onPress={openWebActivation}
                                activeOpacity={0.85}
                                style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.purple[600], borderRadius: 16, paddingVertical: 16 }}
                            >
                                <ExternalLink size={18} color="#ffffff" />
                                <Text style={{ fontSize: 15, fontWeight: "700", color: "#ffffff" }}>Ativar pelo site</Text>
                            </TouchableOpacity>
                        ) : null}

                        {!isApproved && summary && summary.status !== "not_started" ? (
                            <TouchableOpacity onPress={openWebActivation} activeOpacity={0.7} style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, marginTop: 4 }}>
                                <ExternalLink size={15} color={colors.purple[600]} />
                                <Text style={{ fontSize: 14, fontWeight: "600", color: colors.purple[600] }}>Abrir carteira no site</Text>
                            </TouchableOpacity>
                        ) : null}
                    </ScrollView>
                )}
            </SafeAreaView>
        </>
    );
}

function ActionCard({ label, hint, Icon, colors, onPress }: {
    label: string;
    hint: string;
    Icon: typeof ArrowUpRight;
    colors: ReturnType<typeof useV2Colors>;
    onPress: () => void;
}) {
    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.7}
            style={{ flex: 1, backgroundColor: colors.surface.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border.default }}
        >
            <View style={{ width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: colors.purple[100], marginBottom: 10 }}>
                <Icon size={18} color={colors.purple[600]} />
            </View>
            <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text.primary }}>{label}</Text>
            <Text style={{ fontSize: 12, color: colors.text.secondary, marginTop: 2 }}>{hint}</Text>
        </TouchableOpacity>
    );
}
