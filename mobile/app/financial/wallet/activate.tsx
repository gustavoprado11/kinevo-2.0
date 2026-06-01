import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, Stack } from "expo-router";
import * as Haptics from "expo-haptics";
import { ChevronLeft, Sparkles, Link2, Check, AlertTriangle, ArrowRight } from "lucide-react-native";
import { walletFetch } from "../../../lib/wallet-api";
import { useRoleMode } from "../../../contexts/RoleModeContext";
import { useV2Colors, type V2Palette } from "../../../hooks/useV2Colors";
import { toRgba } from "../../../lib/brandColor";

type Mode = "choose" | "new" | "link";
type CompanyType = "INDIVIDUAL" | "MEI" | "LIMITED" | "ASSOCIATION";

const COMPANY_TYPES: { value: CompanyType; label: string }[] = [
    { value: "INDIVIDUAL", label: "Pessoa física" },
    { value: "MEI", label: "MEI" },
    { value: "LIMITED", label: "Empresa LTDA" },
    { value: "ASSOCIATION", label: "Associação" },
];

const onlyDigits = (s: string) => s.replace(/\D/g, "");

// "DD/MM/AAAA" → "AAAA-MM-DD" (ou "" se incompleto/ inválido)
function brDateToISO(masked: string): string {
    const d = onlyDigits(masked);
    if (d.length !== 8) return "";
    const dd = d.slice(0, 2), mm = d.slice(2, 4), yyyy = d.slice(4, 8);
    const day = Number(dd), month = Number(mm), year = Number(yyyy);
    if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900) return "";
    return `${yyyy}-${mm}-${dd}`;
}
function maskBrDate(s: string): string {
    const d = onlyDigits(s).slice(0, 8);
    if (d.length <= 2) return d;
    if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
    return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

export default function WalletActivateScreen() {
    const colors = useV2Colors();
    const router = useRouter();
    const { trainerProfile } = useRoleMode();

    const [mode, setMode] = useState<Mode>("choose");
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [busy, setBusy] = useState(false);

    // Wizard state
    const [name, setName] = useState(trainerProfile?.name ?? "");
    const [email, setEmail] = useState(trainerProfile?.email ?? "");
    const [cpfCnpj, setCpfCnpj] = useState("");
    const [birthDate, setBirthDate] = useState(""); // DD/MM/AAAA
    const [mobilePhone, setMobilePhone] = useState("");
    const [companyType, setCompanyType] = useState<CompanyType>("INDIVIDUAL");
    const [postalCode, setPostalCode] = useState("");
    const [address, setAddress] = useState("");
    const [addressNumber, setAddressNumber] = useState("");
    const [province, setProvince] = useState("");
    const [incomeValue, setIncomeValue] = useState("");

    // Link state
    const [apiKey, setApiKey] = useState("");
    const [walletId, setWalletId] = useState("");

    const canStep1 = name.trim() && email.includes("@") && onlyDigits(cpfCnpj).length >= 11 && brDateToISO(birthDate) && onlyDigits(mobilePhone).length >= 10;
    const canStep2 = onlyDigits(postalCode).length === 8 && address.trim() && addressNumber.trim() && province.trim();
    const canStep3 = Number(incomeValue) > 0;

    const lookupCep = async () => {
        const cep = onlyDigits(postalCode);
        if (cep.length !== 8) return;
        try {
            const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            if (!res.ok) return;
            const data = (await res.json()) as { logradouro?: string; bairro?: string; erro?: boolean };
            if (data.erro) return;
            if (data.logradouro) setAddress((a) => a || data.logradouro!);
            if (data.bairro) setProvince((p) => p || data.bairro!);
        } catch { /* silent */ }
    };

    const submitActivation = async () => {
        if (!canStep3) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setBusy(true);
        try {
            await walletFetch("/api/wallet/activate", {
                method: "POST",
                body: {
                    name: name.trim(),
                    email: email.trim(),
                    cpfCnpj: onlyDigits(cpfCnpj),
                    birthDate: brDateToISO(birthDate),
                    mobilePhone: onlyDigits(mobilePhone),
                    address: address.trim(),
                    addressNumber: addressNumber.trim(),
                    province: province.trim(),
                    postalCode: onlyDigits(postalCode),
                    incomeValue: Number(incomeValue),
                    companyType,
                },
            });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert("Carteira criada", "Agora é só enviar os documentos pra liberação. Acompanhe o status na Carteira.");
            router.replace("/financial/wallet" as never);
        } catch (err) {
            Alert.alert("Não foi possível ativar", err instanceof Error ? err.message : "Tente novamente.");
        } finally {
            setBusy(false);
        }
    };

    const submitLink = async () => {
        const key = apiKey.trim();
        const wid = walletId.trim();
        const isSandbox = key.startsWith("$aact_hmlg_") || key.startsWith("$aact_sandbox_");
        if (!key.startsWith("$aact_") || isSandbox || wid.length < 16) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setBusy(true);
        try {
            await walletFetch("/api/wallet/link", { method: "POST", body: { apiKey: key, walletId: wid } });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert("Conta conectada", "Sua conta Asaas foi vinculada à Kinevo.");
            router.replace("/financial/wallet" as never);
        } catch (err) {
            Alert.alert("Não foi possível conectar", err instanceof Error ? err.message : "Confira os dados e tente de novo.");
        } finally {
            setBusy(false);
        }
    };

    const headerTitle = mode === "link" ? "Conectar conta Asaas" : mode === "new" ? "Ativar Carteira" : "Ativar Carteira";

    const onBack = () => {
        if (mode === "new" && step > 1) setStep((s) => (s - 1) as 1 | 2);
        else if (mode !== "choose") setMode("choose");
        else router.back();
    };

    const linkSandbox = apiKey.trim().startsWith("$aact_hmlg_") || apiKey.trim().startsWith("$aact_sandbox_");
    const canLink = apiKey.trim().startsWith("$aact_") && !linkSandbox && walletId.trim().length >= 16;

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.canvas }} edges={["top"]}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 }}>
                    <TouchableOpacity onPress={onBack} accessibilityRole="button" accessibilityLabel="Voltar" hitSlop={12}>
                        <ChevronLeft size={24} color={colors.text.primary} />
                    </TouchableOpacity>
                    <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text.primary }}>{headerTitle}</Text>
                    <View style={{ width: 24 }} />
                </View>

                <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
                    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 120 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                        {mode === "choose" ? (
                            <ChooseMode colors={colors} onNew={() => { setMode("new"); setStep(1); }} onLink={() => setMode("link")} />
                        ) : mode === "link" ? (
                            <LinkForm
                                colors={colors}
                                apiKey={apiKey} setApiKey={setApiKey}
                                walletId={walletId} setWalletId={setWalletId}
                                isSandbox={linkSandbox}
                            />
                        ) : (
                            <>
                                <ProgressDots colors={colors} current={step} total={3} />
                                {step === 1 ? (
                                    <View style={{ marginTop: 16 }}>
                                        <StepTitle colors={colors} title="Seus dados" subtitle="Validamos esses dados pra liberar sua Carteira." />
                                        <Field colors={colors} label="Nome completo"><Input colors={colors} value={name} onChangeText={setName} /></Field>
                                        <Field colors={colors} label="Email"><Input colors={colors} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" /></Field>
                                        <Field colors={colors} label="CPF ou CNPJ"><Input colors={colors} value={cpfCnpj} onChangeText={setCpfCnpj} keyboardType="number-pad" placeholder="apenas números" /></Field>
                                        <Field colors={colors} label="Data de nascimento"><Input colors={colors} value={birthDate} onChangeText={(t) => setBirthDate(maskBrDate(t))} keyboardType="number-pad" placeholder="DD/MM/AAAA" /></Field>
                                        <Field colors={colors} label="Celular (com DDD)"><Input colors={colors} value={mobilePhone} onChangeText={setMobilePhone} keyboardType="phone-pad" placeholder="11987654321" /></Field>
                                        <Field colors={colors} label="Tipo">
                                            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                                                {COMPANY_TYPES.map((t) => {
                                                    const active = companyType === t.value;
                                                    return (
                                                        <TouchableOpacity key={t.value} onPress={() => { Haptics.selectionAsync(); setCompanyType(t.value); }} activeOpacity={0.7} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 100, backgroundColor: active ? colors.purple[600] : colors.surface.card2, borderWidth: 1, borderColor: active ? colors.purple[600] : colors.border.default }}>
                                                            <Text style={{ fontSize: 13, fontWeight: "600", color: active ? "#ffffff" : colors.text.secondary }}>{t.label}</Text>
                                                        </TouchableOpacity>
                                                    );
                                                })}
                                            </View>
                                        </Field>
                                    </View>
                                ) : step === 2 ? (
                                    <View style={{ marginTop: 16 }}>
                                        <StepTitle colors={colors} title="Endereço" subtitle="Precisamos pra completar o cadastro da sua Carteira." />
                                        <Field colors={colors} label="CEP"><Input colors={colors} value={postalCode} onChangeText={setPostalCode} onEndEditing={lookupCep} keyboardType="number-pad" placeholder="01001000" /></Field>
                                        <Field colors={colors} label="Bairro"><Input colors={colors} value={province} onChangeText={setProvince} /></Field>
                                        <Field colors={colors} label="Rua"><Input colors={colors} value={address} onChangeText={setAddress} /></Field>
                                        <Field colors={colors} label="Número"><Input colors={colors} value={addressNumber} onChangeText={setAddressNumber} keyboardType="number-pad" /></Field>
                                    </View>
                                ) : (
                                    <View style={{ marginTop: 16 }}>
                                        <StepTitle colors={colors} title="Faturamento estimado" subtitle="Ajuda a dimensionar os limites iniciais. Pode ajustar depois." />
                                        <Field colors={colors} label="Quanto você espera receber por mês (R$)"><Input colors={colors} value={incomeValue} onChangeText={setIncomeValue} keyboardType="number-pad" placeholder="5000" /></Field>
                                        <View style={{ marginTop: 8, backgroundColor: colors.semantic.warning.bg, borderRadius: 12, padding: 14 }}>
                                            <Text style={{ fontSize: 13, fontWeight: "700", color: colors.semantic.warning.fg, marginBottom: 4 }}>Antes de confirmar:</Text>
                                            <Text style={{ fontSize: 12, color: colors.semantic.warning.fg, lineHeight: 18 }}>• Confira o CPF/CNPJ — é o nome que aparece no recibo do aluno.{"\n"}• Nos primeiros dias podemos pedir documentos extras pra liberação.</Text>
                                        </View>
                                    </View>
                                )}
                            </>
                        )}
                    </ScrollView>

                    {/* Footer de ação */}
                    {mode === "new" ? (
                        <View style={{ paddingHorizontal: 20, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border.subtle, backgroundColor: colors.surface.canvas }}>
                            {step < 3 ? (
                                <PrimaryButton colors={colors} label="Continuar" disabled={step === 1 ? !canStep1 : !canStep2} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setStep((s) => (s + 1) as 2 | 3); }} />
                            ) : (
                                <PrimaryButton colors={colors} label="Confirmar e ativar" disabled={!canStep3} busy={busy} onPress={submitActivation} />
                            )}
                        </View>
                    ) : mode === "link" ? (
                        <View style={{ paddingHorizontal: 20, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border.subtle, backgroundColor: colors.surface.canvas }}>
                            <PrimaryButton colors={colors} label="Conectar conta" disabled={!canLink} busy={busy} onPress={submitLink} />
                        </View>
                    ) : null}
                </KeyboardAvoidingView>
            </SafeAreaView>
        </>
    );
}

function ChooseMode({ colors, onNew, onLink }: { colors: V2Palette; onNew: () => void; onLink: () => void }) {
    return (
        <View style={{ marginTop: 8 }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text.primary, marginBottom: 4 }}>Como você quer ativar?</Text>
            <Text style={{ fontSize: 13, color: colors.text.tertiary, marginBottom: 16, lineHeight: 18 }}>
                A Kinevo tem parceria com a Asaas (regulada pelo Banco Central) que processa os pagamentos por baixo dos panos.
            </Text>

            <TouchableOpacity onPress={onNew} activeOpacity={0.85} style={{ borderWidth: 2, borderColor: colors.purple[600], backgroundColor: colors.purple[100], borderRadius: 16, padding: 16, marginBottom: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <View style={{ width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: toRgba(colors.purple[600], 0.18) }}>
                        <Sparkles size={18} color={colors.purple[700]} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text.primary }}>Ainda não tenho conta Asaas</Text>
                        <Text style={{ fontSize: 11, fontWeight: "700", color: colors.purple[700] }}>Recomendado</Text>
                    </View>
                    <ArrowRight size={18} color={colors.purple[700]} />
                </View>
                <Text style={{ fontSize: 13, color: colors.text.secondary, lineHeight: 18 }}>A Kinevo cria e configura sua conta do zero. Você só preenche seus dados em 3 passos.</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={onLink} activeOpacity={0.85} style={{ borderWidth: 1, borderColor: colors.border.default, backgroundColor: colors.surface.card, borderRadius: 16, padding: 16 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <View style={{ width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface.card2 }}>
                        <Link2 size={18} color={colors.text.secondary} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text.primary }}>Já tenho conta na Asaas</Text>
                        <Text style={{ fontSize: 11, color: colors.text.tertiary }}>Conectar conta existente</Text>
                    </View>
                    <ArrowRight size={18} color={colors.text.tertiary} />
                </View>
                <Text style={{ fontSize: 13, color: colors.text.secondary, lineHeight: 18 }}>Conecte sua conta Asaas via chave de API + Wallet ID. Já vem aprovada.</Text>
            </TouchableOpacity>
        </View>
    );
}

function LinkForm({ colors, apiKey, setApiKey, walletId, setWalletId, isSandbox }: {
    colors: V2Palette; apiKey: string; setApiKey: (s: string) => void; walletId: string; setWalletId: (s: string) => void; isSandbox: boolean;
}) {
    return (
        <View style={{ marginTop: 8 }}>
            <Text style={{ fontSize: 13, color: colors.text.tertiary, marginBottom: 16, lineHeight: 18 }}>
                Pegue duas informações no seu painel da Asaas e cole aqui. 🔒 Guardamos com criptografia.
            </Text>

            {/* Passo 1 */}
            <StepCard colors={colors} num="1" title="Gerar a Chave de API">
                <Text style={{ fontSize: 13, color: colors.text.secondary, lineHeight: 19 }}>
                    Em www.asaas.com → ícone de apps (canto superior direito) → Integrações → aba "Chaves de API" → "Gerar chave de API". Nome: "Kinevo".{"\n"}
                    <Text style={{ fontWeight: "700", color: colors.text.primary }}>Marque "Permitir operações de saque via API"</Text> (sem isso você não saca pelo Kinevo). A chave de produção começa com $aact_prod_.
                </Text>
            </StepCard>
            <Field colors={colors} label="Cole a chave aqui">
                <Input colors={colors} value={apiKey} onChangeText={setApiKey} placeholder="$aact_prod_..." autoCapitalize="none" secureTextEntry />
            </Field>
            {isSandbox ? (
                <View style={{ backgroundColor: colors.semantic.danger.bg, borderRadius: 10, padding: 12, marginBottom: 12 }}>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: colors.semantic.danger.fg }}>Essa chave é de sandbox/homologação</Text>
                    <Text style={{ fontSize: 12, color: colors.semantic.danger.fg, marginTop: 2 }}>Gere uma chave em www.asaas.com (produção) — começa com $aact_prod_.</Text>
                </View>
            ) : null}

            {/* Passo 2 */}
            <StepCard colors={colors} num="2" title="Copiar o Wallet ID">
                <Text style={{ fontSize: 13, color: colors.text.secondary, lineHeight: 19 }}>
                    No mesmo painel → Integrações → aba "Wallet ID" (ou "Minha conta"). Copie o código (formato UUID, com hífens).
                </Text>
            </StepCard>
            <Field colors={colors} label="Cole o Wallet ID aqui">
                <Input colors={colors} value={walletId} onChangeText={setWalletId} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" autoCapitalize="none" />
            </Field>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                <AlertTriangle size={13} color={colors.semantic.warning.fg} />
                <Text style={{ fontSize: 12, color: colors.text.tertiary, flex: 1 }}>Precisa estar logado no painel da Asaas (produção).</Text>
            </View>
        </View>
    );
}

function StepCard({ colors, num, title, children }: { colors: V2Palette; num: string; title: string; children: React.ReactNode }) {
    return (
        <View style={{ borderWidth: 1, borderColor: colors.border.default, borderRadius: 12, overflow: "hidden", marginBottom: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.surface.card2, paddingHorizontal: 12, paddingVertical: 10 }}>
                <View style={{ width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: colors.purple[600] }}>
                    <Text style={{ fontSize: 12, fontWeight: "800", color: "#ffffff" }}>{num}</Text>
                </View>
                <Text style={{ fontSize: 13, fontWeight: "700", color: colors.text.primary }}>{title}</Text>
            </View>
            <View style={{ padding: 12 }}>{children}</View>
        </View>
    );
}

function ProgressDots({ colors, current, total }: { colors: V2Palette; current: number; total: number }) {
    return (
        <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
            {Array.from({ length: total }).map((_, i) => (
                <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i < current ? colors.purple[600] : colors.surface.card2 }} />
            ))}
        </View>
    );
}

function StepTitle({ colors, title, subtitle }: { colors: V2Palette; title: string; subtitle: string }) {
    return (
        <View style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text.primary }}>{title}</Text>
            <Text style={{ fontSize: 13, color: colors.text.tertiary, marginTop: 2 }}>{subtitle}</Text>
        </View>
    );
}

function Field({ colors, label, children }: { colors: V2Palette; label: string; children: React.ReactNode }) {
    return (
        <View style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: colors.text.secondary, marginBottom: 6 }}>{label}</Text>
            {children}
        </View>
    );
}

function Input({ colors, ...props }: { colors: V2Palette } & React.ComponentProps<typeof TextInput>) {
    return (
        <TextInput
            {...props}
            placeholderTextColor={colors.text.quaternary}
            style={{ backgroundColor: colors.surface.card2, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: colors.text.primary, borderWidth: 1, borderColor: colors.border.default }}
        />
    );
}

function PrimaryButton({ colors, label, onPress, disabled, busy }: { colors: V2Palette; label: string; onPress: () => void; disabled?: boolean; busy?: boolean }) {
    return (
        <TouchableOpacity onPress={onPress} disabled={disabled || busy} activeOpacity={0.85} style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: disabled ? colors.surface.card2 : colors.purple[600], borderRadius: 14, paddingVertical: 15 }}>
            {busy ? <ActivityIndicator color="#ffffff" /> : <Text style={{ fontSize: 15, fontWeight: "700", color: disabled ? colors.text.quaternary : "#ffffff" }}>{label}</Text>}
        </TouchableOpacity>
    );
}
