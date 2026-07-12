import React, { useState, useEffect, useCallback } from "react";
import { View, Text, ScrollView, Switch, ActivityIndicator, TouchableOpacity, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Calendar, ChevronLeft } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { supabase } from "../lib/supabase";
import { useV2Colors } from "../hooks/useV2Colors";
import {
    useTrainerNotificationPreferences,
    type AppointmentReminderMinutes,
} from "../hooks/useTrainerNotificationPreferences";
import { syncAllRuleReminders } from "../hooks/useScheduleAppointmentReminder";

const API_URL = process.env.EXPO_PUBLIC_WEB_URL || "https://www.kinevoapp.com";

interface NotificationPreferences {
    workout_completed: boolean;
    form_submitted: boolean;
    payment_received: boolean;
    payment_overdue: boolean;
    program_expiring: boolean;
    student_inactive: boolean;
}

const PREF_LABELS: { key: keyof NotificationPreferences; label: string; description: string }[] = [
    { key: "workout_completed", label: "Treino concluído", description: "Quando um aluno finaliza um treino" },
    { key: "form_submitted", label: "Formulário respondido", description: "Quando um aluno responde um formulário" },
    { key: "payment_received", label: "Pagamento recebido", description: "Confirmação de pagamentos" },
    { key: "payment_overdue", label: "Pagamento vencido", description: "Alertas de inadimplência" },
    { key: "program_expiring", label: "Programa expirando", description: "Programa prestes a encerrar" },
    { key: "student_inactive", label: "Aluno inativo", description: "Alunos sem atividade recente" },
];

const DEFAULT_PREFS: NotificationPreferences = {
    workout_completed: true,
    form_submitted: true,
    payment_received: true,
    payment_overdue: true,
    program_expiring: true,
    student_inactive: true,
};

const REMINDER_OPTIONS: AppointmentReminderMinutes[] = [15, 30, 60];

export default function NotificationSettingsScreen() {
    const router = useRouter();
    const v2colors = useV2Colors();
    const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFS);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const {
        appointmentRemindersEnabled,
        appointmentReminderMinutes,
        isSaving: isSavingAppt,
        setAppointmentRemindersEnabled,
        setAppointmentReminderMinutes,
    } = useTrainerNotificationPreferences();

    const fetchPreferences = useCallback(async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) return;

            const res = await fetch(`${API_URL}/api/notifications/preferences`, {
                headers: { Authorization: `Bearer ${session.access_token}` },
            });

            const contentType = res.headers.get("content-type") || "";
            if (res.ok && contentType.includes("application/json")) {
                const data = await res.json();
                setPreferences({ ...DEFAULT_PREFS, ...data.preferences });
            }
        } catch (err) {
            if (__DEV__) console.error("[notification-settings] Fetch error:", err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPreferences();
    }, [fetchPreferences]);

    const togglePreference = useCallback(async (key: keyof NotificationPreferences) => {
        const updated = { ...preferences, [key]: !preferences[key] };
        setPreferences(updated);
        setIsSaving(true);

        // MB9: revert FUNCIONAL por chave — o revert por closure inteira
        // desfazia também um segundo toggle feito enquanto este salvava.
        const revert = () =>
            setPreferences((prev) => ({ ...prev, [key]: preferences[key] }));

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
                revert();
                return;
            }

            const res = await fetch(`${API_URL}/api/notifications/preferences`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ preferences: updated }),
            });
            // MB9: um 401/500 mantinha o switch trocado divergindo do servidor.
            if (!res.ok) {
                if (__DEV__) console.error("[notification-settings] Save failed:", res.status);
                revert();
            }
        } catch (err) {
            if (__DEV__) console.error("[notification-settings] Save error:", err);
            revert();
        } finally {
            setIsSaving(false);
        }
    }, [preferences]);

    const handleToggleAppointmentReminders = useCallback(
        async (next: boolean) => {
            Haptics.selectionAsync();
            await setAppointmentRemindersEnabled(next);
            // When toggling off we don't proactively cancel scheduled pushes —
            // they'll quietly run unless the trainer also lowers permission.
            // When toggling back on we sync everything tracked locally to the
            // current minutes preference so existing rules get pushes again.
            if (next) {
                await syncAllRuleReminders(appointmentReminderMinutes);
            }
        },
        [setAppointmentRemindersEnabled, appointmentReminderMinutes],
    );

    const handlePickReminderMinutes = useCallback(
        async (next: AppointmentReminderMinutes) => {
            if (next === appointmentReminderMinutes) return;
            Haptics.selectionAsync();
            await setAppointmentReminderMinutes(next);
            // Re-schedule existing rules with the new offset.
            if (appointmentRemindersEnabled) {
                await syncAllRuleReminders(next);
            }
        },
        [appointmentReminderMinutes, appointmentRemindersEnabled, setAppointmentReminderMinutes],
    );

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: v2colors.surface.canvas }} edges={["top"]}>
            {/* Header */}
            <View
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                }}
            >
                <TouchableOpacity
                    onPress={() => router.back()}
                    accessibilityRole="button"
                    accessibilityLabel="Voltar"
                    hitSlop={12}
                >
                    <ChevronLeft size={24} color={v2colors.text.primary} />
                </TouchableOpacity>

                <Text style={{ fontSize: 18, fontWeight: "700", color: v2colors.text.primary }}>
                    Notificações
                </Text>

                {/* Spacer to center title */}
                <View style={{ width: 24 }} />
            </View>

            {isLoading ? (
                <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                    <ActivityIndicator size="large" color={v2colors.purple[600]} />
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 60 }}
                    showsVerticalScrollIndicator={false}
                >
                    <Text style={{ fontSize: 13, color: v2colors.text.secondary, lineHeight: 20, marginBottom: 20, paddingHorizontal: 4 }}>
                        Escolha quais notificações push você deseja receber no seu dispositivo.
                    </Text>

                    {/* Appointment reminders ── */}
                    <Text
                        style={{
                            fontSize: 11,
                            fontWeight: "700",
                            color: v2colors.text.tertiary,
                            textTransform: "uppercase",
                            letterSpacing: 1.5,
                            marginBottom: 8,
                            paddingLeft: 4,
                        }}
                    >
                        Lembretes de agenda
                    </Text>
                    <View
                        style={{
                            backgroundColor: v2colors.surface.card,
                            borderRadius: 16,
                            overflow: "hidden",
                            borderWidth: 1,
                            borderColor: "rgba(0,0,0,0.04)",
                            marginBottom: 24,
                        }}
                    >
                        <View
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                paddingVertical: 14,
                                paddingHorizontal: 20,
                            }}
                        >
                            <View
                                style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 10,
                                    backgroundColor: v2colors.purple[100],
                                    alignItems: "center",
                                    justifyContent: "center",
                                    marginRight: 12,
                                }}
                            >
                                <Calendar size={16} color={v2colors.purple[600]} />
                            </View>
                            <View style={{ flex: 1, marginRight: 12 }}>
                                <Text style={{ fontSize: 14, fontWeight: "500", color: v2colors.text.primary }}>
                                    Receber lembretes
                                </Text>
                                <Text style={{ fontSize: 12, color: v2colors.text.tertiary, marginTop: 2 }}>
                                    Aviso antes de cada atendimento
                                </Text>
                            </View>
                            <Switch
                                value={appointmentRemindersEnabled}
                                onValueChange={handleToggleAppointmentReminders}
                                trackColor={{ false: v2colors.border.default, true: v2colors.purple[600] }}
                                thumbColor="#fff"
                                disabled={isSavingAppt}
                            />
                        </View>

                        {appointmentRemindersEnabled && (
                            <>
                                <View style={{ height: 1, backgroundColor: v2colors.border.subtle, marginHorizontal: 20 }} />
                                <View style={{ paddingVertical: 14, paddingHorizontal: 20 }}>
                                    <Text style={{ fontSize: 14, fontWeight: "500", color: v2colors.text.primary }}>
                                        Antecedência
                                    </Text>
                                    <Text style={{ fontSize: 12, color: v2colors.text.tertiary, marginTop: 2 }}>
                                        Quanto tempo antes do horário marcado
                                    </Text>
                                    <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                                        {REMINDER_OPTIONS.map((opt) => {
                                            const selected = opt === appointmentReminderMinutes;
                                            return (
                                                <Pressable
                                                    key={opt}
                                                    onPress={() => handlePickReminderMinutes(opt)}
                                                    style={{
                                                        flex: 1,
                                                        paddingVertical: 10,
                                                        borderRadius: 10,
                                                        alignItems: "center",
                                                        backgroundColor: selected ? v2colors.purple[600] : v2colors.surface.card2,
                                                        borderWidth: 1,
                                                        borderColor: selected ? v2colors.purple[600] : v2colors.border.default,
                                                    }}
                                                >
                                                    <Text
                                                        style={{
                                                            fontSize: 13,
                                                            fontWeight: "600",
                                                            color: selected ? "#ffffff" : v2colors.text.primary,
                                                        }}
                                                    >
                                                        {opt === 60 ? "1 hora" : `${opt} min`}
                                                    </Text>
                                                </Pressable>
                                            );
                                        })}
                                    </View>
                                    <Text style={{ fontSize: 11, color: v2colors.text.tertiary, marginTop: 10 }}>
                                        Você receberá um lembrete {appointmentReminderMinutes === 60 ? "1 hora" : `${appointmentReminderMinutes} min`} antes de cada agendamento.
                                    </Text>
                                </View>
                            </>
                        )}
                    </View>

                    <Text
                        style={{
                            fontSize: 11,
                            fontWeight: "700",
                            color: v2colors.text.tertiary,
                            textTransform: "uppercase",
                            letterSpacing: 1.5,
                            marginBottom: 8,
                            paddingLeft: 4,
                        }}
                    >
                        Outras notificações
                    </Text>
                    <View
                        style={{
                            backgroundColor: v2colors.surface.card,
                            borderRadius: 16,
                            overflow: "hidden",
                            borderWidth: 1,
                            borderColor: "rgba(0,0,0,0.04)",
                        }}
                    >
                        {PREF_LABELS.map((item, index) => (
                            <React.Fragment key={item.key}>
                                {index > 0 && (
                                    <View style={{ height: 1, backgroundColor: v2colors.border.subtle, marginHorizontal: 20 }} />
                                )}
                                <View
                                    style={{
                                        flexDirection: "row",
                                        alignItems: "center",
                                        paddingVertical: 14,
                                        paddingHorizontal: 20,
                                    }}
                                >
                                    <View style={{ flex: 1, marginRight: 12 }}>
                                        <Text style={{ fontSize: 14, fontWeight: "500", color: v2colors.text.primary }}>
                                            {item.label}
                                        </Text>
                                        <Text style={{ fontSize: 12, color: v2colors.text.tertiary, marginTop: 2 }}>
                                            {item.description}
                                        </Text>
                                    </View>
                                    <Switch
                                        value={preferences[item.key]}
                                        onValueChange={() => togglePreference(item.key)}
                                        trackColor={{ false: v2colors.border.default, true: v2colors.purple[600] }}
                                        thumbColor="#fff"
                                        disabled={isSaving}
                                    />
                                </View>
                            </React.Fragment>
                        ))}
                    </View>

                    {isSaving && (
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 16, gap: 8 }}>
                            <ActivityIndicator size="small" color={v2colors.purple[600]} />
                            <Text style={{ fontSize: 12, color: v2colors.text.tertiary }}>Salvando...</Text>
                        </View>
                    )}
                </ScrollView>
            )}
        </SafeAreaView>
    );
}
