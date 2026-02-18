import { View, Text, Alert, Switch, Linking, ScrollView } from "react-native";
import { Stack } from "expo-router";
import { useState } from "react";
import { Bell, KeyRound, Info, Heart, ExternalLink } from "lucide-react-native";
import Constants from "expo-constants";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { TouchableOpacity } from "react-native";

export default function SettingsScreen() {
    const { user } = useAuth();
    const [notificationsEnabled, setNotificationsEnabled] = useState(false);
    const appVersion = Constants.expoConfig?.version ?? "1.0.0";

    const handleResetPassword = () => {
        if (!user?.email) return;

        Alert.alert(
            "Alterar Senha",
            `Enviaremos um link de redefinição para ${user.email}. Deseja continuar?`,
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Enviar",
                    onPress: async () => {
                        try {
                            const { error } = await supabase.auth.resetPasswordForEmail(user.email!);
                            if (error) throw error;
                            Alert.alert("Enviado!", "Verifique sua caixa de entrada.");
                        } catch {
                            Alert.alert("Erro", "Não foi possível enviar o email. Tente novamente.");
                        }
                    },
                },
            ]
        );
    };

    const handleOpenHealth = () => {
        Linking.openURL("x-apple-health://");
    };

    return (
        <>
            <Stack.Screen options={{ title: "Configurações" }} />
            <ScrollView style={{ flex: 1, paddingHorizontal: 20, paddingTop: 24 }}>
                {/* Settings Card */}
                <View
                    style={{
                        backgroundColor: "#1A1A2E",
                        borderRadius: 16,
                        overflow: "hidden",
                        marginBottom: 28,
                    }}
                >
                    {/* Notifications */}
                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            paddingVertical: 16,
                            paddingHorizontal: 20,
                        }}
                    >
                        <View
                            style={{
                                height: 40,
                                width: 40,
                                borderRadius: 12,
                                backgroundColor: "rgba(255,255,255,0.04)",
                                alignItems: "center",
                                justifyContent: "center",
                                marginRight: 14,
                            }}
                        >
                            <Bell size={20} color="#64748b" strokeWidth={1.5} />
                        </View>
                        <Text style={{ fontSize: 14, fontWeight: "500", color: "#cbd5e1", flex: 1 }}>
                            Notificações
                        </Text>
                        <Switch
                            value={notificationsEnabled}
                            onValueChange={setNotificationsEnabled}
                            trackColor={{ false: "#334155", true: "#7c3aed" }}
                            thumbColor="#fff"
                        />
                    </View>

                    <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.04)", marginHorizontal: 20 }} />

                    {/* Reset Password */}
                    <TouchableOpacity
                        onPress={handleResetPassword}
                        activeOpacity={0.6}
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            paddingVertical: 16,
                            paddingHorizontal: 20,
                        }}
                    >
                        <View
                            style={{
                                height: 40,
                                width: 40,
                                borderRadius: 12,
                                backgroundColor: "rgba(255,255,255,0.04)",
                                alignItems: "center",
                                justifyContent: "center",
                                marginRight: 14,
                            }}
                        >
                            <KeyRound size={20} color="#64748b" strokeWidth={1.5} />
                        </View>
                        <Text style={{ fontSize: 14, fontWeight: "500", color: "#cbd5e1", flex: 1 }}>
                            Alterar Senha
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Apple Health Integration */}
                <Text
                    style={{
                        fontSize: 11,
                        fontWeight: "700",
                        color: "rgba(255,255,255,0.35)",
                        textTransform: "uppercase",
                        letterSpacing: 2,
                        marginBottom: 12,
                        paddingLeft: 4,
                    }}
                >
                    Integrações
                </Text>

                <View
                    style={{
                        backgroundColor: "#1A1A2E",
                        borderRadius: 16,
                        overflow: "hidden",
                        marginBottom: 28,
                    }}
                >
                    {/* Header row */}
                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            paddingVertical: 16,
                            paddingHorizontal: 20,
                        }}
                    >
                        <View
                            style={{
                                height: 40,
                                width: 40,
                                borderRadius: 12,
                                backgroundColor: "rgba(239,68,68,0.08)",
                                alignItems: "center",
                                justifyContent: "center",
                                marginRight: 14,
                            }}
                        >
                            <Heart size={20} color="#ef4444" strokeWidth={1.5} />
                        </View>
                        <Text style={{ fontSize: 14, fontWeight: "500", color: "#cbd5e1", flex: 1 }}>
                            Apple Saúde
                        </Text>
                        <View
                            style={{
                                backgroundColor: "rgba(74,222,128,0.1)",
                                paddingHorizontal: 10,
                                paddingVertical: 4,
                                borderRadius: 100,
                            }}
                        >
                            <Text style={{ fontSize: 11, fontWeight: "600", color: "#4ADE80" }}>
                                Conectado
                            </Text>
                        </View>
                    </View>

                    <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.04)", marginHorizontal: 20 }} />

                    {/* Description */}
                    <View style={{ paddingHorizontal: 20, paddingVertical: 16 }}>
                        <Text style={{ fontSize: 13, color: "#94a3b8", lineHeight: 20, marginBottom: 12 }}>
                            O Kinevo sincroniza seus treinos com o Apple Saúde:
                        </Text>
                        <View style={{ gap: 6 }}>
                            <Text style={{ fontSize: 13, color: "#64748b", lineHeight: 18 }}>
                                •  Frequência cardíaca — leitura durante treinos via Apple Watch
                            </Text>
                            <Text style={{ fontSize: 13, color: "#64748b", lineHeight: 18 }}>
                                •  Treinos — tipo de exercício e duração salvos automaticamente
                            </Text>
                        </View>
                    </View>

                    <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.04)", marginHorizontal: 20 }} />

                    {/* Manage button */}
                    <TouchableOpacity
                        onPress={handleOpenHealth}
                        activeOpacity={0.6}
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            paddingVertical: 14,
                            paddingHorizontal: 20,
                            gap: 8,
                        }}
                    >
                        <ExternalLink size={16} color="#7c3aed" strokeWidth={1.5} />
                        <Text style={{ fontSize: 13, fontWeight: "600", color: "#7c3aed" }}>
                            Gerenciar no Saúde
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* App Version */}
                <View
                    style={{
                        backgroundColor: "#1A1A2E",
                        borderRadius: 16,
                        flexDirection: "row",
                        alignItems: "center",
                        paddingVertical: 16,
                        paddingHorizontal: 20,
                        marginBottom: 40,
                    }}
                >
                    <View
                        style={{
                            height: 40,
                            width: 40,
                            borderRadius: 12,
                            backgroundColor: "rgba(255,255,255,0.04)",
                            alignItems: "center",
                            justifyContent: "center",
                            marginRight: 14,
                        }}
                    >
                        <Info size={20} color="#64748b" strokeWidth={1.5} />
                    </View>
                    <Text style={{ fontSize: 14, fontWeight: "500", color: "#cbd5e1", flex: 1 }}>
                        Versão do App
                    </Text>
                    <Text style={{ fontSize: 13, color: "#64748b" }}>
                        v{appVersion}
                    </Text>
                </View>
            </ScrollView>
        </>
    );
}
