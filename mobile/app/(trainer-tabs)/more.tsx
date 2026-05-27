import React, { useCallback, useState } from "react";
import { View, Text, ScrollView, Linking, Alert, ActivityIndicator, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
    ArrowLeftRight,
    Bell,
    User,
    ChevronRight,
    Crown,
    ExternalLink,
    Inbox,
    Instagram,
    LogOut,
    MessageCircle,
    Sun,
    Moon,
    Monitor,
    Check,
    UserCog,
} from "lucide-react-native";
import Animated, { FadeIn, FadeInUp, Easing } from "react-native-reanimated";
import Constants from "expo-constants";
import { useRoleMode } from "../../contexts/RoleModeContext";
import { useTrainerLeads } from "../../hooks/useTrainerLeads";
import { useAuth } from "../../contexts/AuthContext";
import { PressableScale } from "../../components/shared/PressableScale";
import { supabase } from "../../lib/supabase";
import { WEB_URL } from "../../lib/config";
import { v2 } from "@kinevo/shared/tokens";
import { Avatar, KCard, KStatus, type KStatusType } from "../../components/v2";
import { useV2Colors } from "../../hooks/useV2Colors";
import { toRgba } from "../../lib/brandColor";
import { AdaptiveModal } from "../../components/shared/AdaptiveModal";
import {
    useThemePreferenceStore,
    type ThemeMode,
} from "../../stores/themePreferenceStore";

// Palette light fallback usada em arrays/configs module-level. Componentes
// chamam useV2Colors() para tokens sensíveis a modo.
const { colors, typography, spacing, radius } = v2;

const WEB_BASE_URL = WEB_URL;
const SUPPORT_WHATSAPP_URL =
    "https://wa.me/5531999064997?text=Ol%C3%A1!%20Preciso%20de%20ajuda%20com%20o%20app%20Kinevo.";

function subscriptionStatusInfo(status: string | null): { text: string; type: KStatusType } {
    switch (status) {
        case "active":
            return { text: "Pro · ativa", type: "success" };
        case "trialing":
            return { text: "Teste gratuito", type: "info" };
        case "past_due":
            return { text: "Pagamento pendente", type: "warning" };
        case "canceled":
            return { text: "Cancelada", type: "danger" };
        default:
            return { text: "Sem assinatura", type: "neutral" };
    }
}

function SectionLabel({ title, delay }: { title: string; delay: number }) {
    const colors = useV2Colors();
    return (
        <Animated.Text
            entering={FadeInUp.delay(delay).duration(300).easing(Easing.out(Easing.cubic))}
            style={{
                fontFamily: "PlusJakartaSans_700Bold",
                fontSize: 11,
                color: colors.text.tertiary,
                textTransform: "uppercase",
                letterSpacing: 1.4,
                marginBottom: spacing[2],
                marginTop: spacing[5],
                paddingLeft: 2,
            }}
        >
            {title}
        </Animated.Text>
    );
}

function MenuRow({
    icon,
    label,
    sub,
    onPress,
    trailing,
    danger,
    disabled,
}: {
    icon: React.ReactNode;
    label: string;
    sub?: React.ReactNode;
    onPress: () => void;
    trailing?: React.ReactNode | null;
    danger?: boolean;
    disabled?: boolean;
}) {
    const colors = useV2Colors();
    return (
        <PressableScale
            onPress={onPress}
            pressScale={0.99}
            disabled={disabled}
            style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: spacing[3] + 2,
                paddingHorizontal: spacing[4],
                opacity: disabled ? 0.6 : 1,
            }}
            accessibilityLabel={label}
        >
            {icon}
            <View style={{ flex: 1, marginLeft: spacing[3] }}>
                <Text
                    style={{
                        fontFamily: "PlusJakartaSans_600SemiBold",
                        fontSize: 14,
                        color: danger ? colors.semantic.danger.fg : colors.text.primary,
                    }}
                >
                    {label}
                </Text>
                {sub ? <View style={{ marginTop: 4 }}>{sub}</View> : null}
            </View>
            {trailing !== null
                ? trailing ?? <ChevronRight size={16} color={colors.text.quaternary} />
                : null}
        </PressableScale>
    );
}

function Divider() {
    const colors = useV2Colors();
    return (
        <View
            style={{
                height: 1,
                backgroundColor: colors.border.subtle,
                marginHorizontal: spacing[4],
            }}
        />
    );
}

/**
 * Linha "Leads" no menu — usa o hook pra mostrar contador de não-lidos
 * como badge à direita. Realtime via subscribe em trainer_leads.
 */
function LeadsMenuRow() {
    const router = useRouter();
    const colors = useV2Colors();
    const { unreadCount } = useTrainerLeads();
    return (
        <MenuRow
            icon={
                <IconBox bg={toRgba(colors.brand.primary, 0.12)}>
                    <Inbox size={16} color={colors.brand.primary} strokeWidth={2.2} />
                </IconBox>
            }
            label="Leads"
            sub={
                <Text
                    style={{
                        fontFamily: "PlusJakartaSans_500Medium",
                        fontSize: 12,
                        color: colors.text.tertiary,
                    }}
                >
                    {unreadCount > 0
                        ? `${unreadCount} ${unreadCount === 1 ? "novo lead" : "novos leads"}`
                        : "Vindos da sua landing pública"}
                </Text>
            }
            trailing={
                unreadCount > 0 ? (
                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 4,
                        }}
                    >
                        <View
                            style={{
                                minWidth: 22,
                                height: 22,
                                paddingHorizontal: 6,
                                borderRadius: 11,
                                backgroundColor: colors.brand.primary,
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <Text
                                style={{
                                    fontFamily: "PlusJakartaSans_700Bold",
                                    fontSize: 11,
                                    color: "#fff",
                                }}
                            >
                                {unreadCount > 99 ? "99+" : unreadCount}
                            </Text>
                        </View>
                        <ChevronRight size={16} color={colors.text.quaternary} />
                    </View>
                ) : undefined
            }
            onPress={() => router.push("/leads" as never)}
        />
    );
}

function IconBox({ bg, children }: { bg: string; children: React.ReactNode }) {
    return (
        <View
            style={{
                width: 32,
                height: 32,
                borderRadius: radius.sm,
                backgroundColor: bg,
                alignItems: "center",
                justifyContent: "center",
            }}
        >
            {children}
        </View>
    );
}

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

export default function MoreScreen() {
    const colors = useV2Colors();
    const { trainerProfile, subscriptionStatus, switchToStudent } = useRoleMode();
    const { signOut } = useAuth();
    const router = useRouter();
    const appVersion = Constants.expoConfig?.version ?? "1.0.0";
    const subInfo = subscriptionStatusInfo(subscriptionStatus);
    const themeMode = useThemePreferenceStore((s) => s.mode);
    const setThemeMode = useThemePreferenceStore((s) => s.setMode);
    const AppearanceIcon = appearanceIcon(themeMode);

    const [loadingPortal, setLoadingPortal] = useState(false);
    const [appearanceModalOpen, setAppearanceModalOpen] = useState(false);

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
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.canvas }} edges={["top"]}>
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{
                    paddingHorizontal: spacing[5],
                    paddingTop: spacing[4],
                    paddingBottom: 120,
                }}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <Animated.View entering={FadeIn.duration(400)}>
                    <Text
                        style={{
                            fontFamily: "PlusJakartaSans_800ExtraBold",
                            fontSize: typography.display.size,
                            lineHeight: typography.display.lineHeight,
                            letterSpacing: typography.display.letterSpacing,
                            color: colors.text.primary,
                        }}
                    >
                        Mais
                    </Text>
                </Animated.View>

                {/* Hero — gradient escuro + glow + Avatar do trainer */}
                <Animated.View
                    entering={FadeInUp.delay(60).duration(300).easing(Easing.out(Easing.cubic))}
                    style={{
                        marginTop: spacing[5],
                        borderRadius: radius.lg,
                        overflow: "hidden",
                        shadowColor: colors.purple[700],
                        shadowOffset: { width: 0, height: 8 },
                        shadowOpacity: 0.18,
                        shadowRadius: 24,
                        elevation: 8,
                    }}
                >
                    <LinearGradient
                        colors={[colors.neutral[900], colors.neutral[800], colors.purple[900]]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{ padding: spacing[5] }}
                    >
                        {/* Glow radial roxo (decorativo) */}
                        <View
                            pointerEvents="none"
                            style={{
                                position: "absolute",
                                top: -60,
                                right: -40,
                                width: 180,
                                height: 180,
                                borderRadius: 90,
                                backgroundColor: colors.purple[500],
                                opacity: 0.18,
                            }}
                        />

                        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[3] }}>
                            <View
                                style={{
                                    padding: 3,
                                    borderRadius: 999,
                                    backgroundColor: colors.purple[500],
                                }}
                            >
                                <View
                                    style={{
                                        padding: 2,
                                        borderRadius: 999,
                                        backgroundColor: "#FFFFFF",
                                    }}
                                >
                                    <Avatar
                                        name={trainerProfile?.name ?? "Treinador"}
                                        size="lg"
                                        src={trainerProfile?.avatar_url ?? undefined}
                                    />
                                </View>
                            </View>

                            <View style={{ flex: 1 }}>
                                <View
                                    style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}
                                >
                                    <Text
                                        style={{
                                            fontFamily: "PlusJakartaSans_800ExtraBold",
                                            fontSize: 17,
                                            color: "#FFFFFF",
                                            letterSpacing: -0.4,
                                            flex: 1,
                                        }}
                                        numberOfLines={1}
                                    >
                                        {trainerProfile?.name || "Treinador"}
                                    </Text>
                                    {subscriptionStatus === "active" ? (
                                        <View
                                            style={{
                                                backgroundColor: "rgba(245,158,11,0.18)",
                                                paddingHorizontal: spacing[2],
                                                paddingVertical: 2,
                                                borderRadius: radius.sm,
                                                borderWidth: 1,
                                                borderColor: "rgba(245,158,11,0.4)",
                                            }}
                                        >
                                            <Text
                                                style={{
                                                    fontFamily: "PlusJakartaSans_800ExtraBold",
                                                    fontSize: 10,
                                                    color: "#FCD34D",
                                                    letterSpacing: 0.6,
                                                }}
                                            >
                                                PRO
                                            </Text>
                                        </View>
                                    ) : null}
                                </View>
                                <Text
                                    style={{
                                        fontFamily: "PlusJakartaSans_500Medium",
                                        fontSize: 12,
                                        color: "rgba(255,255,255,0.6)",
                                        marginTop: 2,
                                    }}
                                    numberOfLines={1}
                                >
                                    {trainerProfile?.email || ""}
                                </Text>
                            </View>
                        </View>
                    </LinearGradient>
                </Animated.View>

                {/* Captação */}
                <SectionLabel title="Captação" delay={100} />
                <Animated.View
                    entering={FadeInUp.delay(120).duration(300).easing(Easing.out(Easing.cubic))}
                >
                    <KCard style={{ padding: 0 }}>
                        <LeadsMenuRow />
                    </KCard>
                </Animated.View>

                {/* Comunicação */}
                <SectionLabel title="Comunicação" delay={140} />
                <Animated.View
                    entering={FadeInUp.delay(140).duration(300).easing(Easing.out(Easing.cubic))}
                >
                    <KCard style={{ padding: 0 }}>
                        <MenuRow
                            icon={
                                <IconBox bg={toRgba(colors.brand.primary, 0.12)}>
                                    <Bell size={16} color={colors.brand.primary} strokeWidth={2.2} />
                                </IconBox>
                            }
                            label="Notificações"
                            onPress={() => router.push("/notification-settings" as never)}
                        />
                    </KCard>
                </Animated.View>

                {/* Conta */}
                <SectionLabel title="Conta" delay={180} />
                <Animated.View
                    entering={FadeInUp.delay(200).duration(300).easing(Easing.out(Easing.cubic))}
                >
                    <KCard style={{ padding: 0 }}>
                        <MenuRow
                            icon={
                                <IconBox bg={toRgba(colors.brand.primary, 0.12)}>
                                    <UserCog size={16} color={colors.brand.primary} strokeWidth={2.2} />
                                </IconBox>
                            }
                            label="Editar perfil"
                            sub={
                                trainerProfile?.instagram_handle ? (
                                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                                        <Instagram size={11} color={colors.text.tertiary} strokeWidth={2.2} />
                                        <Text
                                            style={{
                                                fontFamily: "PlusJakartaSans_500Medium",
                                                fontSize: 12,
                                                color: colors.text.tertiary,
                                            }}
                                        >
                                            @{trainerProfile.instagram_handle}
                                        </Text>
                                    </View>
                                ) : (
                                    <Text
                                        style={{
                                            fontFamily: "PlusJakartaSans_500Medium",
                                            fontSize: 12,
                                            color: colors.text.tertiary,
                                        }}
                                    >
                                        Adicione seu Instagram pros cards de share
                                    </Text>
                                )
                            }
                            onPress={() => router.push("/trainer-profile" as never)}
                        />
                        <Divider />
                        <MenuRow
                            icon={
                                <IconBox bg={'rgba(245, 158, 11, 0.12)'}>
                                    <Crown size={16} color={colors.semantic.warning.default} strokeWidth={2.2} />
                                </IconBox>
                            }
                            label="Assinatura Kinevo"
                            sub={<KStatus type={subInfo.type} label={subInfo.text} layout="pill" size="sm" />}
                            onPress={handleManageSubscription}
                            disabled={loadingPortal}
                            trailing={
                                loadingPortal ? (
                                    <ActivityIndicator size="small" color={colors.text.quaternary} />
                                ) : (
                                    <ExternalLink size={16} color={colors.text.quaternary} />
                                )
                            }
                        />
                        <Divider />
                        <MenuRow
                            icon={
                                <IconBox bg={toRgba(colors.brand.primary, 0.12)}>
                                    <AppearanceIcon size={16} color={colors.brand.primary} strokeWidth={2.2} />
                                </IconBox>
                            }
                            label="Aparência"
                            sub={
                                <Text
                                    style={{
                                        fontFamily: "PlusJakartaSans_500Medium",
                                        fontSize: 12,
                                        color: colors.text.tertiary,
                                    }}
                                >
                                    {appearanceLabel(themeMode)}
                                </Text>
                            }
                            onPress={() => setAppearanceModalOpen(true)}
                        />
                    </KCard>
                </Animated.View>

                {/* Suporte */}
                <SectionLabel title="Suporte" delay={240} />
                <Animated.View
                    entering={FadeInUp.delay(260).duration(300).easing(Easing.out(Easing.cubic))}
                >
                    <KCard style={{ padding: 0 }}>
                        <MenuRow
                            icon={
                                <IconBox bg={'rgba(16, 185, 129, 0.14)'}>
                                    <MessageCircle size={16} color={colors.semantic.success.default} strokeWidth={2.2} />
                                </IconBox>
                            }
                            label="Ajuda via WhatsApp"
                            onPress={() => Linking.openURL(SUPPORT_WHATSAPP_URL)}
                            trailing={<ExternalLink size={16} color={colors.text.quaternary} />}
                        />
                        <Divider />
                        <MenuRow
                            icon={
                                <IconBox bg={'rgba(239, 68, 68, 0.12)'}>
                                    <LogOut size={16} color={colors.semantic.danger.default} strokeWidth={2.2} />
                                </IconBox>
                            }
                            label="Sair da conta"
                            onPress={handleSignOut}
                            danger
                            trailing={null}
                        />
                    </KCard>
                </Animated.View>

                {/* Modo Aluno CTA — espelha o "Modo Treinador" do perfil do aluno
                 *  (app/(tabs)/profile.tsx): mesma posição, mesma estética
                 *  (tint da marca + ícone na cor da marca). */}
                <Animated.View entering={FadeInUp.delay(300).duration(300).easing(Easing.out(Easing.cubic))}>
                    <PressableScale
                        onPress={handleSwitchToStudent}
                        pressScale={0.97}
                        style={{
                            marginTop: spacing[5],
                            marginBottom: spacing[3],
                            borderRadius: 20,
                            overflow: 'hidden',
                            shadowColor: colors.brand.primary,
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.12,
                            shadowRadius: 12,
                            elevation: 4,
                        }}
                    >
                        <View
                            style={{
                                backgroundColor: toRgba(colors.brand.primary, 0.10),
                                flexDirection: "row",
                                alignItems: "center",
                                paddingVertical: 16,
                                paddingHorizontal: 20,
                                borderRadius: 20,
                                borderWidth: 1,
                                borderColor: toRgba(colors.brand.primary, 0.18),
                            }}
                        >
                            <View
                                style={{
                                    height: 32,
                                    width: 32,
                                    borderRadius: 8,
                                    backgroundColor: toRgba(colors.brand.primary, 0.16),
                                    alignItems: "center",
                                    justifyContent: "center",
                                    marginRight: 14,
                                }}
                            >
                                <User size={16} color={colors.brand.primary} strokeWidth={2} />
                            </View>
                            <Text
                                style={{
                                    fontSize: 16,
                                    fontWeight: "600",
                                    color: colors.brand.primary,
                                    flex: 1,
                                }}
                            >
                                Modo Aluno
                            </Text>
                            <ChevronRight size={16} color={colors.brand.primary} strokeWidth={1.5} />
                        </View>
                    </PressableScale>
                </Animated.View>

                {/* Version (long-press em dev abre o DS Showcase) — preservado da Fase 1 */}
                <Pressable
                    onLongPress={() => {
                        if (!__DEV__) return;
                        router.push("/(dev)/components-showcase");
                    }}
                    delayLongPress={800}
                    accessibilityRole="text"
                    accessibilityLabel={`Kinevo versão ${appVersion}, modo treinador`}
                >
                    <Text
                        style={{
                            textAlign: "center",
                            fontFamily: "PlusJakartaSans_500Medium",
                            fontSize: 11,
                            color: colors.text.quaternary,
                            marginTop: spacing[6],
                        }}
                    >
                        Kinevo v{appVersion} — Modo Treinador
                    </Text>
                </Pressable>
            </ScrollView>

            <AdaptiveModal
                visible={appearanceModalOpen}
                onClose={() => setAppearanceModalOpen(false)}
                title="Aparência"
            >
                <View style={{ paddingHorizontal: spacing[5], paddingTop: spacing[4], gap: spacing[2] }}>
                    {APPEARANCE_OPTIONS.map((opt) => {
                        const isActive = themeMode === opt.mode;
                        const Icon = opt.icon;
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
                                    gap: spacing[3],
                                    paddingVertical: spacing[3] + 2,
                                    paddingHorizontal: spacing[4],
                                    borderRadius: radius.md,
                                    borderWidth: 1,
                                    borderColor: isActive ? colors.purple[300] : colors.border.default,
                                    backgroundColor: isActive ? colors.surface.tintPurple : colors.surface.card,
                                }}
                            >
                                <View
                                    style={{
                                        width: 32,
                                        height: 32,
                                        borderRadius: radius.sm,
                                        backgroundColor: isActive ? colors.purple[100] : colors.neutral[100],
                                        alignItems: "center",
                                        justifyContent: "center",
                                    }}
                                >
                                    <Icon
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
                            marginTop: spacing[2],
                            paddingHorizontal: spacing[2],
                        }}
                    >
                        "Sistema" segue a configuração de aparência do iOS (Ajustes › Tela e Brilho).
                    </Text>
                </View>
            </AdaptiveModal>
        </SafeAreaView>
    );
}
