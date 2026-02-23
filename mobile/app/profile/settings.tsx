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
            <Stack.Screen options={{ title: "Configurações", headerStyle: { backgroundColor: '#f8fafc' }, headerTintColor: '#0f172a' }} />
            <ScrollView style={{ flex: 1, backgroundColor: "#f8fafc", paddingHorizontal: 20, paddingTop: 24 }}>
                {/* Settings Card */}
                <View
                    style={{
                        backgroundColor: "#fff",
                        borderRadius: 16,
                        overflow: "hidden",
                        marginBottom: 28,
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.05,
                        shadowRadius: 2,
                        elevation: 2,
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
                                backgroundColor: "#f1f5f9",
                                alignItems: "center",
                                justifyContent: "center",
                                marginRight: 14,
                            }}
                        >
                            <Bell size={20} color="#64748b" strokeWidth={1.5} />
                        </View>
                        <Text style={{ fontSize: 14, fontWeight: "500", color: "#0f172a", flex: 1 }}>
                            Notificações
                        </Text>
                        <Switch
                            value={notificationsEnabled}
                            onValueChange={setNotificationsEnabled}
                            trackColor={{ false: "#e2e8f0", true: "#7c3aed" }}
                            thumbColor="#fff"
                        />
                    </View>

                    <View style={{ height: 1, backgroundColor: "#f1f5f9", marginHorizontal: 20 }} />

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
                                backgroundColor: "#f1f5f9",
                                alignItems: "center",
                                justifyContent: "center",
                                marginRight: 14,
                            }}
                        >
                            <KeyRound size={20} color="#64748b" strokeWidth={1.5} />
                        </View>
                        <Text style={{ fontSize: 14, fontWeight: "500", color: "#0f172a", flex: 1 }}>
                            Alterar Senha
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Apple Health Integration */}
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
                    Integrações
                </Text>

                <View
                    style={{
                        backgroundColor: "#fff",
                        borderRadius: 16,
                        overflow: "hidden",
                        marginBottom: 28,
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.05,
                        shadowRadius: 2,
                        elevation: 2,
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
                                backgroundColor: "#fef2f2",
                                alignItems: "center",
                                justifyContent: "center",
                                marginRight: 14,
                            }}
                        >
                            <Heart size={20} color="#ef4444" strokeWidth={1.5} />
                        </View>
                        <Text style={{ fontSize: 14, fontWeight: "500", color: "#0f172a", flex: 1 }}>
                            Apple Saúde
                        </Text>
                        <View
                            style={{
                                backgroundColor: "#f0fdf4",
                                paddingHorizontal: 10,
                                paddingVertical: 4,
                                borderRadius: 100,
                            }}
                        >
                            <Text style={{ fontSize: 11, fontWeight: "600", color: "#15803d" }}>
                                Conectado
                            </Text>
                        </View>
                    </View>

                    <View style={{ height: 1, backgroundColor: "#f1f5f9", marginHorizontal: 20 }} />

                    {/* Description */}
                    <View style={{ paddingHorizontal: 20, paddingVertical: 16 }}>
                        <Text style={{ fontSize: 13, color: "#475569", lineHeight: 20, marginBottom: 12 }}>
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

                    <View style={{ height: 1, backgroundColor: "#f1f5f9", marginHorizontal: 20 }} />

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
                        backgroundColor: "#fff",
                        borderRadius: 16,
                        flexDirection: "row",
                        alignItems: "center",
                        paddingVertical: 16,
                        paddingHorizontal: 20,
                        marginBottom: 40,
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.05,
                        shadowRadius: 2,
                        elevation: 2,
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
                    <Text style={{ fontSize: 14, fontWeight: "500", color: "#0f172a", flex: 1 }}>
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
