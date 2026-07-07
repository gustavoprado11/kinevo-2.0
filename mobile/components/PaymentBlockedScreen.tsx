import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, Linking, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Lock, AlertCircle, MessageCircle, CreditCard } from "lucide-react-native";
import { useV2Colors } from "@/hooks/useV2Colors";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

// Fallback: suporte Kinevo — usado só quando o treinador não tem telefone.
// O contato primário é o TREINADOR (a cobrança é dele; a própria descrição
// manda "falar com seu treinador" — discar pro suporte contradizia o branding).
const SUPPORT_WHATSAPP = "5531999064997";
const SUPPORT_MESSAGE = "Olá! Preciso de ajuda com minha assinatura no app Kinevo.";
const COACH_MESSAGE = "Olá! Vi no app que meu pagamento está pendente e quero regularizar.";

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
    const colors = useV2Colors();
    const { user } = useAuth();
    const msg = messages[reason] || defaultMessage;
    const Icon = msg.icon;

    // Contato do TREINADOR (nome + telefone) — mesmo join RLS do perfil.
    const [coachPhone, setCoachPhone] = useState<string | null>(null);
    useEffect(() => {
        if (!user) return;
        let mounted = true;
        (async () => {
            const { data }: { data: any } = await supabase
                .from("students" as any)
                .select("trainers:coach_id(phone)")
                .eq("auth_user_id", user.id)
                .maybeSingle();
            const phone: string | null = data?.trainers?.phone ?? null;
            if (mounted) setCoachPhone(phone);
        })();
        return () => {
            mounted = false;
        };
    }, [user]);

    const coachDigits = coachPhone?.replace(/\D/g, "") ?? "";
    const coachWhats = coachDigits.length >= 10
        ? (coachDigits.startsWith("55") ? coachDigits : `55${coachDigits}`)
        : null;

    const handleWhatsApp = async () => {
        const number = coachWhats ?? SUPPORT_WHATSAPP;
        const message = coachWhats ? COACH_MESSAGE : SUPPORT_MESSAGE;
        const url = `https://wa.me/${number}?text=${encodeURIComponent(message)}`;

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
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.canvas }} edges={["top"]}>
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
                        backgroundColor: colors.semantic.danger.bg,
                        alignItems: "center",
                        justifyContent: "center",
                        marginBottom: 24,
                    }}
                >
                    <Icon size={36} color={colors.semantic.danger.fg} strokeWidth={1.5} />
                </View>

                {/* Title */}
                <Text
                    style={{
                        fontSize: 20,
                        fontWeight: "700",
                        color: colors.text.primary,
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
                        color: colors.text.tertiary,
                        textAlign: "center",
                        lineHeight: 22,
                        maxWidth: 280,
                        marginBottom: 32,
                    }}
                >
                    {msg.description}
                </Text>

                {/* Pagar agora — só quando o bloqueio é por pagamento */}
                {reason === "past_due_blocked" && (
                    <TouchableOpacity
                        onPress={() => router.push("/payment")}
                        activeOpacity={0.85}
                        style={{
                            backgroundColor: colors.purple[600],
                            borderRadius: 16,
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            paddingVertical: 16,
                            paddingHorizontal: 32,
                            gap: 10,
                            width: "100%",
                            marginBottom: 12,
                        }}
                    >
                        <CreditCard size={20} color="#fff" strokeWidth={2} />
                        <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}>
                            Pagar agora
                        </Text>
                    </TouchableOpacity>
                )}

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
                        {coachWhats ? "Falar com meu treinador" : "Falar com Suporte"}
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
                    <CreditCard size={14} color={colors.purple[600]} strokeWidth={1.5} />
                    <Text
                        style={{
                            fontSize: 13,
                            fontWeight: "600",
                            color: colors.purple[600],
                        }}
                    >
                        Ver Minha Assinatura
                    </Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}
