import React, { useCallback } from "react";
import { View, Text, ScrollView, Image, Linking, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
    ArrowLeftRight,
    ChevronRight,
    Crown,
    DollarSign,
    ExternalLink,
    LogOut,
    MessageCircle,
} from "lucide-react-native";
import Animated, { FadeIn, FadeInUp, Easing } from "react-native-reanimated";
import Constants from "expo-constants";
import { useRoleMode } from "../../contexts/RoleModeContext";
import { useAuth } from "../../contexts/AuthContext";
import { PressableScale } from "../../components/shared/PressableScale";

const MANAGE_SUBSCRIPTION_URL = "https://app.kinevo.com.br/subscription";
const SUPPORT_WHATSAPP_URL = "https://wa.me/5511999999999";

function subscriptionLabel(status: string | null): { text: string; color: string; bg: string } {
    switch (status) {
        case "active":
            return { text: "Ativa", color: "#16a34a", bg: "#f0fdf4" };
        case "trialing":
            return { text: "Teste gratuito", color: "#0ea5e9", bg: "#f0f9ff" };
        case "past_due":
            return { text: "Pagamento pendente", color: "#f59e0b", bg: "#fffbeb" };
        case "canceled":
            return { text: "Cancelada", color: "#ef4444", bg: "#fef2f2" };
        default:
            return { text: "Sem assinatura", color: "#64748b", bg: "#f1f5f9" };
    }
}

export default function MoreScreen() {
    const { trainerProfile, subscriptionStatus, switchToStudent } = useRoleMode();
    const { signOut } = useAuth();
    const router = useRouter();
    const appVersion = Constants.expoConfig?.version ?? "1.0.0";
    const subBadge = subscriptionLabel(subscriptionStatus);

    const initials = trainerProfile?.name
        ?.split(" ")
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase() || "?";

    const handleSwitchToStudent = useCallback(() => {
        switchToStudent();
        router.replace("/(tabs)/home");
    }, [switchToStudent, router]);

    const handleSignOut = () => {
        Alert.alert("Sair", "Deseja sair da sua conta?", [
            { text: "Cancelar", style: "cancel" },
            { text: "Sair", style: "destructive", onPress: signOut },
        ]);
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: "#F2F2F7" }} edges={["top"]}>
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 120 }}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <Animated.View entering={FadeIn.duration(400)}>
                    <Text style={{ fontSize: 28, fontWeight: "800", color: "#0f172a" }}>
                        Mais
                    </Text>
                </Animated.View>

                {/* Trainer Profile Card */}
                <Animated.View
                    entering={FadeInUp.delay(60).duration(300).easing(Easing.out(Easing.cubic))}
                    style={{
                        backgroundColor: "#ffffff",
                        borderRadius: 20,
                        padding: 20,
                        marginTop: 20,
                        borderWidth: 1,
                        borderColor: "rgba(0,0,0,0.04)",
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.04,
                        shadowRadius: 8,
                        elevation: 2,
                    }}
                >
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                        {trainerProfile?.avatar_url ? (
                            <Image
                                source={{ uri: trainerProfile.avatar_url }}
                                style={{ width: 52, height: 52, borderRadius: 16, marginRight: 14, backgroundColor: "#f1f5f9" }}
                            />
                        ) : (
                            <View
                                style={{
                                    width: 52,
                                    height: 52,
                                    borderRadius: 16,
                                    backgroundColor: "#f5f3ff",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    marginRight: 14,
                                }}
                            >
                                <Text style={{ fontSize: 18, fontWeight: "700", color: "#7c3aed" }}>{initials}</Text>
                            </View>
                        )}
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 16, fontWeight: "700", color: "#0f172a" }}>
                                {trainerProfile?.name || "Treinador"}
                            </Text>
                            <Text style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>
                                {trainerProfile?.email || ""}
                            </Text>
                        </View>
                    </View>
                </Animated.View>

                {/* Actions */}
                <Animated.View
                    entering={FadeInUp.delay(120).duration(300).easing(Easing.out(Easing.cubic))}
                    style={{
                        backgroundColor: "#ffffff",
                        borderRadius: 20,
                        overflow: "hidden",
                        marginTop: 20,
                        borderWidth: 1,
                        borderColor: "rgba(0,0,0,0.04)",
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.04,
                        shadowRadius: 8,
                        elevation: 2,
                    }}
                >
                    {/* Switch to Student Mode */}
                    <PressableScale
                        onPress={handleSwitchToStudent}
                        pressScale={0.98}
                        style={{ flexDirection: "row", alignItems: "center", paddingVertical: 16, paddingHorizontal: 20 }}
                    >
                        <View
                            style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "#f0fdf4", alignItems: "center", justifyContent: "center", marginRight: 14 }}
                        >
                            <ArrowLeftRight size={18} color="#16a34a" />
                        </View>
                        <Text style={{ fontSize: 14, fontWeight: "500", color: "#0f172a", flex: 1 }}>
                            Alternar para modo aluno
                        </Text>
                    </PressableScale>

                    <View style={{ height: 1, backgroundColor: "#f1f5f9", marginHorizontal: 20 }} />

                    {/* Financeiro */}
                    <PressableScale
                        onPress={() => router.push("/financial" as any)}
                        pressScale={0.98}
                        style={{ flexDirection: "row", alignItems: "center", paddingVertical: 16, paddingHorizontal: 20 }}
                    >
                        <View
                            style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "#f5f3ff", alignItems: "center", justifyContent: "center", marginRight: 14 }}
                        >
                            <DollarSign size={18} color="#7c3aed" />
                        </View>
                        <Text style={{ fontSize: 14, fontWeight: "500", color: "#0f172a", flex: 1 }}>
                            Financeiro
                        </Text>
                        <ChevronRight size={16} color="#94a3b8" />
                    </PressableScale>

                    <View style={{ height: 1, backgroundColor: "#f1f5f9", marginHorizontal: 20 }} />

                    {/* Subscription */}
                    <PressableScale
                        onPress={() => Linking.openURL(MANAGE_SUBSCRIPTION_URL)}
                        pressScale={0.98}
                        style={{ flexDirection: "row", alignItems: "center", paddingVertical: 16, paddingHorizontal: 20 }}
                    >
                        <View
                            style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "#fffbeb", alignItems: "center", justifyContent: "center", marginRight: 14 }}
                        >
                            <Crown size={18} color="#f59e0b" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 14, fontWeight: "500", color: "#0f172a" }}>
                                Assinatura Kinevo
                            </Text>
                            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4, gap: 6 }}>
                                <View style={{ backgroundColor: subBadge.bg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 100 }}>
                                    <Text style={{ fontSize: 10, fontWeight: "700", color: subBadge.color }}>{subBadge.text}</Text>
                                </View>
                            </View>
                        </View>
                        <ExternalLink size={16} color="#94a3b8" />
                    </PressableScale>

                    <View style={{ height: 1, backgroundColor: "#f1f5f9", marginHorizontal: 20 }} />

                    {/* Support */}
                    <PressableScale
                        onPress={() => Linking.openURL(SUPPORT_WHATSAPP_URL)}
                        pressScale={0.98}
                        style={{ flexDirection: "row", alignItems: "center", paddingVertical: 16, paddingHorizontal: 20 }}
                    >
                        <View
                            style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "#f0fdf4", alignItems: "center", justifyContent: "center", marginRight: 14 }}
                        >
                            <MessageCircle size={18} color="#16a34a" />
                        </View>
                        <Text style={{ fontSize: 14, fontWeight: "500", color: "#0f172a", flex: 1 }}>
                            Suporte via WhatsApp
                        </Text>
                        <ExternalLink size={16} color="#94a3b8" />
                    </PressableScale>
                </Animated.View>

                {/* Sign Out */}
                <Animated.View
                    entering={FadeInUp.delay(180).duration(300).easing(Easing.out(Easing.cubic))}
                    style={{ marginTop: 20 }}
                >
                    <PressableScale
                        onPress={handleSignOut}
                        pressScale={0.98}
                        style={{
                            backgroundColor: "#ffffff",
                            borderRadius: 20,
                            paddingVertical: 16,
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 8,
                            borderWidth: 1,
                            borderColor: "rgba(0,0,0,0.04)",
                        }}
                    >
                        <LogOut size={18} color="#ef4444" />
                        <Text style={{ fontSize: 14, fontWeight: "600", color: "#ef4444" }}>
                            Sair da conta
                        </Text>
                    </PressableScale>
                </Animated.View>

                {/* Version */}
                <Text style={{ textAlign: "center", fontSize: 11, color: "#cbd5e1", marginTop: 24 }}>
                    Kinevo v{appVersion} — Modo Treinador
                </Text>
            </ScrollView>
        </SafeAreaView>
    );
}
