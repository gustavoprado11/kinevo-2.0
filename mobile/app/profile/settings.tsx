import { View, Text, Alert, Switch } from "react-native";
import { Stack } from "expo-router";
import { useState } from "react";
import { Bell, KeyRound, Info } from "lucide-react-native";
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

    return (
        <>
            <Stack.Screen options={{ title: "Configurações" }} />
            <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 24 }}>
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

                {/* App Version */}
                <View
                    style={{
                        backgroundColor: "#1A1A2E",
                        borderRadius: 16,
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
                        <Info size={20} color="#64748b" strokeWidth={1.5} />
                    </View>
                    <Text style={{ fontSize: 14, fontWeight: "500", color: "#cbd5e1", flex: 1 }}>
                        Versão do App
                    </Text>
                    <Text style={{ fontSize: 13, color: "#64748b" }}>
                        v{appVersion}
                    </Text>
                </View>
            </View>
        </>
    );
}
