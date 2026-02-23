import React from "react";
import { View, Text, Alert, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../contexts/AuthContext";
import { useStudentProfile } from "../../hooks/useStudentProfile";
import { AvatarPicker } from "../../components/profile/AvatarPicker";
import { useRouter } from "expo-router";
import Animated, { FadeInUp, FadeIn, Easing } from "react-native-reanimated";
import { LogOut, Settings, HelpCircle, Shield, ChevronRight, CreditCard } from "lucide-react-native";
import { PressableScale } from "../../components/shared/PressableScale";

// ── Menu item config with semantic colors ──
const MENU_ITEMS = [
    {
        id: 'settings',
        label: 'Configurações',
        Icon: Settings,
        iconColor: '#475569',
        iconBg: '#f1f5f9',
        route: '/profile/settings',
    },
    {
        id: 'subscription',
        label: 'Minha Assinatura',
        Icon: CreditCard,
        iconColor: '#2563eb',
        iconBg: '#eff6ff',
        route: '/profile/subscription',
    },
    {
        id: 'support',
        label: 'Suporte',
        Icon: HelpCircle,
        iconColor: '#7c3aed',
        iconBg: '#f5f3ff',
        route: '/profile/support',
    },
    {
        id: 'privacy',
        label: 'Privacidade',
        Icon: Shield,
        iconColor: '#059669',
        iconBg: '#ecfdf5',
        route: '/profile/privacy',
    },
] as const;

export default function ProfileScreen() {
    const router = useRouter();
    const { user, signOut } = useAuth();
    const { profile, isUploading, updateAvatar } = useStudentProfile();

    const handleSignOut = async () => {
        Alert.alert(
            "Sair da conta",
            "Deseja realmente sair?",
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Sair",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await signOut();
                            router.replace("/login");
                        } catch (error) {
                            console.error("Error signing out:", error);
                            Alert.alert("Erro", "Não foi possível sair da conta.");
                        }
                    },
                },
            ]
        );
    };

    const displayName = profile?.name ?? user?.email?.split("@")[0] ?? "Atleta";
    const displayEmail = profile?.email ?? user?.email;

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: "#F2F2F7" }} edges={["top"]}>
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
                showsVerticalScrollIndicator={false}
            >
                {/* ── Profile Card ── */}
                <Animated.View
                    entering={FadeIn.duration(500)}
                    style={{
                        backgroundColor: '#ffffff',
                        borderRadius: 24,
                        padding: 24,
                        alignItems: "center",
                        marginTop: 24,
                        marginBottom: 24,
                        borderWidth: 1,
                        borderColor: 'rgba(0, 0, 0, 0.04)',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.04,
                        shadowRadius: 8,
                        elevation: 2,
                    }}
                >
                    {/* Avatar with cutout badge */}
                    <View style={{ marginBottom: 20 }}>
                        <AvatarPicker
                            avatarUrl={profile?.avatar_url ?? null}
                            isUploading={isUploading}
                            onPick={updateAvatar}
                            size={88}
                        />
                    </View>

                    {/* Name */}
                    <Text
                        style={{
                            fontSize: 24,
                            fontWeight: "700",
                            color: "#0f172a",
                            marginBottom: 4,
                            marginTop: 8,
                        }}
                    >
                        {displayName}
                    </Text>

                    {/* Email */}
                    <Text style={{ fontSize: 14, color: "#64748b" }}>
                        {displayEmail}
                    </Text>
                </Animated.View>

                {/* ── Menu Section ── */}
                <Animated.View entering={FadeInUp.delay(100).duration(400).easing(Easing.out(Easing.cubic))}>
                    <Text
                        style={{
                            fontSize: 12,
                            fontWeight: "700",
                            color: "#94a3b8",
                            textTransform: "uppercase",
                            letterSpacing: 1,
                            marginBottom: 8,
                            paddingHorizontal: 16,
                        }}
                    >
                        Geral
                    </Text>

                    <View
                        style={{
                            backgroundColor: '#ffffff',
                            borderRadius: 20,
                            overflow: "hidden",
                            marginBottom: 24,
                            borderWidth: 1,
                            borderColor: 'rgba(0, 0, 0, 0.04)',
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.04,
                            shadowRadius: 8,
                            elevation: 2,
                        }}
                    >
                        {MENU_ITEMS.map((item, index) => (
                            <React.Fragment key={item.id}>
                                <MenuItem
                                    icon={
                                        <View
                                            style={{
                                                height: 32,
                                                width: 32,
                                                borderRadius: 8,
                                                backgroundColor: item.iconBg,
                                                alignItems: "center",
                                                justifyContent: "center",
                                            }}
                                        >
                                            <item.Icon size={18} color={item.iconColor} strokeWidth={1.5} />
                                        </View>
                                    }
                                    label={item.label}
                                    onPress={() => router.push(item.route as any)}
                                    index={index}
                                />
                                {/* Inset divider — aligned with text, not full width. Skip last item. */}
                                {index < MENU_ITEMS.length - 1 && (
                                    <View
                                        style={{
                                            height: 1,
                                            backgroundColor: "#f1f5f9",
                                            marginLeft: 66,
                                            marginRight: 20,
                                        }}
                                    />
                                )}
                            </React.Fragment>
                        ))}
                    </View>
                </Animated.View>

                {/* ── Logout (Destructive Action) ── */}
                <Animated.View entering={FadeInUp.delay(200).duration(400).easing(Easing.out(Easing.cubic))}>
                    <PressableScale
                        onPress={handleSignOut}
                        pressScale={0.97}
                        style={{
                            marginBottom: 32,
                            borderRadius: 20,
                            overflow: 'hidden',
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.04,
                            shadowRadius: 8,
                            elevation: 2,
                        }}
                    >
                        <View
                            style={{
                                backgroundColor: '#fef2f2',
                                flexDirection: "row",
                                alignItems: "center",
                                paddingVertical: 16,
                                paddingHorizontal: 20,
                                borderRadius: 20,
                                borderWidth: 1,
                                borderColor: 'rgba(239, 68, 68, 0.08)',
                            }}
                        >
                            <View
                                style={{
                                    height: 32,
                                    width: 32,
                                    borderRadius: 8,
                                    backgroundColor: "rgba(239, 68, 68, 0.1)",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    marginRight: 14,
                                }}
                            >
                                <LogOut size={16} color="#ef4444" strokeWidth={2} />
                            </View>
                            <Text
                                style={{
                                    fontSize: 16,
                                    fontWeight: "500",
                                    color: "#ef4444",
                                    flex: 1,
                                }}
                            >
                                Sair da conta
                            </Text>
                            <ChevronRight size={16} color="#fca5a5" strokeWidth={1.5} />
                        </View>
                    </PressableScale>
                </Animated.View>
            </ScrollView>
        </SafeAreaView>
    );
}

/* ─── Menu Item with Squish ─── */

function MenuItem({
    icon,
    label,
    onPress,
    index,
}: {
    icon: React.ReactNode;
    label: string;
    onPress: () => void;
    index: number;
}) {
    return (
        <Animated.View entering={FadeInUp.delay(150 + index * 20).duration(400).easing(Easing.out(Easing.cubic))}>
            <PressableScale
                onPress={onPress}
                pressScale={0.98}
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: 14,
                    paddingHorizontal: 20,
                    backgroundColor: "transparent",
                }}
            >
                <View style={{ marginRight: 14 }}>
                    {icon}
                </View>
                <Text
                    style={{
                        fontSize: 16,
                        fontWeight: "500",
                        color: "#0f172a",
                        flex: 1,
                    }}
                >
                    {label}
                </Text>
                <ChevronRight size={16} color="#cbd5e1" strokeWidth={1.5} />
            </PressableScale>
        </Animated.View>
    );
}
