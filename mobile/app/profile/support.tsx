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
            <Stack.Screen options={{ title: "Suporte" }} />
            <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 24 }}>
                {/* Info Card */}
                <View
                    style={{
                        backgroundColor: "#1A1A2E",
                        borderRadius: 16,
                        padding: 24,
                        alignItems: "center",
                        marginBottom: 24,
                    }}
                >
                    <View
                        style={{
                            width: 56,
                            height: 56,
                            borderRadius: 28,
                            backgroundColor: "rgba(124,58,237,0.1)",
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
                            color: "#e2e8f0",
                            marginBottom: 8,
                            textAlign: "center",
                        }}
                    >
                        Como podemos ajudar?
                    </Text>
                    <Text
                        style={{
                            fontSize: 13,
                            color: "rgba(255,255,255,0.45)",
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
                        backgroundColor: "#25D366",
                        borderRadius: 16,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        paddingVertical: 16,
                        gap: 10,
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
