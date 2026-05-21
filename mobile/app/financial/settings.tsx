import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Switch, Linking, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, Stack } from "expo-router";
import * as Haptics from "expo-haptics";
import {
    ChevronLeft, Wallet, CreditCard, Percent, ShieldAlert, BellRing,
    Settings as SettingsIcon, Check, Link2, KeyRound, RefreshCw, Minus, Plus, ArrowRight, MessageCircle,
} from "lucide-react-native";
import type { KinevoWalletStatus } from "@kinevo/shared/types/asaas";
import { ASAAS_FEES } from "@kinevo/shared/lib/asaas/fees";
import { useFinancialSettings, type FinancialSettings } from "../../hooks/useFinancialSettings";
import { useWallet } from "../../hooks/useWallet";
import { useHasStripeLegacy } from "../../hooks/useHasStripeLegacy";
import { walletFetch } from "../../lib/wallet-api";
import { useV2Colors, type V2Palette } from "../../hooks/useV2Colors";

// Taxas — fonte ÚNICA em @kinevo/shared/lib/asaas/fees.ts (web + mobile importam de lá).
const FEES = ASAAS_FEES;
const pct = (p: number) => (p * 100).toFixed(2).replace(".", ",") + "%";
const brl = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

const STATUS_LABEL: Record<KinevoWalletStatus, string> = {
    not_started: "Não ativada",
    pending: "Em análise",
    awaiting: "Em análise",
    approved: "Aprovada",
    rejected: "Reprovada",
    blocked: "Bloqueada",
};

export default function FinancialSettingsScreen() {
    const colors = useV2Colors();
    const router = useRouter();
    const { settings, isLoading, savingKey, savedKey, save } = useFinancialSettings();
    const { summary: wallet, refresh: refreshWallet } = useWallet();
    const { hasLegacy } = useHasStripeLegacy();
    const [syncing, setSyncing] = useState(false);

    const status = wallet?.status ?? "not_started";

    const syncWallet = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSyncing(true);
        try {
            await walletFetch("/api/wallet/sync", { method: "POST" });
            refreshWallet();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        } catch {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
            Alert.alert("Falha ao sincronizar", "Não foi possível atualizar a carteira. Verifique sua conexão e tente novamente.");
        }
        finally { setSyncing(false); }
    };

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.canvas }} edges={["top"]}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 }}>
                    <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Voltar" hitSlop={12}>
                        <ChevronLeft size={24} color={colors.text.primary} />
                    </TouchableOpacity>
                    <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text.primary }}>Configurações</Text>
                    <View style={{ width: 24 }} />
                </View>

                {isLoading || !settings ? (
                    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                        <ActivityIndicator color={colors.purple[600]} size="large" />
                    </View>
                ) : (
                    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
                        <Text style={{ fontSize: 13, color: colors.text.tertiary, marginBottom: 16 }}>
                            Ajustes da sua Carteira, métodos padrão, notificações e regras de inadimplência.
                        </Text>

                        {/* Carteira */}
                        <Section colors={colors} icon={Wallet} title="Carteira" description="Status atual da conta financeira que recebe as cobranças.">
                            <Row colors={colors} label="Status">
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                                    <View style={{ flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: status === "approved" ? "rgba(16,185,129,0.15)" : status === "rejected" || status === "blocked" ? "#fee2e2" : "rgba(245,158,11,0.15)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100 }}>
                                        {status === "approved" ? <Check size={10} color="#047857" strokeWidth={3} /> : null}
                                        <Text style={{ fontSize: 11, fontWeight: "700", color: status === "approved" ? "#047857" : status === "rejected" || status === "blocked" ? colors.semantic.danger.fg : "#b45309" }}>
                                            {STATUS_LABEL[status]}
                                        </Text>
                                    </View>
                                    {status === "approved" ? (
                                        <TouchableOpacity onPress={syncWallet} disabled={syncing} hitSlop={8} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                                            {syncing ? <ActivityIndicator size="small" color={colors.purple[600]} /> : <RefreshCw size={11} color={colors.purple[600]} />}
                                            <Text style={{ fontSize: 12, fontWeight: "600", color: colors.purple[600] }}>Atualizar</Text>
                                        </TouchableOpacity>
                                    ) : null}
                                </View>
                            </Row>
                            {status === "approved" ? (
                                <Row colors={colors} label="Modo">
                                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.surface.card2, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100 }}>
                                        {wallet?.mode === "linked" ? <Link2 size={11} color={colors.text.secondary} /> : <Wallet size={11} color={colors.text.secondary} />}
                                        <Text style={{ fontSize: 11, fontWeight: "600", color: colors.text.secondary }}>{wallet?.mode === "linked" ? "Vinculada à Asaas" : "Criada via Kinevo"}</Text>
                                    </View>
                                </Row>
                            ) : null}
                            {status !== "approved" ? (
                                <TouchableOpacity onPress={() => router.push("/financial/wallet" as never)} activeOpacity={0.7} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14 }}>
                                    <Text style={{ fontSize: 13, color: colors.text.secondary, flex: 1 }}>Configure sua Carteira para cobrar via PIX/Cartão.</Text>
                                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                                        <Text style={{ fontSize: 13, fontWeight: "600", color: colors.purple[600] }}>Abrir carteira</Text>
                                        <ArrowRight size={14} color={colors.purple[600]} />
                                    </View>
                                </TouchableOpacity>
                            ) : null}
                        </Section>

                        {/* Métodos de pagamento padrão */}
                        <Section colors={colors} icon={CreditCard} title="Métodos de pagamento padrão" description="Pré-seleção ao criar novos planos. Dá pra mudar plano a plano depois.">
                            <ToggleRow colors={colors} label="PIX" help={`Taxa ${pct(FEES.PIX.percent)} + ${brl(FEES.PIX.fixed)}. Liberação em até 1 dia útil.`} value={settings.defaultAllowPix} onChange={(v) => save("defaultAllowPix", v)} saving={savingKey === "defaultAllowPix"} saved={savedKey === "defaultAllowPix"} />
                            <ToggleRow colors={colors} label="Cartão de Crédito" help={`Taxa ${pct(FEES.CREDIT_CARD.percent)} + ${brl(FEES.CREDIT_CARD.fixed)}. Liberação em 30 dias.`} value={settings.defaultAllowCreditCard} onChange={(v) => save("defaultAllowCreditCard", v)} saving={savingKey === "defaultAllowCreditCard"} saved={savedKey === "defaultAllowCreditCard"} />
                            <ToggleRow colors={colors} label="Boleto bancário" help={`Taxa ${brl(FEES.BOLETO.fixed)} por boleto pago. Liberação em 3 dias úteis.`} value={settings.defaultAllowBoleto} onChange={(v) => save("defaultAllowBoleto", v)} saving={savingKey === "defaultAllowBoleto"} saved={savedKey === "defaultAllowBoleto"} />
                        </Section>

                        {/* Taxas vigentes */}
                        <Section colors={colors} icon={Percent} title="Taxas vigentes" description="Cobradas pela Asaas (parceira financeira). A Kinevo não cobra taxa em cima.">
                            <FeeRow colors={colors} method="PIX" detail="Recebimento à vista" fee={`${pct(FEES.PIX.percent)} + ${brl(FEES.PIX.fixed)}`} release="Até 1 dia útil" />
                            <FeeRow colors={colors} method="Cartão de Crédito" detail="À vista ou parcelado" fee={`${pct(FEES.CREDIT_CARD.percent)} + ${brl(FEES.CREDIT_CARD.fixed)}`} release="30 dias (à vista)" />
                            <FeeRow colors={colors} method="Boleto bancário" detail="Por boleto pago" fee={brl(FEES.BOLETO.fixed)} release="3 dias úteis" />
                        </Section>

                        {/* Inadimplência */}
                        <Section colors={colors} icon={ShieldAlert} title="Inadimplência" description="O que acontece quando um aluno atrasa o pagamento.">
                            <ToggleRow colors={colors} label="Bloquear acesso ao app após inadimplência" help="Se ativado, o aluno perde acesso aos treinos até regularizar." value={settings.blockOnOverdue} onChange={(v) => save("blockOnOverdue", v)} saving={savingKey === "blockOnOverdue"} saved={savedKey === "blockOnOverdue"} />
                            {settings.blockOnOverdue ? (
                                <Row colors={colors} label="Período de tolerância" help="Dias de atraso antes de bloquear o acesso.">
                                    <Stepper colors={colors} value={settings.overdueGraceDays} min={1} max={15} onChange={(v) => save("overdueGraceDays", v)} />
                                </Row>
                            ) : null}
                        </Section>

                        {/* Notificações */}
                        <Section colors={colors} icon={BellRing} title="Notificações" description="Avisos por push sobre o que acontece no seu Financeiro.">
                            <ToggleRow colors={colors} label="Quando um aluno pagar" value={settings.notifyOnPaymentReceived} onChange={(v) => save("notifyOnPaymentReceived", v)} saving={savingKey === "notifyOnPaymentReceived"} saved={savedKey === "notifyOnPaymentReceived"} />
                            <ToggleRow colors={colors} label="Quando um aluno cancelar a assinatura" value={settings.notifyOnSubscriptionCanceled} onChange={(v) => save("notifyOnSubscriptionCanceled", v)} saving={savingKey === "notifyOnSubscriptionCanceled"} saved={savedKey === "notifyOnSubscriptionCanceled"} />
                            <ToggleRow colors={colors} label="Quando um saque cair na conta" value={settings.notifyOnPayoutCompleted} onChange={(v) => save("notifyOnPayoutCompleted", v)} saving={savingKey === "notifyOnPayoutCompleted"} saved={savedKey === "notifyOnPayoutCompleted"} />
                            <ToggleRow colors={colors} label="Alertas de documentação" value={settings.notifyOnKycAlert} onChange={(v) => save("notifyOnKycAlert", v)} saving={savingKey === "notifyOnKycAlert"} saved={savedKey === "notifyOnKycAlert"} />
                        </Section>

                        {/* Chaves PIX */}
                        <TouchableOpacity onPress={() => router.push("/financial/wallet/pix-keys" as never)} activeOpacity={0.7} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.surface.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border.subtle, padding: 16, marginBottom: 16 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
                                <View style={{ width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: colors.purple[100] }}>
                                    <KeyRound size={17} color={colors.purple[600]} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text.primary }}>Chaves PIX para saque</Text>
                                    <Text style={{ fontSize: 12, color: colors.text.tertiary, marginTop: 1 }}>Onde você recebe o dinheiro ao sacar</Text>
                                </View>
                            </View>
                            <Text style={{ fontSize: 12, fontWeight: "600", color: colors.purple[600] }}>Gerenciar →</Text>
                        </TouchableOpacity>

                        {/* Avançado */}
                        <Section colors={colors} icon={SettingsIcon} title="Avançado" description="Configurações pra casos específicos.">
                            {hasLegacy ? (
                                <ToggleRow colors={colors} label="Mostrar contratos Stripe legados" help="Mantém contratos antigos via Stripe visíveis. Novos planos sempre usam a Carteira." value={settings.showStripeLegacy} onChange={(v) => save("showStripeLegacy", v)} saving={savingKey === "showStripeLegacy"} saved={savedKey === "showStripeLegacy"} />
                            ) : null}
                            <TouchableOpacity onPress={() => Linking.openURL("mailto:suporte@kinevoapp.com")} activeOpacity={0.7} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14 }}>
                                <View style={{ flex: 1, paddingRight: 12 }}>
                                    <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text.primary }}>Suporte da Kinevo</Text>
                                    <Text style={{ fontSize: 12, color: colors.text.tertiary, marginTop: 1 }}>Algum problema com a Carteira? A gente ajuda.</Text>
                                </View>
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                                    <MessageCircle size={13} color={colors.purple[600]} />
                                    <Text style={{ fontSize: 12, fontWeight: "600", color: colors.purple[600] }}>Falar</Text>
                                </View>
                            </TouchableOpacity>
                        </Section>
                    </ScrollView>
                )}
            </SafeAreaView>
        </>
    );
}

function Section({ colors, icon: Icon, title, description, children }: {
    colors: V2Palette; icon: typeof Wallet; title: string; description: string; children: React.ReactNode;
}) {
    return (
        <View style={{ backgroundColor: colors.surface.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border.subtle, overflow: "hidden", marginBottom: 16 }}>
            <View style={{ paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border.subtle }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Icon size={17} color={colors.purple[600]} />
                    <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text.primary }}>{title}</Text>
                </View>
                <Text style={{ fontSize: 12, color: colors.text.tertiary, marginTop: 4 }}>{description}</Text>
            </View>
            {children}
        </View>
    );
}

function Row({ colors, label, help, children }: {
    colors: V2Palette; label: string; help?: string; children: React.ReactNode;
}) {
    return (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: 16, paddingVertical: 13, borderTopWidth: 1, borderTopColor: colors.border.subtle }}>
            <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text.primary }}>{label}</Text>
                {help ? <Text style={{ fontSize: 12, color: colors.text.tertiary, marginTop: 2, lineHeight: 16 }}>{help}</Text> : null}
            </View>
            <View>{children}</View>
        </View>
    );
}

function ToggleRow({ colors, label, help, value, onChange, saving, saved }: {
    colors: V2Palette; label: string; help?: string; value: boolean; onChange: (v: boolean) => void; saving?: boolean; saved?: boolean;
}) {
    return (
        <Row colors={colors} label={label} help={help}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                {saving ? <ActivityIndicator size="small" color={colors.text.tertiary} /> : saved ? <Check size={14} color="#16a34a" strokeWidth={3} /> : null}
                <Switch
                    value={value}
                    onValueChange={(v) => { Haptics.selectionAsync(); onChange(v); }}
                    trackColor={{ false: colors.border.default, true: colors.purple[600] }}
                    thumbColor="#ffffff"
                    ios_backgroundColor={colors.border.default}
                />
            </View>
        </Row>
    );
}

function Stepper({ colors, value, min, max, onChange }: {
    colors: V2Palette; value: number; min: number; max: number; onChange: (v: number) => void;
}) {
    const dec = () => { if (value > min) { Haptics.selectionAsync(); onChange(value - 1); } };
    const inc = () => { if (value < max) { Haptics.selectionAsync(); onChange(value + 1); } };
    return (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <TouchableOpacity onPress={dec} disabled={value <= min} hitSlop={6} style={{ width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface.card2, opacity: value <= min ? 0.4 : 1 }}>
                <Minus size={15} color={colors.text.primary} />
            </TouchableOpacity>
            <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text.primary, minWidth: 56, textAlign: "center" }}>
                {value} {value === 1 ? "dia" : "dias"}
            </Text>
            <TouchableOpacity onPress={inc} disabled={value >= max} hitSlop={6} style={{ width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface.card2, opacity: value >= max ? 0.4 : 1 }}>
                <Plus size={15} color={colors.text.primary} />
            </TouchableOpacity>
        </View>
    );
}

function FeeRow({ colors, method, detail, fee, release }: {
    colors: V2Palette; method: string; detail: string; fee: string; release: string;
}) {
    return (
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border.subtle }}>
            <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: colors.text.primary }}>{method}</Text>
                <Text style={{ fontSize: 11, color: colors.text.tertiary, marginTop: 1 }}>{detail}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: colors.text.primary }}>{fee}</Text>
                <Text style={{ fontSize: 11, color: colors.text.secondary, marginTop: 1 }}>{release}</Text>
            </View>
        </View>
    );
}
