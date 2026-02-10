import { View, Text, TouchableOpacity, Alert, TextInput } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { FileText, Shield, Trash2, ChevronRight, ExternalLink } from "lucide-react-native";
import * as WebBrowser from "expo-web-browser";
import { useStudentProfile } from "../../hooks/useStudentProfile";

// TODO: Substituir pelas URLs reais quando os documentos estiverem prontos
const TERMS_URL = "https://kinevo.app/termos";
const PRIVACY_URL = "https://kinevo.app/privacidade";

export default function PrivacyScreen() {
    const router = useRouter();
    const { deleteAccount } = useStudentProfile();

    const openTerms = () => WebBrowser.openBrowserAsync(TERMS_URL);
    const openPrivacy = () => WebBrowser.openBrowserAsync(PRIVACY_URL);

    const handleDeleteAccount = () => {
        Alert.alert(
            "Excluir Conta",
            "Esta ação é irreversível. Todos os seus dados de treino serão removidos e você perderá o acesso ao app.\n\nDeseja continuar?",
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Sim, excluir",
                    style: "destructive",
                    onPress: () => confirmDelete(),
                },
            ]
        );
    };

    const confirmDelete = () => {
        Alert.prompt(
            "Confirmação Final",
            'Digite "EXCLUIR" para confirmar a exclusão permanente da sua conta.',
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Confirmar",
                    style: "destructive",
                    onPress: async (value) => {
                        if (value?.trim().toUpperCase() !== "EXCLUIR") {
                            Alert.alert("Texto incorreto", 'Você precisa digitar "EXCLUIR" para confirmar.');
                            return;
                        }

                        try {
                            await deleteAccount();
                            router.replace("/login");
                        } catch {
                            Alert.alert("Erro", "Não foi possível excluir a conta. Tente novamente.");
                        }
                    },
                },
            ],
            "plain-text"
        );
    };

    return (
        <>
            <Stack.Screen options={{ title: "Privacidade" }} />
            <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 24 }}>
                {/* Legal Documents */}
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
                    Documentos Legais
                </Text>

                <View
                    style={{
                        backgroundColor: "#1A1A2E",
                        borderRadius: 16,
                        overflow: "hidden",
                        marginBottom: 28,
                    }}
                >
                    <TouchableOpacity
                        onPress={openTerms}
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
                            <FileText size={20} color="#64748b" strokeWidth={1.5} />
                        </View>
                        <Text style={{ fontSize: 14, fontWeight: "500", color: "#cbd5e1", flex: 1 }}>
                            Termos de Uso
                        </Text>
                        <ExternalLink size={16} color="#475569" strokeWidth={1.5} />
                    </TouchableOpacity>

                    <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.04)", marginHorizontal: 20 }} />

                    <TouchableOpacity
                        onPress={openPrivacy}
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
                            <Shield size={20} color="#64748b" strokeWidth={1.5} />
                        </View>
                        <Text style={{ fontSize: 14, fontWeight: "500", color: "#cbd5e1", flex: 1 }}>
                            Política de Privacidade
                        </Text>
                        <ExternalLink size={16} color="#475569" strokeWidth={1.5} />
                    </TouchableOpacity>
                </View>

                {/* Danger Zone */}
                <Text
                    style={{
                        fontSize: 11,
                        fontWeight: "700",
                        color: "rgba(239,68,68,0.6)",
                        textTransform: "uppercase",
                        letterSpacing: 2,
                        marginBottom: 12,
                        paddingLeft: 4,
                    }}
                >
                    Zona de Perigo
                </Text>

                <TouchableOpacity
                    onPress={handleDeleteAccount}
                    activeOpacity={0.7}
                    style={{
                        backgroundColor: "rgba(239,68,68,0.08)",
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
                            backgroundColor: "rgba(239,68,68,0.1)",
                            alignItems: "center",
                            justifyContent: "center",
                            marginRight: 14,
                        }}
                    >
                        <Trash2 size={18} color="#f87171" strokeWidth={1.5} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: "600", color: "#f87171" }}>
                            Excluir Minha Conta
                        </Text>
                        <Text style={{ fontSize: 11, color: "rgba(248,113,113,0.5)", marginTop: 2 }}>
                            Ação permanente e irreversível
                        </Text>
                    </View>
                    <ChevronRight size={16} color="rgba(248,113,113,0.5)" strokeWidth={1.5} />
                </TouchableOpacity>
            </View>
        </>
    );
}
