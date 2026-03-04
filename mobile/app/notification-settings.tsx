import React, { useState, useEffect, useCallback } from "react";
import { View, Text, ScrollView, Switch, ActivityIndicator } from "react-native";
import { Stack } from "expo-router";
import { supabase } from "../lib/supabase";

const API_URL = process.env.EXPO_PUBLIC_WEB_URL || "https://app.kinevo.com.br";

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

export default function NotificationSettingsScreen() {
    const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFS);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

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
            console.error("[notification-settings] Fetch error:", err);
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

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) return;

            await fetch(`${API_URL}/api/notifications/preferences`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ preferences: updated }),
            });
        } catch (err) {
            console.error("[notification-settings] Save error:", err);
            // Revert on error
            setPreferences(preferences);
        } finally {
            setIsSaving(false);
        }
    }, [preferences]);

    if (isLoading) {
        return (
            <>
                <Stack.Screen options={{ title: "Notificações", headerStyle: { backgroundColor: "#F2F2F7" }, headerTintColor: "#0f172a" }} />
                <View style={{ flex: 1, backgroundColor: "#F2F2F7", justifyContent: "center", alignItems: "center" }}>
                    <ActivityIndicator size="large" color="#7c3aed" />
                </View>
            </>
        );
    }

    return (
        <>
            <Stack.Screen options={{ title: "Notificações", headerStyle: { backgroundColor: "#F2F2F7" }, headerTintColor: "#0f172a" }} />
            <ScrollView style={{ flex: 1, backgroundColor: "#F2F2F7" }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 60 }}>
                <Text style={{ fontSize: 13, color: "#64748b", lineHeight: 20, marginBottom: 20, paddingHorizontal: 4 }}>
                    Escolha quais notificações push você deseja receber no seu dispositivo.
                </Text>

                <View
                    style={{
                        backgroundColor: "#ffffff",
                        borderRadius: 16,
                        overflow: "hidden",
                        borderWidth: 1,
                        borderColor: "rgba(0,0,0,0.04)",
                    }}
                >
                    {PREF_LABELS.map((item, index) => (
                        <React.Fragment key={item.key}>
                            {index > 0 && (
                                <View style={{ height: 1, backgroundColor: "#f1f5f9", marginHorizontal: 20 }} />
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
                                    <Text style={{ fontSize: 14, fontWeight: "500", color: "#0f172a" }}>
                                        {item.label}
                                    </Text>
                                    <Text style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                                        {item.description}
                                    </Text>
                                </View>
                                <Switch
                                    value={preferences[item.key]}
                                    onValueChange={() => togglePreference(item.key)}
                                    trackColor={{ false: "#e2e8f0", true: "#7c3aed" }}
                                    thumbColor="#fff"
                                    disabled={isSaving}
                                />
                            </View>
                        </React.Fragment>
                    ))}
                </View>

                {isSaving && (
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 16, gap: 8 }}>
                        <ActivityIndicator size="small" color="#7c3aed" />
                        <Text style={{ fontSize: 12, color: "#94a3b8" }}>Salvando...</Text>
                    </View>
                )}
            </ScrollView>
        </>
    );
}
