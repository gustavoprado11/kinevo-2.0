import React from "react";
import { View, Text, Linking, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Lock, ExternalLink, ArrowLeft } from "lucide-react-native";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import { useRoleMode } from "../contexts/RoleModeContext";
import { PressableScale } from "../components/shared/PressableScale";

const SUBSCRIBE_URL = "https://app.kinevo.com.br/subscription";

export default function TrainerSubscriptionBlockedScreen() {
    const { switchToStudent } = useRoleMode();

    const handleSubscribe = () => {
        Linking.openURL(SUBSCRIBE_URL);
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: "#F2F2F7" }}>
            <StatusBar barStyle="dark-content" />
            <View style={{ flex: 1, paddingHorizontal: 24, justifyContent: "center", alignItems: "center" }}>
                {/* Lock Icon */}
                <Animated.View
                    entering={FadeIn.duration(500)}
                    style={{
                        width: 80,
                        height: 80,
                        borderRadius: 24,
                        backgroundColor: "#fef2f2",
                        alignItems: "center",
                        justifyContent: "center",
                        marginBottom: 24,
                    }}
                >
                    <Lock size={36} color="#ef4444" />
                </Animated.View>

                {/* Message */}
                <Animated.View entering={FadeInUp.delay(100).duration(400)} style={{ alignItems: "center" }}>
                    <Text style={{ fontSize: 22, fontWeight: "800", color: "#0f172a", textAlign: "center" }}>
                        Assinatura necessária
                    </Text>
                    <Text
                        style={{
                            fontSize: 14,
                            color: "#64748b",
                            marginTop: 12,
                            textAlign: "center",
                            lineHeight: 22,
                            maxWidth: 300,
                        }}
                    >
                        O modo treinador requer uma assinatura ativa do Kinevo.
                        Acesse o site para assinar ou renovar seu plano.
                    </Text>
                </Animated.View>

                {/* Subscribe Button */}
                <Animated.View entering={FadeInUp.delay(200).duration(400)} style={{ width: "100%", marginTop: 32 }}>
                    <PressableScale
                        onPress={handleSubscribe}
                        pressScale={0.97}
                        style={{
                            backgroundColor: "#7c3aed",
                            borderRadius: 16,
                            paddingVertical: 16,
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 8,
                        }}
                    >
                        <ExternalLink size={18} color="#ffffff" />
                        <Text style={{ fontSize: 15, fontWeight: "700", color: "#ffffff" }}>
                            Assinar pelo site
                        </Text>
                    </PressableScale>
                </Animated.View>

                {/* Back to Student */}
                <Animated.View entering={FadeInUp.delay(300).duration(400)} style={{ width: "100%", marginTop: 12 }}>
                    <PressableScale
                        onPress={switchToStudent}
                        pressScale={0.97}
                        style={{
                            backgroundColor: "#ffffff",
                            borderRadius: 16,
                            paddingVertical: 16,
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 8,
                            borderWidth: 1,
                            borderColor: "rgba(0,0,0,0.06)",
                        }}
                    >
                        <ArrowLeft size={18} color="#64748b" />
                        <Text style={{ fontSize: 15, fontWeight: "600", color: "#64748b" }}>
                            Voltar ao modo aluno
                        </Text>
                    </PressableScale>
                </Animated.View>
            </View>
        </SafeAreaView>
    );
}
