import React, { useCallback } from "react";
import { View, Text, Linking, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Lock, ExternalLink, ArrowLeft } from "lucide-react-native";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import { useRoleMode } from "../contexts/RoleModeContext";
import { PressableScale } from "../components/shared/PressableScale";
import { WEB_URL } from "../lib/config";
import { useV2Colors, useIsDark } from "../hooks/useV2Colors";

const SUBSCRIBE_URL = `${WEB_URL}/subscription`;

export default function TrainerSubscriptionBlockedScreen() {
    const { switchToStudent } = useRoleMode();
    const router = useRouter();
    const colors = useV2Colors();
    // M4: esta tela hardcodava cores claras (#F2F2F7/#fff/#0f172a), então
    // renderizava light dentro de um app escuro. Agora segue o tema (useV2Colors).
    const isDark = useIsDark();

    const handleSubscribe = () => {
        Linking.openURL(SUBSCRIBE_URL);
    };

    const handleBackToStudent = useCallback(() => {
        switchToStudent();
        router.replace("/(tabs)/home");
    }, [switchToStudent, router]);

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.canvas }}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
            <View style={{ flex: 1, paddingHorizontal: 24, justifyContent: "center", alignItems: "center" }}>
                {/* Lock Icon */}
                <Animated.View
                    entering={FadeIn.duration(500)}
                    style={{
                        width: 80,
                        height: 80,
                        borderRadius: 24,
                        backgroundColor: colors.semantic.danger.bg,
                        alignItems: "center",
                        justifyContent: "center",
                        marginBottom: 24,
                    }}
                >
                    <Lock size={36} color={colors.semantic.danger.default} />
                </Animated.View>

                {/* Message */}
                <Animated.View entering={FadeInUp.delay(100).duration(400)} style={{ alignItems: "center" }}>
                    <Text style={{ fontSize: 22, fontWeight: "800", color: colors.text.primary, textAlign: "center" }}>
                        Assinatura necessária
                    </Text>
                    <Text
                        style={{
                            fontSize: 14,
                            color: colors.text.secondary,
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
                            backgroundColor: colors.purple[600],
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
                        onPress={handleBackToStudent}
                        pressScale={0.97}
                        style={{
                            backgroundColor: colors.surface.card,
                            borderRadius: 16,
                            paddingVertical: 16,
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 8,
                            borderWidth: 1,
                            borderColor: colors.border.default,
                        }}
                    >
                        <ArrowLeft size={18} color={colors.text.secondary} />
                        <Text style={{ fontSize: 15, fontWeight: "600", color: colors.text.secondary }}>
                            Voltar ao modo aluno
                        </Text>
                    </PressableScale>
                </Animated.View>
            </View>
        </SafeAreaView>
    );
}
