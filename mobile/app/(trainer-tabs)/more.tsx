import React, { useCallback, useState } from "react";
import { View, Text, ScrollView, Image, Linking, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
    ArrowLeftRight,
    Bell,
    ChevronRight,
    Crown,
    ExternalLink,
    LogOut,
    MessageCircle,
} from "lucide-react-native";
import Animated, { FadeIn, FadeInUp, Easing } from "react-native-reanimated";
import Constants from "expo-constants";
import { useRoleMode } from "../../contexts/RoleModeContext";
import { useAuth } from "../../contexts/AuthContext";
import { PressableScale } from "../../components/shared/PressableScale";
import { supabase } from "../../lib/supabase";

const WEB_BASE_URL = "https://app.kinevo.com.br";
const SUPPORT_WHATSAPP_URL = "https://wa.me/5531999064997?text=Ol%C3%A1!%20Preciso%20de%20ajuda%20com%20o%20app%20Kinevo.";

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

/** Section header — iOS Settings style */
function SectionHeader({ title, delay }: { title: string; delay: number }) {
    return (
        <Animated.Text
            entering={FadeInUp.delay(delay).duration(300).easing(Easing.out(Easing.cubic))}
            style={{
                fontSize: 11,
                fontWeight: "700",
                color: "#94a3b8",
                textTransform: "uppercase",
                letterSpacing: 1.5,
                marginBottom: 8,
                marginTop: 24,
                paddingLeft: 4,
            }}
        >
            {title}
        </Animated.Text>
    );
}

/** Reusable row inside a section card */
function MenuRow({
    icon,
    label,
    onPress,
    trailing,
}: {
    icon: React.ReactNode;
    label: string;
    onPress: () => void;
    trailing?: React.ReactNode | null;
}) {
    return (
        <PressableScale
            onPress={onPress}
            pressScale={0.98}
            style={{ flexDirection: "row", alignItems: "center", paddingVertical: 16, paddingHorizontal: 20 }}
        >
            {icon}
            <Text style={{ fontSize: 14, fontWeight: "500", color: "#0f172a", flex: 1 }}>
                {label}
            </Text>
            {trailing !== null && (trailing ?? <ChevronRight size={16} color="#94a3b8" />)}
        </PressableScale>
    );
}

function Divider() {
    return <View style={{ height: 1, backgroundColor: "#f1f5f9", marginHorizontal: 20 }} />;
}

function IconBox({ bg, children }: { bg: string; children: React.ReactNode }) {
    return (
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: bg, alignItems: "center", justifyContent: "center", marginRight: 14 }}>
            {children}
        </View>
    );
}

const CARD_STYLE = {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    overflow: "hidden" as const,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.04)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
};

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

    const [loadingPortal, setLoadingPortal] = useState(false);

    const handleManageSubscription = useCallback(async () => {
        setLoadingPortal(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
                Alert.alert("Erro", "Sessão expirada. Faça login novamente.");
                return;
            }
            const res = await fetch(`${WEB_BASE_URL}/api/stripe/portal`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                    "Content-Type": "application/json",
                },
            });
            const json = await res.json();
            if (json.url) {
                await Linking.openURL(json.url);
            } else {
                Alert.alert("Erro", json.error || "Não foi possível abrir o portal de assinatura.");
            }
        } catch (error) {
            if (__DEV__) console.error("[more] Portal error:", error);
            Alert.alert("Erro", "Não foi possível abrir o portal de assinatura.");
        } finally {
            setLoadingPortal(false);
        }
    }, []);

    const handleSwitchToStudent = useCallback(() => {
        switchToStudent();
        router.replace("/(tabs)/home");
    }, [switchToStudent, router]);

    const handleSignOut = () => {
        Alert.alert("Sair", "Deseja sair da sua conta?", [
            { text: "Cancelar", style: "cancel" },
            {
                text: "Sair",
                style: "destructive",
                onPress: async () => {
                    try {
                        await signOut();
                        router.replace("/(auth)/login");
                    } catch (error) {
                        if (__DEV__) console.error("[more] Sign out error:", error);
                    }
                },
            },
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
                    style={{ ...CARD_STYLE, padding: 20, marginTop: 20 }}
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

                {/* ── Comunicação ── */}
                <SectionHeader title="Comunicação" delay={100} />
                <Animated.View
                    entering={FadeInUp.delay(120).duration(300).easing(Easing.out(Easing.cubic))}
                    style={CARD_STYLE}
                >
                    <MenuRow
                        icon={<IconBox bg="#ede9fe"><Bell size={18} color="#7c3aed" /></IconBox>}
                        label="Notificações"
                        onPress={() => router.push("/notification-settings" as any)}
                    />
                </Animated.View>

                {/* ── Conta ── */}
                <SectionHeader title="Conta" delay={160} />
                <Animated.View
                    entering={FadeInUp.delay(180).duration(300).easing(Easing.out(Easing.cubic))}
                    style={CARD_STYLE}
                >
                    {/* Subscription */}
                    <PressableScale
                        onPress={handleManageSubscription}
                        pressScale={0.98}
                        disabled={loadingPortal}
                        style={{ flexDirection: "row", alignItems: "center", paddingVertical: 16, paddingHorizontal: 20, opacity: loadingPortal ? 0.6 : 1 }}
                    >
                        <IconBox bg="#fffbeb">
                            <Crown size={18} color="#f59e0b" />
                        </IconBox>
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
                        {loadingPortal ? (
                            <ActivityIndicator size="small" color="#94a3b8" />
                        ) : (
                            <ExternalLink size={16} color="#94a3b8" />
                        )}
                    </PressableScale>

                    <Divider />

                    {/* Switch to Student */}
                    <MenuRow
                        icon={<IconBox bg="#f0fdf4"><ArrowLeftRight size={18} color="#16a34a" /></IconBox>}
                        label="Alternar para modo aluno"
                        onPress={handleSwitchToStudent}
                        trailing={null}
                    />
                </Animated.View>

                {/* ── Suporte ── */}
                <SectionHeader title="Suporte" delay={220} />
                <Animated.View
                    entering={FadeInUp.delay(240).duration(300).easing(Easing.out(Easing.cubic))}
                    style={CARD_STYLE}
                >
                    <MenuRow
                        icon={<IconBox bg="#f0fdf4"><MessageCircle size={18} color="#16a34a" /></IconBox>}
                        label="Ajuda via WhatsApp"
                        onPress={() => Linking.openURL(SUPPORT_WHATSAPP_URL)}
                        trailing={<ExternalLink size={16} color="#94a3b8" />}
                    />
                    <Divider />
                    <PressableScale
                        onPress={handleSignOut}
                        pressScale={0.98}
                        style={{ flexDirection: "row", alignItems: "center", paddingVertical: 16, paddingHorizontal: 20 }}
                    >
                        <IconBox bg="#fef2f2">
                            <LogOut size={18} color="#ef4444" />
                        </IconBox>
                        <Text style={{ fontSize: 14, fontWeight: "500", color: "#ef4444", flex: 1 }}>
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
