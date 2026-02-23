import { View, Text, TouchableOpacity, Alert } from "react-native";
import { Stack, useRouter } from "expo-router";
import { FileText, Shield, Trash2, ChevronRight } from "lucide-react-native";
import { useStudentProfile } from "../../hooks/useStudentProfile";

export default function PrivacyScreen() {
    const router = useRouter();
    const { deleteAccount } = useStudentProfile();

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
                    onPress: async (value?: string) => {
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
            <Stack.Screen options={{ title: "Legal", headerStyle: { backgroundColor: '#f8fafc' }, headerTintColor: '#0f172a' }} />
            <View style={{ flex: 1, backgroundColor: "#f8fafc", paddingHorizontal: 20, paddingTop: 24 }}>
                {/* Legal Documents */}
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
                    Documentos Legais
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
                    <TouchableOpacity
                        onPress={() => router.push("/profile/terms")}
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
                            <FileText size={20} color="#64748b" strokeWidth={1.5} />
                        </View>
                        <Text style={{ fontSize: 14, fontWeight: "500", color: "#0f172a", flex: 1 }}>
                            Termos de Uso
                        </Text>
                        <ChevronRight size={16} color="#475569" strokeWidth={1.5} />
                    </TouchableOpacity>

                    <View style={{ height: 1, backgroundColor: "#f1f5f9", marginHorizontal: 20 }} />

                    <TouchableOpacity
                        onPress={() => router.push("/profile/privacy-policy")}
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
                            <Shield size={20} color="#64748b" strokeWidth={1.5} />
                        </View>
                        <Text style={{ fontSize: 14, fontWeight: "500", color: "#0f172a", flex: 1 }}>
                            Política de Privacidade
                        </Text>
                        <ChevronRight size={16} color="#475569" strokeWidth={1.5} />
                    </TouchableOpacity>
                </View>

                {/* Danger Zone */}
                <Text
                    style={{
                        fontSize: 11,
                        fontWeight: "700",
                        color: "#ef4444",
                        textTransform: "uppercase",
                        letterSpacing: 1.5,
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
                        backgroundColor: "#fff",
                        borderRadius: 16,
                        flexDirection: "row",
                        alignItems: "center",
                        paddingVertical: 16,
                        paddingHorizontal: 20,
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
                            backgroundColor: "#fef2f2",
                            alignItems: "center",
                            justifyContent: "center",
                            marginRight: 14,
                        }}
                    >
                        <Trash2 size={18} color="#ef4444" strokeWidth={1.5} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: "600", color: "#ef4444" }}>
                            Excluir Minha Conta
                        </Text>
                        <Text style={{ fontSize: 11, color: "#f87171", marginTop: 2 }}>
                            Ação permanente e irreversível
                        </Text>
                    </View>
                    <ChevronRight size={16} color="rgba(248,113,113,0.5)" strokeWidth={1.5} />
                </TouchableOpacity>
            </View>
        </>
    );
}
