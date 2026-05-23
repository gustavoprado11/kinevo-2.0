import React, { useState } from "react";
import { View, Text, Alert, ScrollView, Pressable } from "react-native";
import Constants from "expo-constants";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../contexts/AuthContext";
import { useStudentProfile } from "../../hooks/useStudentProfile";
import { useRoleMode } from "../../contexts/RoleModeContext";
import { AvatarPicker } from "../../components/profile/AvatarPicker";
import { useRouter } from "expo-router";
import Animated, { FadeInUp, FadeIn, Easing } from "react-native-reanimated";
import {
    LogOut, Settings, HelpCircle, Shield, ChevronRight, CreditCard, Users,
    Sun, Moon, Monitor, Check, Heart, Award,
} from "lucide-react-native";
import { PressableScale } from "../../components/shared/PressableScale";
import { useV2Colors } from "../../hooks/useV2Colors";
import { LinearGradient } from "expo-linear-gradient";
import { v2 } from "@kinevo/shared/tokens";
import { AdaptiveModal } from "../../components/shared/AdaptiveModal";
import { useThemePreferenceStore, type ThemeMode } from "../../stores/themePreferenceStore";

// ── Menu item config movido para dentro do componente ──
// Os iconBg são rgba semi-transparentes que se adaptam ao surface (claro/escuro)
// e o iconColor neutro usa token (text.secondary) que inverte por modo.
// Item 'appearance' não tem `route` — abre AdaptiveModal local.

// ── Appearance options (mirror de (trainer-tabs)/more.tsx pra consistência) ──
const APPEARANCE_OPTIONS: Array<{ mode: ThemeMode; label: string; icon: typeof Sun }> = [
    { mode: "system", label: "Sistema", icon: Monitor },
    { mode: "light", label: "Claro", icon: Sun },
    { mode: "dark", label: "Escuro", icon: Moon },
];

function appearanceLabel(mode: ThemeMode): string {
    return APPEARANCE_OPTIONS.find((o) => o.mode === mode)?.label ?? "Sistema";
}

function appearanceIcon(mode: ThemeMode): typeof Sun {
    return APPEARANCE_OPTIONS.find((o) => o.mode === mode)?.icon ?? Monitor;
}

export default function ProfileScreen() {
    const colors = useV2Colors();
    const router = useRouter();
    const { user, signOut } = useAuth();
    const { profile, isUploading, updateAvatar } = useStudentProfile();
    const { isTrainer, switchToTrainer, subscriptionStatus } = useRoleMode();

    // Menu items com tints rgba (funcionam em light e dark) + iconColor neutro
    // via token que inverte automaticamente entre os modos.
    const MENU_ITEMS = [
        {
            id: 'achievements',
            label: 'Conquistas',
            Icon: Award,
            iconColor: '#F59E0B',
            iconBg: 'rgba(245, 158, 11, 0.12)',
            route: '/profile/achievements',
        },
        {
            id: 'settings',
            label: 'Configurações',
            Icon: Settings,
            iconColor: colors.text.secondary,
            iconBg: 'rgba(113, 113, 122, 0.12)',
            route: '/profile/settings',
        },
        {
            id: 'appearance',
            label: 'Aparência',
            Icon: Monitor,
            iconColor: '#7c3aed',
            iconBg: 'rgba(124, 58, 237, 0.12)',
            route: null as string | null,
        },
        {
            id: 'subscription',
            label: 'Minha Assinatura',
            Icon: CreditCard,
            iconColor: '#2563eb',
            iconBg: 'rgba(37, 99, 235, 0.14)',
            route: '/profile/subscription',
        },
        {
            id: 'connections',
            label: 'Conexões de Saúde',
            Icon: Heart,
            iconColor: '#EF4444',
            iconBg: 'rgba(239, 68, 68, 0.12)',
            route: '/profile/connections',
        },
        {
            id: 'support',
            label: 'Suporte',
            Icon: HelpCircle,
            iconColor: '#7c3aed',
            iconBg: 'rgba(124, 58, 237, 0.12)',
            route: '/profile/support',
        },
        {
            id: 'privacy',
            label: 'Privacidade',
            Icon: Shield,
            iconColor: '#10b981',
            iconBg: 'rgba(16, 185, 129, 0.14)',
            route: '/profile/privacy',
        },
    ];

    // Tema (Sistema/Claro/Escuro) — store global persiste em MMKV
    // e propaga para todas as telas via useV2Colors.
    const themeMode = useThemePreferenceStore((s) => s.mode);
    const setThemeMode = useThemePreferenceStore((s) => s.setMode);
    const [appearanceModalOpen, setAppearanceModalOpen] = useState(false);

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
                            if (__DEV__) console.error("Error signing out:", error);
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
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.canvas }} edges={["top"]}>
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
                showsVerticalScrollIndicator={false}
            >
                {/* ── Hero V2 student: dark gradient + journey stats ── */}
                <Animated.View
                    entering={FadeIn.duration(500)}
                    style={{
                        borderRadius: 24,
                        marginTop: 24,
                        marginBottom: 16,
                        overflow: 'hidden',
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.06)',
                        shadowColor: '#7C3AED',
                        shadowOffset: { width: 0, height: 12 },
                        shadowOpacity: 0.18,
                        shadowRadius: 24,
                        elevation: 8,
                    }}
                >
                    <LinearGradient
                        colors={['#18181B', '#27272A', '#3B0764']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{ padding: 20 }}
                    >
                        {/* Profile row */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 18 }}>
                            <View
                                style={{
                                    shadowColor: '#A78BFA',
                                    shadowOffset: { width: 0, height: 0 },
                                    shadowOpacity: 0.45,
                                    shadowRadius: 14,
                                    borderRadius: 36,
                                    padding: 2,
                                    borderWidth: 2,
                                    borderColor: 'rgba(255,255,255,0.9)',
                                }}
                            >
                                <AvatarPicker
                                    avatarUrl={profile?.avatar_url ?? null}
                                    isUploading={isUploading}
                                    onPick={updateAvatar}
                                    size={64}
                                />
                            </View>
                            <View style={{ flex: 1, gap: 2 }}>
                                <Text
                                    style={{
                                        fontFamily: 'PlusJakartaSans_800ExtraBold',
                                        fontSize: 18,
                                        letterSpacing: -0.4,
                                        color: '#FFFFFF',
                                    }}
                                    numberOfLines={1}
                                >
                                    {displayName}
                                </Text>
                                <Text
                                    style={{
                                        fontSize: 13,
                                        color: 'rgba(255,255,255,0.6)',
                                    }}
                                    numberOfLines={1}
                                >
                                    {displayEmail}
                                </Text>
                            </View>
                        </View>

                        {/* Journey stats inline — apenas dados disponíveis no hook
                            (StudentProfile não expõe totalWorkouts/totalVolume/streak;
                            esses ficam em useWorkoutHistory, fora do escopo de Profile).
                            Mantemos placeholder visual com label + valor genérico até
                            Fase 7 expor essas métricas globais ao Profile. */}
                        <View
                            style={{
                                borderTopWidth: 1,
                                borderTopColor: 'rgba(255,255,255,0.08)',
                                paddingTop: 14,
                                flexDirection: 'row',
                                justifyContent: 'space-between',
                            }}
                        >
                            <ProfileStat label="Plano" value="Aluno" />
                            <ProfileStat label="Status" value={profile?.status === 'active' ? 'Ativo' : '—'} />
                            <ProfileStat label="Treinador" value={profile?.coach?.name ? profile.coach.name.split(' ')[0] : '—'} />
                        </View>
                    </LinearGradient>
                </Animated.View>

                {/* ── Menu Section ── */}
                <Animated.View entering={FadeInUp.delay(100).duration(400).easing(Easing.out(Easing.cubic))}>
                    <Text
                        style={{
                            fontSize: 12,
                            fontWeight: "700",
                            color: colors.text.tertiary,
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
                            backgroundColor: colors.surface.card,
                            borderRadius: 20,
                            overflow: "hidden",
                            marginBottom: 24,
                            borderWidth: 1,
                            borderColor: colors.border.default,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.04,
                            shadowRadius: 8,
                            elevation: 2,
                        }}
                    >
                        {MENU_ITEMS.map((item, index) => {
                            const isAppearance = item.id === 'appearance';
                            const Icon = isAppearance ? appearanceIcon(themeMode) : item.Icon;
                            return (
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
                                                <Icon size={18} color={item.iconColor} strokeWidth={1.5} />
                                            </View>
                                        }
                                        label={item.label}
                                        sub={isAppearance ? appearanceLabel(themeMode) : undefined}
                                        onPress={() => {
                                            if (isAppearance) {
                                                setAppearanceModalOpen(true);
                                            } else if (item.route) {
                                                router.push(item.route as any);
                                            }
                                        }}
                                        index={index}
                                    />
                                    {/* Inset divider — aligned with text, not full width. Skip last item. */}
                                    {index < MENU_ITEMS.length - 1 && (
                                        <View
                                            style={{
                                                height: 1,
                                                backgroundColor: colors.border.subtle,
                                                marginLeft: 66,
                                                marginRight: 20,
                                            }}
                                        />
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </View>
                </Animated.View>

                {/* ── Trainer Mode CTA ── */}
                {isTrainer && (
                    <Animated.View entering={FadeInUp.delay(150).duration(400).easing(Easing.out(Easing.cubic))}>
                        <PressableScale
                            onPress={() => {
                                switchToTrainer();
                                if (subscriptionStatus !== "active" && subscriptionStatus !== "trialing") {
                                    router.replace("/trainer-subscription-blocked");
                                } else {
                                    router.replace("/(trainer-tabs)/dashboard");
                                }
                            }}
                            pressScale={0.97}
                            style={{
                                marginBottom: 24,
                                borderRadius: 20,
                                overflow: 'hidden',
                                shadowColor: '#7c3aed',
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: 0.12,
                                shadowRadius: 12,
                                elevation: 4,
                            }}
                        >
                            <View
                                style={{
                                    backgroundColor: 'rgba(124, 58, 237, 0.10)',
                                    flexDirection: "row",
                                    alignItems: "center",
                                    paddingVertical: 16,
                                    paddingHorizontal: 20,
                                    borderRadius: 20,
                                    borderWidth: 1,
                                    borderColor: 'rgba(124, 58, 237, 0.18)',
                                }}
                            >
                                <View
                                    style={{
                                        height: 32,
                                        width: 32,
                                        borderRadius: 8,
                                        backgroundColor: "rgba(124, 58, 237, 0.16)",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        marginRight: 14,
                                    }}
                                >
                                    <Users size={16} color="#7c3aed" strokeWidth={2} />
                                </View>
                                <Text
                                    style={{
                                        fontSize: 16,
                                        fontWeight: "600",
                                        color: "#7c3aed",
                                        flex: 1,
                                    }}
                                >
                                    Modo Treinador
                                </Text>
                                <ChevronRight size={16} color="#a78bfa" strokeWidth={1.5} />
                            </View>
                        </PressableScale>
                    </Animated.View>
                )}

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
                                backgroundColor: 'rgba(239, 68, 68, 0.10)',
                                flexDirection: "row",
                                alignItems: "center",
                                paddingVertical: 16,
                                paddingHorizontal: 20,
                                borderRadius: 20,
                                borderWidth: 1,
                                borderColor: 'rgba(239, 68, 68, 0.18)',
                            }}
                        >
                            <View
                                style={{
                                    height: 32,
                                    width: 32,
                                    borderRadius: 8,
                                    backgroundColor: "rgba(239, 68, 68, 0.16)",
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

                {/* Version footer (long-press em dev abre o Student DS Showcase) */}
                <Pressable
                    onLongPress={() => {
                        if (!__DEV__) return;
                        router.push("/(dev)/student-showcase");
                    }}
                    delayLongPress={800}
                    accessibilityRole="text"
                    accessibilityLabel={`Kinevo versão ${Constants.expoConfig?.version ?? "1.0.0"}`}
                >
                    <Text
                        style={{
                            textAlign: "center",
                            fontSize: 11,
                            color: colors.text.quaternary,
                            paddingVertical: 8,
                        }}
                    >
                        Kinevo v{Constants.expoConfig?.version ?? "1.0.0"}
                    </Text>
                </Pressable>
            </ScrollView>

            {/* Modal Aparência — radio Sistema/Claro/Escuro.
                Reusa pattern de (trainer-tabs)/more.tsx pra consistência. */}
            <AdaptiveModal
                visible={appearanceModalOpen}
                onClose={() => setAppearanceModalOpen(false)}
                title="Aparência"
            >
                <View style={{ paddingHorizontal: v2.spacing[5], paddingTop: v2.spacing[4], gap: v2.spacing[2] }}>
                    {APPEARANCE_OPTIONS.map((opt) => {
                        const isActive = themeMode === opt.mode;
                        const OptIcon = opt.icon;
                        return (
                            <Pressable
                                key={opt.mode}
                                onPress={() => {
                                    setThemeMode(opt.mode);
                                    setAppearanceModalOpen(false);
                                }}
                                accessibilityRole="radio"
                                accessibilityLabel={opt.label}
                                accessibilityState={{ selected: isActive }}
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: v2.spacing[3],
                                    paddingVertical: v2.spacing[3] + 2,
                                    paddingHorizontal: v2.spacing[4],
                                    borderRadius: v2.radius.md,
                                    borderWidth: 1,
                                    borderColor: isActive ? colors.purple[300] : colors.border.default,
                                    backgroundColor: isActive ? colors.surface.tintPurple : colors.surface.card,
                                }}
                            >
                                <View
                                    style={{
                                        width: 32,
                                        height: 32,
                                        borderRadius: v2.radius.sm,
                                        backgroundColor: isActive ? colors.purple[100] : colors.neutral[100],
                                        alignItems: "center",
                                        justifyContent: "center",
                                    }}
                                >
                                    <OptIcon
                                        size={16}
                                        color={isActive ? colors.purple[700] : colors.text.secondary}
                                        strokeWidth={2.2}
                                    />
                                </View>
                                <Text
                                    style={{
                                        flex: 1,
                                        fontFamily: "PlusJakartaSans_600SemiBold",
                                        fontSize: 14,
                                        color: colors.text.primary,
                                    }}
                                >
                                    {opt.label}
                                </Text>
                                {isActive ? (
                                    <Check size={18} color={colors.purple[600]} strokeWidth={2.4} />
                                ) : null}
                            </Pressable>
                        );
                    })}
                    <Text
                        style={{
                            fontFamily: "PlusJakartaSans_500Medium",
                            fontSize: 12,
                            color: colors.text.tertiary,
                            marginTop: v2.spacing[2],
                            paddingHorizontal: v2.spacing[2],
                        }}
                    >
                        "Sistema" segue a configuração de aparência do iOS (Ajustes › Tela e Brilho).
                    </Text>
                </View>
            </AdaptiveModal>
        </SafeAreaView>
    );
}

/* ─── Menu Item with Squish ─── */

function MenuItem({
    icon,
    label,
    sub,
    onPress,
    index,
}: {
    icon: React.ReactNode;
    label: string;
    sub?: string;
    onPress: () => void;
    index: number;
}) {
    const colors = useV2Colors();
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
                <View style={{ flex: 1 }}>
                    <Text
                        style={{
                            fontSize: 16,
                            fontWeight: "500",
                            color: colors.text.primary,
                        }}
                    >
                        {label}
                    </Text>
                    {sub ? (
                        <Text
                            style={{
                                fontSize: 12,
                                fontWeight: "500",
                                color: colors.text.tertiary,
                                marginTop: 2,
                            }}
                        >
                            {sub}
                        </Text>
                    ) : null}
                </View>
                <ChevronRight size={16} color={colors.text.quaternary} strokeWidth={1.5} />
            </PressableScale>
        </Animated.View>
    );
}

/* ─── Profile stat (inline col em hero) ─── */
function ProfileStat({ label, value }: { label: string; value: string }) {
    return (
        <View style={{ flex: 1, alignItems: 'center', gap: 4 }}>
            <Text
                style={{
                    fontFamily: 'PlusJakartaSans_800ExtraBold',
                    fontSize: 16,
                    letterSpacing: -0.3,
                    color: '#FFFFFF',
                }}
                numberOfLines={1}
            >
                {value}
            </Text>
            <Text
                style={{
                    fontFamily: 'PlusJakartaSans_700Bold',
                    fontSize: 9.5,
                    letterSpacing: 0.6,
                    textTransform: 'uppercase',
                    color: 'rgba(255,255,255,0.6)',
                }}
            >
                {label}
            </Text>
        </View>
    );
}
