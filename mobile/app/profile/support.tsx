import { View, Text, TouchableOpacity, Linking, Alert } from "react-native";
import { Stack } from "expo-router";
import { MessageCircle, HelpCircle } from "lucide-react-native";

// TODO: Substituir pelo número real de WhatsApp do suporte
const WHATSAPP_NUMBER = "5531999064997";
const WHATSAPP_MESSAGE = "Olá! Preciso de ajuda com o app Kinevo.";

export default function SupportScreen() {
    const handleWhatsApp = async () => {
        const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;

        try {
            const supported = await Linking.canOpenURL(url);
            if (supported) {
                await Linking.openURL(url);
            } else {
                Alert.alert("Erro", "WhatsApp não está instalado neste dispositivo.");
            }
        } catch {
            Alert.alert("Erro", "Não foi possível abrir o WhatsApp.");
        }
    };

    return (
        <>
            <Stack.Screen options={{ title: "Suporte", headerStyle: { backgroundColor: '#f8fafc' }, headerTintColor: '#0f172a' }} />
            <View style={{ flex: 1, backgroundColor: "#f8fafc", paddingHorizontal: 20, paddingTop: 24 }}>
                {/* Info Card */}
                <View
                    style={{
                        backgroundColor: "#fff",
                        borderRadius: 24,
                        padding: 24,
                        alignItems: "center",
                        marginBottom: 24,
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.05,
                        shadowRadius: 2,
                        elevation: 2,
                    }}
                >
                    <View
                        style={{
                            width: 56,
                            height: 56,
                            borderRadius: 28,
                            backgroundColor: "#f5f3ff",
                            alignItems: "center",
                            justifyContent: "center",
                            marginBottom: 16,
                        }}
                    >
                        <HelpCircle size={28} color="#7c3aed" strokeWidth={1.5} />
                    </View>
                    <Text
                        style={{
                            fontSize: 16,
                            fontWeight: "700",
                            color: "#0f172a",
                            marginBottom: 8,
                            textAlign: "center",
                        }}
                    >
                        Como podemos ajudar?
                    </Text>
                    <Text
                        style={{
                            fontSize: 13,
                            color: "#64748b",
                            textAlign: "center",
                            lineHeight: 20,
                        }}
                    >
                        Fale com nossa equipe pelo WhatsApp. Estamos disponíveis de segunda a sexta, das 9h às 18h.
                    </Text>
                </View>

                {/* WhatsApp Button */}
                <TouchableOpacity
                    onPress={handleWhatsApp}
                    activeOpacity={0.7}
                    style={{
                        backgroundColor: "#10b981",
                        borderRadius: 16,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        paddingVertical: 16,
                        gap: 10,
                        shadowColor: "#10b981",
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.2,
                        shadowRadius: 8,
                        elevation: 4,
                    }}
                >
                    <MessageCircle size={20} color="#fff" strokeWidth={2} />
                    <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}>
                        Falar pelo WhatsApp
                    </Text>
                </TouchableOpacity>
            </View>
        </>
    );
}
