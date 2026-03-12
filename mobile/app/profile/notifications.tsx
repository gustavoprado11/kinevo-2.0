import { useState, useEffect, useCallback } from "react";
import { View, Text, Switch, ScrollView, ActivityIndicator, Alert } from "react-native";
import { Stack } from "expo-router";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";

interface NotificationPreferences {
    push_enabled: boolean;
    categories: {
        program_assigned: boolean;
        form_request: boolean;
        feedback: boolean;
        reminders: boolean;
    };
}

const DEFAULT_PREFS: NotificationPreferences = {
    push_enabled: true,
    categories: {
        program_assigned: true,
        form_request: true,
        feedback: true,
        reminders: true,
    },
};

const CATEGORY_LABELS: Record<string, string> = {
    program_assigned: "Novo programa de treino",
    form_request: "Avaliações e formulários",
    feedback: "Feedback do treinador",
    reminders: "Lembretes",
};

export default function NotificationSettings() {
    const { user } = useAuth();
    const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_PREFS);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!user) return;
        (async () => {
            const { data } = await supabase
                .from("students" as any)
                .select("notification_preferences")
                .eq("auth_user_id", user.id)
                .single();

            const row = data as any;
            if (row?.notification_preferences) {
                setPrefs({ ...DEFAULT_PREFS, ...row.notification_preferences });
            }
            setLoading(false);
        })();
    }, [user]);

    const save = useCallback(async (updated: NotificationPreferences) => {
        if (!user) return;
        setSaving(true);
        const { error } = await supabase
            .from("students" as any)
            .update({ notification_preferences: updated } as any)
            .eq("auth_user_id", user.id);

        if (error) {
            Alert.alert("Erro", "Não foi possível salvar as preferências.");
        }
        setSaving(false);
    }, [user]);

    const togglePushEnabled = () => {
        const updated = { ...prefs, push_enabled: !prefs.push_enabled };
        setPrefs(updated);
        save(updated);
    };

    const toggleCategory = (key: string) => {
        const updated = {
            ...prefs,
            categories: { ...prefs.categories, [key]: !prefs.categories[key as keyof typeof prefs.categories] },
        };
        setPrefs(updated);
        save(updated);
    };

    if (loading) {
        return (
            <View style={{ flex: 1, backgroundColor: "#F2F2F7", justifyContent: "center", alignItems: "center" }}>
                <Stack.Screen options={{ title: "Notificações" }} />
                <ActivityIndicator color="#7c3aed" />
            </View>
        );
    }

    return (
        <View style={{ flex: 1, backgroundColor: "#F2F2F7" }}>
            <Stack.Screen options={{ title: "Notificações" }} />
            <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 24 }}>
                {/* Master toggle */}
                <View
                    style={{
                        backgroundColor: "#fff",
                        borderRadius: 16,
                        padding: 16,
                        marginBottom: 24,
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.05,
                        shadowRadius: 2,
                        elevation: 2,
                    }}
                >
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <View style={{ flex: 1 }}>
                            <Text style={{ color: "#0f172a", fontSize: 16, fontWeight: "600" }}>Notificações push</Text>
                            <Text style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>Receber notificações no celular</Text>
                        </View>
                        <Switch
                            value={prefs.push_enabled}
                            onValueChange={togglePushEnabled}
                            trackColor={{ false: "#e2e8f0", true: "#7c3aed" }}
                            thumbColor="#fff"
                        />
                    </View>
                </View>

                {/* Categories */}
                {prefs.push_enabled && (
                    <>
                        <Text
                            style={{
                                fontSize: 11,
                                fontWeight: "700",
                                color: "#94a3b8",
                                textTransform: "uppercase",
                                letterSpacing: 1.5,
                                marginBottom: 12,
                                paddingLeft: 4,
                            }}
                        >
                            CATEGORIAS
                        </Text>
                        <View
                            style={{
                                backgroundColor: "#fff",
                                borderRadius: 16,
                                overflow: "hidden",
                                shadowColor: "#000",
                                shadowOffset: { width: 0, height: 1 },
                                shadowOpacity: 0.05,
                                shadowRadius: 2,
                                elevation: 2,
                            }}
                        >
                            {Object.entries(CATEGORY_LABELS).map(([key, label], index) => (
                                <View
                                    key={key}
                                    style={{
                                        flexDirection: "row",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        paddingVertical: 16,
                                        paddingHorizontal: 20,
                                        borderTopWidth: index > 0 ? 1 : 0,
                                        borderTopColor: "#f1f5f9",
                                    }}
                                >
                                    <Text style={{ color: "#0f172a", fontSize: 14, fontWeight: "500" }}>{label}</Text>
                                    <Switch
                                        value={prefs.categories[key as keyof typeof prefs.categories]}
                                        onValueChange={() => toggleCategory(key)}
                                        trackColor={{ false: "#e2e8f0", true: "#7c3aed" }}
                                        thumbColor="#fff"
                                    />
                                </View>
                            ))}
                        </View>
                    </>
                )}

                {saving && (
                    <View style={{ alignItems: "center", marginTop: 16 }}>
                        <ActivityIndicator size="small" color="#7c3aed" />
                    </View>
                )}
            </ScrollView>
        </View>
    );
}
