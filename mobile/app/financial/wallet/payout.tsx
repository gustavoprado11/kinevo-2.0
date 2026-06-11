import React, { useMemo, useRef, useState } from "react";
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator, TextInput, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, Stack } from "expo-router";
import * as Haptics from "expo-haptics";
import { ChevronLeft, KeyRound, ArrowUpRight, Clock, CheckCircle2, XCircle, ShieldAlert } from "lucide-react-native";
import type { PixKeyType } from "@kinevo/shared/types/asaas";
import { usePixKeys } from "../../../hooks/usePixKeys";
import { usePayouts, type PayoutStatus, type PayoutRow } from "../../../hooks/usePayouts";
import { useWalletBalance } from "../../../hooks/useWalletBalance";
import { useV2Colors } from "../../../hooks/useV2Colors";
import { formatBRL } from "@/lib/currency";

const KEY_TYPE_LABEL: Record<PixKeyType, string> = {
    CPF: "CPF", CNPJ: "CNPJ", EMAIL: "E-mail", PHONE: "Telefone", EVP: "Chave aleatória",
};

function parseAmount(raw: string): number {
    const cleaned = raw.replace(/[^\d,.]/g, "").replace(/\./g, "").replace(",", ".");
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : 0;
}

const STATUS_META: Record<PayoutStatus, { label: string; Icon: typeof Clock; tone: "success" | "warning" | "danger" | "neutral" }> = {
    completed: { label: "Concluído", Icon: CheckCircle2, tone: "success" },
    processing: { label: "Processando", Icon: Clock, tone: "warning" },
    requested: { label: "Solicitado", Icon: Clock, tone: "neutral" },
    awaiting_authorization: { label: "Aguardando SMS", Icon: ShieldAlert, tone: "warning" },
    failed: { label: "Falhou", Icon: XCircle, tone: "danger" },
    cancelled: { label: "Cancelado", Icon: XCircle, tone: "danger" },
};

export default function PayoutScreen() {
    const colors = useV2Colors();
    const router = useRouter();
    const { keys, isLoading: keysLoading } = usePixKeys();
    const { available, isLoading: balLoading, refresh: refreshBalance } = useWalletBalance(true);
    const { payouts, isRefreshing, refresh: refreshPayouts, requestPayout } = usePayouts();

    const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null);
    const [amount, setAmount] = useState("");
    const [submitting, setSubmitting] = useState(false);
    // A3: guard síncrono contra duplo-tap (state `submitting` só reflete no
    // próximo render → dois toques rápidos disparavam dois payouts PIX).
    const submittingRef = useRef(false);

    const defaultKeyId = useMemo(() => keys.find((k) => k.is_default)?.id ?? keys[0]?.id ?? null, [keys]);
    const activeKeyId = selectedKeyId ?? defaultKeyId;
    const value = parseAmount(amount);
    const canSubmit = !!activeKeyId && value > 0 && value <= available && !submitting;

    const toneColor = (tone: "success" | "warning" | "danger" | "neutral") =>
        tone === "success" ? colors.semantic.success : tone === "warning" ? colors.semantic.warning : tone === "danger" ? colors.semantic.danger : { bg: colors.surface.card2, fg: colors.text.secondary, default: colors.text.secondary };

    const handleSubmit = async () => {
        if (!canSubmit || !activeKeyId) return;
        if (submittingRef.current) return; // A3: ignora duplo-tap
        submittingRef.current = true;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setSubmitting(true);
        try {
            const result = await requestPayout(activeKeyId, value);
            refreshBalance();
            setAmount("");
            if (result.status === "awaiting_authorization") {
                Alert.alert(
                    "Confirme o saque por SMS",
                    "A Asaas enviou um código por SMS pra liberar o PIX. Abra o painel da Asaas e confirme — assim que aprovar, o dinheiro cai na sua conta.",
                );
            } else if (result.status === "failed" || result.status === "cancelled") {
                Alert.alert("Saque não concluído", "O saque não foi concluído. Confira o histórico abaixo.");
            } else {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert("Saque solicitado", `${formatBRL(value)} a caminho da sua chave PIX.`);
            }
        } catch (err) {
            Alert.alert("Não foi possível sacar", err instanceof Error ? err.message : "Tente novamente.");
        } finally {
            setSubmitting(false);
            submittingRef.current = false;
        }
    };

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.canvas }} edges={["top"]}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 }}>
                    <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Voltar" hitSlop={12}>
                        <ChevronLeft size={24} color={colors.text.primary} />
                    </TouchableOpacity>
                    <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text.primary }}>Sacar</Text>
                    <View style={{ width: 24 }} />
                </View>

                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 100 }}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => { refreshPayouts(); refreshBalance(); }} tintColor={colors.purple[600]} />}
                >
                    {/* Saldo disponível */}
                    <View style={{ backgroundColor: colors.surface.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border.default, marginBottom: 16 }}>
                        <Text style={{ fontSize: 11, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase", color: colors.text.tertiary }}>Disponível pra saque</Text>
                        {balLoading ? <ActivityIndicator color={colors.purple[600]} style={{ alignSelf: "flex-start", marginTop: 6 }} /> : (
                            <Text style={{ fontSize: 26, fontWeight: "800", color: colors.text.primary, marginTop: 2 }}>{formatBRL(available)}</Text>
                        )}
                    </View>

                    {/* Valor */}
                    <Text style={{ fontSize: 13, fontWeight: "700", color: colors.text.primary, marginBottom: 8 }}>Valor do saque</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.surface.card, borderRadius: 12, borderWidth: 1, borderColor: value > available ? colors.semantic.danger.default : colors.border.default, paddingHorizontal: 14, marginBottom: 8 }}>
                        <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text.secondary }}>R$</Text>
                        <TextInput
                            value={amount}
                            onChangeText={setAmount}
                            placeholder="0,00"
                            placeholderTextColor={colors.text.quaternary}
                            keyboardType="decimal-pad"
                            style={{ flex: 1, paddingVertical: 14, paddingHorizontal: 8, fontSize: 18, fontWeight: "700", color: colors.text.primary }}
                        />
                        <TouchableOpacity onPress={() => { Haptics.selectionAsync(); setAmount(available.toFixed(2).replace(".", ",")); }} hitSlop={8}>
                            <Text style={{ fontSize: 13, fontWeight: "700", color: colors.purple[600] }}>Tudo</Text>
                        </TouchableOpacity>
                    </View>
                    {value > available ? (
                        <Text style={{ fontSize: 12, color: colors.semantic.danger.fg, marginBottom: 8 }}>Valor acima do saldo disponível.</Text>
                    ) : null}

                    {/* Chave PIX */}
                    <Text style={{ fontSize: 13, fontWeight: "700", color: colors.text.primary, marginTop: 8, marginBottom: 8 }}>Chave PIX de destino</Text>
                    {keysLoading ? (
                        <ActivityIndicator color={colors.purple[600]} style={{ alignSelf: "flex-start" }} />
                    ) : keys.length === 0 ? (
                        <TouchableOpacity
                            onPress={() => router.push("/financial/wallet/pix-keys" as never)}
                            activeOpacity={0.7}
                            style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.surface.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border.default, padding: 16 }}
                        >
                            <KeyRound size={18} color={colors.purple[600]} />
                            <Text style={{ fontSize: 14, fontWeight: "600", color: colors.purple[600] }}>Cadastrar uma chave PIX</Text>
                        </TouchableOpacity>
                    ) : (
                        keys.map((k) => {
                            const active = k.id === activeKeyId;
                            return (
                                <TouchableOpacity
                                    key={k.id}
                                    onPress={() => { Haptics.selectionAsync(); setSelectedKeyId(k.id); }}
                                    activeOpacity={0.7}
                                    style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surface.card, borderRadius: 12, borderWidth: 1.5, borderColor: active ? colors.purple[600] : colors.border.default, padding: 14, marginBottom: 8 }}
                                >
                                    <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: active ? colors.purple[600] : colors.border.default, alignItems: "center", justifyContent: "center" }}>
                                        {active ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.purple[600] }} /> : null}
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text.primary }}>{k.alias}</Text>
                                        <Text style={{ fontSize: 12, color: colors.text.secondary, marginTop: 1 }}>{KEY_TYPE_LABEL[k.key_type]} · {k.pix_key}</Text>
                                    </View>
                                </TouchableOpacity>
                            );
                        })
                    )}

                    {/* Botão sacar */}
                    <TouchableOpacity
                        onPress={handleSubmit}
                        disabled={!canSubmit}
                        activeOpacity={0.85}
                        style={{ marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: canSubmit ? colors.purple[600] : colors.surface.card2, borderRadius: 14, paddingVertical: 15 }}
                    >
                        {submitting ? <ActivityIndicator color="#ffffff" /> : (
                            <>
                                <ArrowUpRight size={18} color={canSubmit ? "#ffffff" : colors.text.quaternary} />
                                <Text style={{ fontSize: 15, fontWeight: "700", color: canSubmit ? "#ffffff" : colors.text.quaternary }}>Sacar {value > 0 ? formatBRL(value) : ""}</Text>
                            </>
                        )}
                    </TouchableOpacity>

                    {/* Histórico */}
                    {payouts.length > 0 ? (
                        <>
                            <Text style={{ fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", color: colors.text.tertiary, marginTop: 28, marginBottom: 10 }}>Saques recentes</Text>
                            {payouts.map((p) => <PayoutHistoryRow key={p.id} payout={p} colors={colors} toneColor={toneColor} />)}
                        </>
                    ) : null}
                </ScrollView>
            </SafeAreaView>
        </>
    );
}

function PayoutHistoryRow({ payout, colors, toneColor }: {
    payout: PayoutRow;
    colors: ReturnType<typeof useV2Colors>;
    toneColor: (tone: "success" | "warning" | "danger" | "neutral") => { bg: string; fg: string; default: string };
}) {
    const meta = STATUS_META[payout.status];
    const tone = toneColor(meta.tone);
    const reais = payout.amount_cents / 100;
    const date = new Date(payout.requested_at).toLocaleDateString("pt-BR");
    return (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surface.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border.default, padding: 14, marginBottom: 8 }}>
            <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: tone.bg }}>
                <meta.Icon size={16} color={tone.fg} />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text.primary }}>{formatBRL(reais)}</Text>
                <Text style={{ fontSize: 12, color: colors.text.tertiary, marginTop: 1 }}>{date}{payout.pix_key_snapshot ? ` · ${payout.pix_key_snapshot}` : ""}</Text>
                {payout.failure_reason && (payout.status === "failed" || payout.status === "cancelled") ? (
                    <Text style={{ fontSize: 12, color: colors.semantic.danger.fg, marginTop: 2 }}>{payout.failure_reason}</Text>
                ) : null}
            </View>
            <Text style={{ fontSize: 12, fontWeight: "700", color: tone.fg }}>{meta.label}</Text>
        </View>
    );
}
