import { View, Text, TouchableOpacity, Linking, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Lock, AlertCircle, MessageCircle, CreditCard } from "lucide-react-native";

const WHATSAPP_NUMBER = "5531999064997";
const WHATSAPP_MESSAGE = "Olá! Preciso de ajuda com minha assinatura no app Kinevo.";

interface PaymentBlockedScreenProps {
    reason: string;
}

const messages: Record<string, { title: string; description: string; icon: typeof Lock }> = {
    past_due_blocked: {
        title: "Pagamento Pendente",
        description:
            "Seu pagamento está pendente. Entre em contato com seu treinador para regularizar sua situação.",
        icon: AlertCircle,
    },
    student_inactive: {
        title: "Conta Inativa",
        description:
            "Sua conta foi desativada pelo seu treinador. Entre em contato para mais informações.",
        icon: Lock,
    },
};

const defaultMessage = {
    title: "Acesso Restrito",
    description:
        "Seu acesso ao app está restrito no momento. Entre em contato com seu treinador.",
    icon: Lock,
};

export function PaymentBlockedScreen({ reason }: PaymentBlockedScreenProps) {
    const router = useRouter();
    const msg = messages[reason] || defaultMessage;
    const Icon = msg.icon;

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
        <SafeAreaView style={{ flex: 1, backgroundColor: "#0D0D17" }} edges={["top"]}>
            <View
                style={{
                    flex: 1,
                    alignItems: "center",
                    justifyContent: "center",
                    paddingHorizontal: 32,
                }}
            >
                {/* Icon */}
                <View
                    style={{
                        width: 80,
                        height: 80,
                        borderRadius: 40,
                        backgroundColor: "rgba(239,68,68,0.1)",
                        alignItems: "center",
                        justifyContent: "center",
                        marginBottom: 24,
                    }}
                >
                    <Icon size={36} color="#f87171" strokeWidth={1.5} />
                </View>

                {/* Title */}
                <Text
                    style={{
                        fontSize: 20,
                        fontWeight: "700",
                        color: "#f1f5f9",
                        marginBottom: 10,
                        textAlign: "center",
                    }}
                >
                    {msg.title}
                </Text>

                {/* Description */}
                <Text
                    style={{
                        fontSize: 14,
                        color: "#64748b",
                        textAlign: "center",
                        lineHeight: 22,
                        maxWidth: 280,
                        marginBottom: 32,
                    }}
                >
                    {msg.description}
                </Text>

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
                        paddingHorizontal: 32,
                        gap: 10,
                        width: "100%",
                    }}
                >
                    <MessageCircle size={20} color="#fff" strokeWidth={2} />
                    <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}>
                        Falar com Suporte
                    </Text>
                </TouchableOpacity>

                {/* Subscription Link */}
                <TouchableOpacity
                    onPress={() => router.push("/profile/subscription")}
                    activeOpacity={0.6}
                    style={{
                        marginTop: 20,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                    }}
                >
                    <CreditCard size={14} color="#7c3aed" strokeWidth={1.5} />
                    <Text
                        style={{
                            fontSize: 13,
                            fontWeight: "600",
                            color: "#7c3aed",
                        }}
                    >
                        Ver Minha Assinatura
                    </Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}
