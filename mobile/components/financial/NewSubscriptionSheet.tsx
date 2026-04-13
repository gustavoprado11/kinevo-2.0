import React, { useCallback, useEffect, useState } from "react";
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
import { useRoleMode } from "../../contexts/RoleModeContext";
import type { TrainerPlan } from "../../hooks/useTrainerPlans";

const API_URL = process.env.EXPO_PUBLIC_WEB_URL || "https://app.kinevo.com.br";

type BillingType = "stripe_auto" | "manual_recurring" | "manual_one_off" | "courtesy";
type Step = "student" | "billing" | "plan" | "confirm";

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
    hasStripeConnect: boolean;
    preSelectedStudent?: { id: string; name: string; avatar_url: string | null } | null;
}

function formatCurrency(value: number): string {
    return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

const BILLING_OPTIONS: { key: BillingType; label: string; desc: string; icon: any; requiresStripe?: boolean }[] = [
    { key: "stripe_auto", label: "Cobrança automática (Stripe)", desc: "Cobra automaticamente via cartão a cada ciclo", icon: CreditCard, requiresStripe: true },
    { key: "manual_recurring", label: "Controle manual (recorrente)", desc: "Você registra os pagamentos feitos por fora (Pix, dinheiro, etc.)", icon: DollarSign },
    { key: "manual_one_off", label: "Pagamento único", desc: "Um pagamento avulso, sem renovação automática", icon: DollarSign },
    { key: "courtesy", label: "Acesso gratuito", desc: "Sem cobrança — o aluno treina normalmente", icon: Heart },
];

const INTERVAL_LABELS: Record<string, string> = {
    month: "Mensal",
    quarter: "Trimestral",
    year: "Anual",
};

export function NewSubscriptionSheet({ visible, onClose, onSuccess, plans, hasStripeConnect, preSelectedStudent }: NewSubscriptionSheetProps) {
    const { trainerId } = useRoleMode();

    const [step, setStep] = useState<Step>("student");
    const [students, setStudents] = useState<Student[]>([]);
    const [loadingStudents, setLoadingStudents] = useState(true);
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [selectedBilling, setSelectedBilling] = useState<BillingType | null>(null);
    const [selectedPlan, setSelectedPlan] = useState<TrainerPlan | null>(null);
    const [submitting, setSubmitting] = useState(false);

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

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setSubmitting(true);

        try {
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData?.session?.access_token;
            if (!token) {
                Alert.alert("Erro", "Sessão expirada");
                return;
            }

            if (selectedBilling === "stripe_auto" && selectedPlan?.stripe_price_id) {
                // Generate checkout link + share
                const res = await fetch(`${API_URL}/api/financial/checkout-link`, {
                    method: "POST",
                    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                    body: JSON.stringify({ studentId: selectedStudent.id, planId: selectedPlan.id }),
                });
                const data = await res.json();

                if (data.success && data.url) {
                    onSuccess();
                    onClose();
                    setTimeout(async () => {
                        await Share.share({
                            message: `Link de pagamento Kinevo: ${data.url}`,
                            url: data.url,
                        });
                    }, 500);
                } else {
                    Alert.alert("Erro", data.error || "Falha ao gerar link");
                }
            } else {
                // Create contract via API
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
            }
        } catch (err) {
            Alert.alert("Erro", "Falha na conexão");
        } finally {
            setSubmitting(false);
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
            <SafeAreaView style={{ flex: 1, backgroundColor: "#F2F2F7" }} edges={["top"]}>
                {/* Header */}
                <View style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingHorizontal: 20,
                    paddingVertical: 14,
                    borderBottomWidth: 1,
                    borderBottomColor: "rgba(0,0,0,0.06)",
                }}>
                    {step !== "student" ? (
                        <TouchableOpacity onPress={handleBack} hitSlop={8}>
                            <Text style={{ fontSize: 15, color: "#7c3aed", fontWeight: "600" }}>Voltar</Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity onPress={onClose} hitSlop={8}>
                            <X size={22} color="#64748b" />
                        </TouchableOpacity>
                    )}
                    <Text style={{ fontSize: 17, fontWeight: "600", color: "#0f172a" }}>
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
                                <ActivityIndicator color="#7c3aed" size="large" />
                            </View>
                        ) : students.length === 0 ? (
                            <View style={{ paddingTop: 40, alignItems: "center" }}>
                                <Users size={40} color="#cbd5e1" />
                                <Text style={{ fontSize: 16, fontWeight: "600", color: "#94a3b8", marginTop: 12 }}>
                                    Nenhum aluno encontrado
                                </Text>
                            </View>
                        ) : (
                            <View style={{ backgroundColor: "#ffffff", borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: "rgba(0,0,0,0.04)" }}>
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
                                                borderBottomColor: "#f1f5f9",
                                            }}
                                        >
                                            {s.avatar_url ? (
                                                <Image
                                                    source={{ uri: s.avatar_url }}
                                                    style={{ width: 40, height: 40, borderRadius: 12, marginRight: 12, backgroundColor: "#f1f5f9" }}
                                                />
                                            ) : (
                                                <View style={{
                                                    width: 40, height: 40, borderRadius: 12,
                                                    backgroundColor: "#f5f3ff", alignItems: "center",
                                                    justifyContent: "center", marginRight: 12,
                                                }}>
                                                    <Text style={{ fontSize: 14, fontWeight: "700", color: "#7c3aed" }}>{initials}</Text>
                                                </View>
                                            )}
                                            <Text style={{ flex: 1, fontSize: 15, fontWeight: "500", color: "#0f172a" }}>
                                                {s.name}
                                            </Text>
                                            <ChevronRight size={16} color="#cbd5e1" />
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
                                if (opt.requiresStripe && !hasStripeConnect) return null;
                                const Icon = opt.icon;
                                return (
                                    <TouchableOpacity
                                        key={opt.key}
                                        onPress={() => handleSelectBilling(opt.key)}
                                        activeOpacity={0.6}
                                        style={{
                                            backgroundColor: "#ffffff",
                                            borderRadius: 14,
                                            padding: 16,
                                            flexDirection: "row",
                                            alignItems: "center",
                                            borderWidth: 1,
                                            borderColor: "rgba(0,0,0,0.04)",
                                        }}
                                    >
                                        <View style={{
                                            width: 40, height: 40, borderRadius: 12,
                                            backgroundColor: "#f5f3ff", alignItems: "center",
                                            justifyContent: "center", marginRight: 14,
                                        }}>
                                            <Icon size={18} color="#7c3aed" />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ fontSize: 15, fontWeight: "600", color: "#0f172a" }}>
                                                {opt.label}
                                            </Text>
                                            <Text style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                                                {opt.desc}
                                            </Text>
                                        </View>
                                        <ChevronRight size={16} color="#cbd5e1" />
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    )}

                    {/* Step 3: Plan selection */}
                    {step === "plan" && (
                        plans.length === 0 ? (
                            <View style={{ paddingTop: 40, alignItems: "center" }}>
                                <DollarSign size={40} color="#cbd5e1" />
                                <Text style={{ fontSize: 16, fontWeight: "600", color: "#94a3b8", marginTop: 12 }}>
                                    Nenhum plano ativo
                                </Text>
                                <Text style={{ fontSize: 13, color: "#cbd5e1", marginTop: 4, textAlign: "center" }}>
                                    Crie um plano na tela Meus Planos primeiro
                                </Text>
                            </View>
                        ) : (
                            <View style={{ gap: 10 }}>
                                {plans.filter(p => p.is_active).map((plan) => {
                                    const canStripe = selectedBilling === "stripe_auto" && !!plan.stripe_price_id;
                                    const isStripeMode = selectedBilling === "stripe_auto";
                                    const disabled = isStripeMode && !plan.stripe_price_id;

                                    return (
                                        <TouchableOpacity
                                            key={plan.id}
                                            onPress={() => !disabled && handleSelectPlan(plan)}
                                            activeOpacity={disabled ? 1 : 0.6}
                                            style={{
                                                backgroundColor: disabled ? "#f8fafc" : "#ffffff",
                                                borderRadius: 14,
                                                padding: 16,
                                                borderWidth: 1,
                                                borderColor: "rgba(0,0,0,0.04)",
                                                opacity: disabled ? 0.5 : 1,
                                            }}
                                        >
                                            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={{ fontSize: 16, fontWeight: "700", color: "#0f172a" }}>
                                                        {plan.title}
                                                    </Text>
                                                    <Text style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>
                                                        {formatCurrency(plan.price)} / {(INTERVAL_LABELS[plan.interval] || "mês").toLowerCase()}
                                                    </Text>
                                                    {disabled && (
                                                        <Text style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>
                                                            Sem integração Stripe
                                                        </Text>
                                                    )}
                                                </View>
                                                <ChevronRight size={16} color="#cbd5e1" />
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        )
                    )}

                    {/* Step 4: Confirmation */}
                    {step === "confirm" && (
                        <View>
                            {/* Summary card */}
                            <View style={{
                                backgroundColor: "#ffffff",
                                borderRadius: 16,
                                padding: 20,
                                borderWidth: 1,
                                borderColor: "rgba(0,0,0,0.04)",
                                marginBottom: 20,
                            }}>
                                <Text style={{ fontSize: 11, fontWeight: "600", color: "#94a3b8", letterSpacing: 1, marginBottom: 14 }}>
                                    RESUMO
                                </Text>

                                <SummaryRow label="Aluno" value={selectedStudent?.name || "—"} />
                                <SummaryRow
                                    label="Cobrança"
                                    value={
                                        selectedBilling === "stripe_auto" ? "Cobrança automática (Stripe)" :
                                        selectedBilling === "manual_recurring" ? "Controle manual (recorrente)" :
                                        selectedBilling === "manual_one_off" ? "Pagamento único" : "Acesso gratuito"
                                    }
                                />
                                {selectedPlan && (
                                    <>
                                        <SummaryRow label="Plano" value={selectedPlan.title} />
                                        <SummaryRow label="Valor" value={formatCurrency(selectedPlan.price)} />
                                        <SummaryRow label="Recorrência" value={INTERVAL_LABELS[selectedPlan.interval] || selectedPlan.interval} />
                                    </>
                                )}
                                {selectedBilling === "courtesy" && (
                                    <SummaryRow label="Valor" value="Gratuito" />
                                )}
                            </View>

                            {/* Info text */}
                            {selectedBilling === "stripe_auto" && (
                                <View style={{ backgroundColor: "#f5f3ff", borderRadius: 12, padding: 14, marginBottom: 20 }}>
                                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                        <LinkIcon size={14} color="#7c3aed" />
                                        <Text style={{ fontSize: 13, color: "#7c3aed", fontWeight: "500", flex: 1 }}>
                                            Um link de pagamento será gerado para compartilhar com o aluno
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
                                    backgroundColor: "#7c3aed",
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
                                        {selectedBilling === "stripe_auto" ? "Gerar Link de Pagamento" : "Confirmar Cobrança"}
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

function SummaryRow({ label, value }: { label: string; value: string }) {
    return (
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
            <Text style={{ fontSize: 14, color: "#64748b" }}>{label}</Text>
            <Text style={{ fontSize: 14, fontWeight: "600", color: "#0f172a" }}>{value}</Text>
        </View>
    );
}
