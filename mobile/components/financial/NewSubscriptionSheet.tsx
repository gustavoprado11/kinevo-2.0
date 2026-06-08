import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    Modal,
    ScrollView,
    ActivityIndicator,
    Alert,
    Share,
    Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { X, ChevronRight, Users, Heart, DollarSign, CreditCard, Link as LinkIcon } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { supabase } from "../../lib/supabase";
import { walletFetch } from "../../lib/wallet-api";
import { useRoleMode } from "../../contexts/RoleModeContext";
import type { TrainerPlan } from "../../hooks/useTrainerPlans";
import { useV2Colors, type V2Palette } from "../../hooks/useV2Colors";
import { toRgba } from "../../lib/brandColor";
import { formatBRL } from "@/lib/currency";

const API_URL = process.env.EXPO_PUBLIC_WEB_URL || "https://www.kinevoapp.com";

type BillingType = "asaas_recurring" | "asaas_one_off" | "manual_recurring" | "manual_one_off" | "courtesy";
type Step = "student" | "billing" | "plan" | "confirm";

const isAsaas = (b: BillingType | null) => b === "asaas_recurring" || b === "asaas_one_off";

interface Student {
    id: string;
    name: string;
    avatar_url: string | null;
}

interface NewSubscriptionSheetProps {
    visible: boolean;
    onClose: () => void;
    onSuccess: () => void;
    plans: TrainerPlan[];
    /** Carteira Asaas aprovada → habilita cobrança via PIX/cartão/boleto. */
    walletApproved: boolean;
    preSelectedStudent?: { id: string; name: string; avatar_url: string | null } | null;
}

function formatCurrency(value: number): string {
    return formatBRL(value);
}

const BILLING_OPTIONS: { key: BillingType; label: string; desc: string; icon: any; requiresWallet?: boolean }[] = [
    { key: "asaas_recurring", label: "Assinatura via Carteira", desc: "Cartão de crédito — cobra automático todo ciclo. Gera link pra enviar.", icon: CreditCard, requiresWallet: true },
    { key: "asaas_one_off", label: "Cobrança avulsa via Carteira", desc: "PIX, cartão ou boleto, uma vez. Gera link pra enviar.", icon: DollarSign, requiresWallet: true },
    { key: "manual_recurring", label: "Controle manual (recorrente)", desc: "Você registra os pagamentos feitos por fora (Pix, dinheiro, etc.)", icon: DollarSign },
    { key: "manual_one_off", label: "Pagamento único", desc: "Um pagamento avulso, sem renovação automática", icon: DollarSign },
    { key: "courtesy", label: "Acesso gratuito", desc: "Sem cobrança — o aluno treina normalmente", icon: Heart },
];

const INTERVAL_LABELS: Record<string, string> = {
    month: "Mensal",
    quarter: "Trimestral",
    year: "Anual",
};

export function NewSubscriptionSheet({ visible, onClose, onSuccess, plans, walletApproved, preSelectedStudent }: NewSubscriptionSheetProps) {
    const colors = useV2Colors();
    const { trainerId } = useRoleMode();

    const [step, setStep] = useState<Step>("student");
    const [students, setStudents] = useState<Student[]>([]);
    const [loadingStudents, setLoadingStudents] = useState(true);
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [selectedBilling, setSelectedBilling] = useState<BillingType | null>(null);
    const [selectedPlan, setSelectedPlan] = useState<TrainerPlan | null>(null);
    const [submitting, setSubmitting] = useState(false);
    // A3: guard idempotente síncrono — `submitting` (state) só reflete no próximo
    // render, então dois toques no mesmo frame disparavam duas cobranças/links.
    const submittingRef = useRef(false);

    // Fetch students on open
    useEffect(() => {
        if (visible && trainerId) {
            setLoadingStudents(true);
            supabase
                .from("students")
                .select("id, name, avatar_url")
                .eq("coach_id", trainerId)
                .eq("status", "active")
                .order("name")
                .then(({ data }) => {
                    setStudents((data as any as Student[]) || []);
                    setLoadingStudents(false);
                });
        }
    }, [visible, trainerId]);

    // Reset on close / set pre-selected student on open
    useEffect(() => {
        if (!visible) {
            setStep("student");
            setSelectedStudent(null);
            setSelectedBilling(null);
            setSelectedPlan(null);
        } else if (preSelectedStudent) {
            setSelectedStudent(preSelectedStudent);
            setStep("billing");
        }
    }, [visible, preSelectedStudent]);

    const handleSelectStudent = (student: Student) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSelectedStudent(student);
        setStep("billing");
    };

    const handleSelectBilling = (type: BillingType) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSelectedBilling(type);
        if (type === "courtesy") {
            // Skip plan selection for courtesy
            setSelectedPlan(null);
            setStep("confirm");
        } else {
            setStep("plan");
        }
    };

    const handleSelectPlan = (plan: TrainerPlan) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSelectedPlan(plan);
        setStep("confirm");
    };

    const handleBack = () => {
        switch (step) {
            case "billing":
                if (preSelectedStudent) {
                    onClose();
                } else {
                    setStep("student");
                }
                break;
            case "plan":
                setStep("billing");
                break;
            case "confirm":
                if (selectedBilling === "courtesy") setStep("billing");
                else setStep("plan");
                break;
        }
    };

    const handleConfirm = useCallback(async () => {
        if (!selectedStudent) return;
        if (submittingRef.current) return; // A3: ignora duplo-tap
        submittingRef.current = true;

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setSubmitting(true);

        try {
            if (isAsaas(selectedBilling)) {
                // Cobrança via Carteira Asaas → gera Payment Link pra compartilhar.
                if (!selectedPlan) {
                    Alert.alert("Erro", "Selecione um plano para a cobrança.");
                    return;
                }
                let url: string;
                if (selectedBilling === "asaas_recurring") {
                    const r = await walletFetch<{ url: string }>("/api/wallet/subscriptions", {
                        method: "POST",
                        body: { studentId: selectedStudent.id, planId: selectedPlan.id },
                    });
                    url = r.url;
                } else {
                    // dueDate padrão: hoje + 3 dias (YYYY-MM-DD)
                    const dueDate = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
                    const r = await walletFetch<{ url: string }>("/api/wallet/charges", {
                        method: "POST",
                        body: { studentId: selectedStudent.id, planId: selectedPlan.id, value: selectedPlan.price, dueDate },
                    });
                    url = r.url;
                }
                onSuccess();
                onClose();
                setTimeout(async () => {
                    await Share.share({ message: `Link de pagamento Kinevo: ${url}`, url });
                }, 500);
                return;
            }

            // Manual / cortesia → cria contrato local (provider-agnóstico).
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData?.session?.access_token;
            if (!token) {
                Alert.alert("Erro", "Sessão expirada");
                return;
            }
            const res = await fetch(`${API_URL}/api/financial/create-contract`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                    studentId: selectedStudent.id,
                    planId: selectedPlan?.id || null,
                    billingType: selectedBilling,
                    blockOnFail: false,
                }),
            });
            const data = await res.json();
            if (data.success) {
                Alert.alert("Sucesso", "Cobrança criada com sucesso!");
                onSuccess();
                onClose();
            } else {
                Alert.alert("Erro", data.error || "Falha ao criar cobrança");
            }
        } catch (err) {
            Alert.alert("Erro", err instanceof Error ? err.message : "Falha na conexão");
        } finally {
            setSubmitting(false);
            submittingRef.current = false;
        }
    }, [selectedStudent, selectedBilling, selectedPlan, onSuccess, onClose]);

    const getStepTitle = () => {
        switch (step) {
            case "student": return "Selecione o aluno";
            case "billing": return "Tipo de cobrança";
            case "plan": return "Selecione o plano";
            case "confirm": return "Confirmar cobrança";
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.canvas }} edges={["top"]}>
                {/* Header */}
                <View style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingHorizontal: 20,
                    paddingVertical: 14,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border.default,
                }}>
                    {step !== "student" ? (
                        <TouchableOpacity onPress={handleBack} hitSlop={8}>
                            <Text style={{ fontSize: 15, color: colors.purple[600], fontWeight: "600" }}>Voltar</Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity onPress={onClose} hitSlop={8}>
                            <X size={22} color={colors.text.tertiary} />
                        </TouchableOpacity>
                    )}
                    <Text style={{ fontSize: 17, fontWeight: "600", color: colors.text.primary }}>
                        {getStepTitle()}
                    </Text>
                    <View style={{ width: 40 }} />
                </View>

                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Step 1: Select student */}
                    {step === "student" && (
                        loadingStudents ? (
                            <View style={{ paddingTop: 40, alignItems: "center" }}>
                                <ActivityIndicator color={colors.purple[600]} size="large" />
                            </View>
                        ) : students.length === 0 ? (
                            <View style={{ paddingTop: 40, alignItems: "center" }}>
                                <Users size={40} color={colors.text.quaternary} />
                                <Text style={{ fontSize: 16, fontWeight: "600", color: colors.text.tertiary, marginTop: 12 }}>
                                    Nenhum aluno encontrado
                                </Text>
                            </View>
                        ) : (
                            <View style={{ backgroundColor: colors.surface.card, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: colors.border.subtle }}>
                                {students.map((s, idx) => {
                                    const initials = s.name?.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
                                    return (
                                        <TouchableOpacity
                                            key={s.id}
                                            onPress={() => handleSelectStudent(s)}
                                            activeOpacity={0.6}
                                            style={{
                                                flexDirection: "row",
                                                alignItems: "center",
                                                padding: 14,
                                                borderBottomWidth: idx < students.length - 1 ? 1 : 0,
                                                borderBottomColor: colors.border.subtle,
                                            }}
                                        >
                                            {s.avatar_url ? (
                                                <Image
                                                    source={{ uri: s.avatar_url }}
                                                    style={{ width: 40, height: 40, borderRadius: 12, marginRight: 12, backgroundColor: colors.surface.card2 }}
                                                />
                                            ) : (
                                                <View style={{
                                                    width: 40, height: 40, borderRadius: 12,
                                                    backgroundColor: colors.purple[100], alignItems: "center",
                                                    justifyContent: "center", marginRight: 12,
                                                }}>
                                                    <Text style={{ fontSize: 14, fontWeight: "700", color: colors.purple[600] }}>{initials}</Text>
                                                </View>
                                            )}
                                            <Text style={{ flex: 1, fontSize: 15, fontWeight: "500", color: colors.text.primary }}>
                                                {s.name}
                                            </Text>
                                            <ChevronRight size={16} color={colors.text.quaternary} />
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        )
                    )}

                    {/* Step 2: Billing type */}
                    {step === "billing" && (
                        <View style={{ gap: 10 }}>
                            {BILLING_OPTIONS.map((opt) => {
                                if (opt.requiresWallet && !walletApproved) return null;
                                const Icon = opt.icon;
                                return (
                                    <TouchableOpacity
                                        key={opt.key}
                                        onPress={() => handleSelectBilling(opt.key)}
                                        activeOpacity={0.6}
                                        style={{
                                            backgroundColor: colors.surface.card,
                                            borderRadius: 14,
                                            padding: 16,
                                            flexDirection: "row",
                                            alignItems: "center",
                                            borderWidth: 1,
                                            borderColor: colors.border.subtle,
                                        }}
                                    >
                                        <View style={{
                                            width: 40, height: 40, borderRadius: 12,
                                            backgroundColor: colors.purple[100], alignItems: "center",
                                            justifyContent: "center", marginRight: 14,
                                        }}>
                                            <Icon size={18} color={colors.purple[600]} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ fontSize: 15, fontWeight: "600", color: colors.text.primary }}>
                                                {opt.label}
                                            </Text>
                                            <Text style={{ fontSize: 12, color: colors.text.tertiary, marginTop: 2 }}>
                                                {opt.desc}
                                            </Text>
                                        </View>
                                        <ChevronRight size={16} color={colors.text.quaternary} />
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    )}

                    {/* Step 3: Plan selection */}
                    {step === "plan" && (
                        plans.length === 0 ? (
                            <View style={{ paddingTop: 40, alignItems: "center" }}>
                                <DollarSign size={40} color={colors.text.quaternary} />
                                <Text style={{ fontSize: 16, fontWeight: "600", color: colors.text.tertiary, marginTop: 12 }}>
                                    Nenhum plano ativo
                                </Text>
                                <Text style={{ fontSize: 13, color: colors.text.quaternary, marginTop: 4, textAlign: "center" }}>
                                    Crie um plano na tela Meus Planos primeiro
                                </Text>
                            </View>
                        ) : (
                            <View style={{ gap: 10 }}>
                                {plans.filter(p => p.is_active).map((plan) => (
                                    <TouchableOpacity
                                        key={plan.id}
                                        onPress={() => handleSelectPlan(plan)}
                                        activeOpacity={0.6}
                                        style={{
                                            backgroundColor: colors.surface.card,
                                            borderRadius: 14,
                                            padding: 16,
                                            borderWidth: 1,
                                            borderColor: colors.border.subtle,
                                        }}
                                    >
                                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text.primary }}>
                                                    {plan.title}
                                                </Text>
                                                <Text style={{ fontSize: 13, color: colors.text.tertiary, marginTop: 2 }}>
                                                    {formatCurrency(plan.price)} / {(INTERVAL_LABELS[plan.interval] || "mês").toLowerCase()}
                                                </Text>
                                            </View>
                                            <ChevronRight size={16} color={colors.text.quaternary} />
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )
                    )}

                    {/* Step 4: Confirmation */}
                    {step === "confirm" && (
                        <View>
                            {/* Summary card */}
                            <View style={{
                                backgroundColor: colors.surface.card,
                                borderRadius: 16,
                                padding: 20,
                                borderWidth: 1,
                                borderColor: colors.border.subtle,
                                marginBottom: 20,
                            }}>
                                <Text style={{ fontSize: 11, fontWeight: "600", color: colors.text.quaternary, letterSpacing: 1, marginBottom: 14 }}>
                                    RESUMO
                                </Text>

                                <SummaryRow colors={colors} label="Aluno" value={selectedStudent?.name || "—"} />
                                <SummaryRow
                                    colors={colors}
                                    label="Cobrança"
                                    value={
                                        selectedBilling === "asaas_recurring" ? "Assinatura via Carteira" :
                                        selectedBilling === "asaas_one_off" ? "Cobrança avulsa via Carteira" :
                                        selectedBilling === "manual_recurring" ? "Controle manual (recorrente)" :
                                        selectedBilling === "manual_one_off" ? "Pagamento único" : "Acesso gratuito"
                                    }
                                />
                                {selectedPlan && (
                                    <>
                                        <SummaryRow colors={colors} label="Plano" value={selectedPlan.title} />
                                        <SummaryRow colors={colors} label="Valor" value={formatCurrency(selectedPlan.price)} />
                                        <SummaryRow colors={colors} label="Recorrência" value={INTERVAL_LABELS[selectedPlan.interval] || selectedPlan.interval} />
                                    </>
                                )}
                                {selectedBilling === "courtesy" && (
                                    <SummaryRow colors={colors} label="Valor" value="Gratuito" />
                                )}
                            </View>

                            {/* Info text */}
                            {isAsaas(selectedBilling) && (
                                <View style={{ backgroundColor: toRgba(colors.purple[600], 0.12), borderRadius: 12, padding: 14, marginBottom: 20 }}>
                                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                        <LinkIcon size={14} color={colors.purple[600]} />
                                        <Text style={{ fontSize: 13, color: colors.purple[600], fontWeight: "500", flex: 1 }}>
                                            {selectedBilling === "asaas_recurring"
                                                ? "Assinatura no cartão de crédito (cobrança automática todo ciclo). Um link é gerado para o aluno cadastrar o cartão."
                                                : "Um link de pagamento (PIX, cartão ou boleto) será gerado para compartilhar com o aluno."}
                                        </Text>
                                    </View>
                                </View>
                            )}

                            {/* Confirm button */}
                            <TouchableOpacity
                                onPress={handleConfirm}
                                disabled={submitting}
                                activeOpacity={0.7}
                                style={{
                                    backgroundColor: colors.purple[600],
                                    borderRadius: 14,
                                    paddingVertical: 16,
                                    alignItems: "center",
                                    justifyContent: "center",
                                    opacity: submitting ? 0.7 : 1,
                                }}
                            >
                                {submitting ? (
                                    <ActivityIndicator color="#ffffff" />
                                ) : (
                                    <Text style={{ fontSize: 16, fontWeight: "700", color: "#ffffff" }}>
                                        {isAsaas(selectedBilling) ? "Gerar link de pagamento" : "Confirmar cobrança"}
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}
                </ScrollView>
            </SafeAreaView>
        </Modal>
    );
}

function SummaryRow({ label, value, colors }: { label: string; value: string; colors: V2Palette }) {
    return (
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
            <Text style={{ fontSize: 14, color: colors.text.tertiary }}>{label}</Text>
            <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text.primary }}>{value}</Text>
        </View>
    );
}
