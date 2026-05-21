import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Modal, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, Stack } from "expo-router";
import { WebView } from "react-native-webview";
import * as Haptics from "expo-haptics";
import { ChevronLeft, X, CheckCircle2, CreditCard, RefreshCw, Clock } from "lucide-react-native";
import { useStudentPayment } from "../hooks/useStudentPayment";
import { useV2Colors } from "../hooks/useV2Colors";

function formatBRL(value: number): string {
    const [i, d] = value.toFixed(2).split(".");
    return `R$ ${i.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${d}`;
}

export default function StudentPaymentScreen() {
    const colors = useV2Colors();
    const router = useRouter();
    const { data, isLoading, error, refresh } = useStudentPayment();
    const [checkoutVisible, setCheckoutVisible] = useState(false);
    const [webLoading, setWebLoading] = useState(true);

    const hasPending = !!data?.hasPending;
    const invoiceUrl = data?.invoiceUrl ?? null;

    const openCheckout = () => {
        if (!invoiceUrl) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setWebLoading(true);
        setCheckoutVisible(true);
    };

    const closeCheckout = () => {
        setCheckoutVisible(false);
        // Após o checkout, atualiza o status (webhook pode levar alguns segundos)
        refresh();
    };

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.canvas }} edges={["top"]}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 }}>
                    <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Voltar" hitSlop={12}>
                        <ChevronLeft size={24} color={colors.text.primary} />
                    </TouchableOpacity>
                    <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text.primary }}>Pagamento</Text>
                    <View style={{ width: 24 }} />
                </View>

                {isLoading ? (
                    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                        <ActivityIndicator color={colors.purple[600]} size="large" />
                    </View>
                ) : (
                    <ScrollView
                        style={{ flex: 1 }}
                        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 60 }}
                        refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} tintColor="#7c3aed" />}
                    >
                        {error ? (
                            <View style={{ backgroundColor: colors.semantic.danger.bg, borderRadius: 16, padding: 16 }}>
                                <Text style={{ color: colors.semantic.danger.fg, fontSize: 14, fontWeight: "600" }}>{error}</Text>
                            </View>
                        ) : !hasPending ? (
                            <View style={{ alignItems: "center", paddingVertical: 48 }}>
                                <View style={{ width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", backgroundColor: colors.semantic.success.bg, marginBottom: 16 }}>
                                    <CheckCircle2 size={32} color={colors.semantic.success.fg} />
                                </View>
                                <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text.primary }}>Tudo em dia</Text>
                                <Text style={{ fontSize: 13, color: colors.text.tertiary, marginTop: 4, textAlign: "center" }}>
                                    Você não tem nenhuma cobrança pendente no momento.
                                </Text>
                            </View>
                        ) : (
                            <>
                                {/* Cobrança pendente */}
                                <View style={{ backgroundColor: colors.surface.card, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: colors.border.default }}>
                                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
                                        <Clock size={13} color={colors.semantic.warning.fg} />
                                        <Text style={{ fontSize: 12, fontWeight: "700", color: colors.semantic.warning.fg, textTransform: "uppercase", letterSpacing: 0.5 }}>
                                            {data?.status === "past_due" ? "Pagamento atrasado" : "Pagamento pendente"}
                                        </Text>
                                    </View>
                                    <Text style={{ fontSize: 32, fontWeight: "800", color: colors.text.primary }}>{formatBRL(data?.amount ?? 0)}</Text>
                                    {data?.planTitle ? (
                                        <Text style={{ fontSize: 14, color: colors.text.secondary, marginTop: 2 }}>{data.planTitle}</Text>
                                    ) : null}
                                </View>

                                {invoiceUrl ? (
                                    <>
                                        <TouchableOpacity
                                            onPress={openCheckout}
                                            activeOpacity={0.85}
                                            style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.purple[600], borderRadius: 16, paddingVertical: 16, marginTop: 16 }}
                                        >
                                            <CreditCard size={18} color="#ffffff" />
                                            <Text style={{ fontSize: 15, fontWeight: "700", color: "#ffffff" }}>Pagar agora</Text>
                                        </TouchableOpacity>
                                        <Text style={{ fontSize: 12, color: colors.text.tertiary, textAlign: "center", marginTop: 10, lineHeight: 17 }}>
                                            Você escolhe PIX, cartão ou boleto no checkout seguro da Asaas. Depois de pagar, volte e toque em Atualizar.
                                        </Text>
                                    </>
                                ) : (
                                    <Text style={{ fontSize: 13, color: colors.text.tertiary, marginTop: 16, textAlign: "center" }}>
                                        Link de pagamento indisponível no momento. Fale com seu treinador.
                                    </Text>
                                )}

                                <TouchableOpacity onPress={() => { Haptics.selectionAsync(); refresh(); }} activeOpacity={0.7} style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 14, marginTop: 8 }}>
                                    <RefreshCw size={15} color={colors.purple[600]} />
                                    <Text style={{ fontSize: 14, fontWeight: "600", color: colors.purple[600] }}>Já paguei? Atualizar</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </ScrollView>
                )}
            </SafeAreaView>

            {/* Checkout Asaas em WebView */}
            <Modal visible={checkoutVisible} animationType="slide" onRequestClose={closeCheckout}>
                <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.canvas }} edges={["top"]}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border.subtle }}>
                        <TouchableOpacity onPress={closeCheckout} hitSlop={12} accessibilityLabel="Fechar">
                            <X size={24} color={colors.text.primary} />
                        </TouchableOpacity>
                        <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text.primary }}>Pagamento seguro</Text>
                        <View style={{ width: 24 }} />
                    </View>
                    <View style={{ flex: 1 }}>
                        {invoiceUrl ? (
                            <WebView
                                source={{ uri: invoiceUrl }}
                                onLoadEnd={() => setWebLoading(false)}
                                startInLoadingState
                            />
                        ) : null}
                        {webLoading ? (
                            <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface.canvas }}>
                                <ActivityIndicator color={colors.purple[600]} size="large" />
                            </View>
                        ) : null}
                    </View>
                </SafeAreaView>
            </Modal>
        </>
    );
}
