import React, { useCallback, useEffect } from "react";
import { Tabs, usePathname, useRouter, Redirect } from "expo-router";
import { LayoutDashboard, Users, MessageCircle, ClipboardList, MoreHorizontal } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View, AppState } from "react-native";
import { useRoleMode } from "../../contexts/RoleModeContext";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { usePendingSubmissionsCount } from "../../hooks/usePendingSubmissionsCount";
import { useTrainerConversations } from "../../hooks/useTrainerConversations";
import { useResponsive } from "../../hooks/useResponsive";
import { NavigationSidebar, TabConfig } from "../../components/shared/NavigationSidebar";
import { BottomNav } from "../../components/v2";
import { v2 } from "@kinevo/shared/tokens";

const { spacing } = v2;

export default function TrainerTabsLayout() {
    const insets = useSafeAreaInsets();
    const pendingFormsCount = usePendingSubmissionsCount();
    const { totalUnread } = useTrainerConversations();
    const { isTablet, isLandscape } = useResponsive();
    const router = useRouter();
    const pathname = usePathname();
    const { subscriptionStatus, isLoadingRole, isTrainer, refreshRoleMode } = useRoleMode();

    // Revalida a assinatura ao voltar pro foreground, tornando o gate reativo
    // (antes só revalidava reabrindo o app pelo index).
    useEffect(() => {
        const sub = AppState.addEventListener("change", (state) => {
            if (state === "active") refreshRoleMode();
        });
        return () => sub.remove();
    }, [refreshRoleMode]);

    const TRAINER_TABS: TabConfig[] = [
        { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
        { key: "students", label: "Alunos", icon: Users },
        { key: "messages", label: "Mensagens", icon: MessageCircle, badge: totalUnread },
        { key: "forms", label: "Formulários", icon: ClipboardList, badge: pendingFormsCount },
        { key: "more", label: "Mais", icon: MoreHorizontal },
    ];

    const activeTab = TRAINER_TABS.find((t) => pathname.includes(t.key))?.key ?? "dashboard";

    const handleTabPress = useCallback(
        (tabKey: string) => {
            router.navigate(`/(trainer-tabs)/${tabKey}` as never);
        },
        [router],
    );

    const renderBottomNav = useCallback(
        (props: BottomTabBarProps) => {
            if (isTablet) return null;

            const tabsForNav = props.state.routes
                .map((route) => {
                    const cfg = TRAINER_TABS.find((t) => t.key === route.name);
                    if (!cfg) return null;
                    const Icon = cfg.icon;
                    return {
                        key: route.name,
                        label: cfg.label,
                        // Color/strokeWidth são sobrescritos pelo BottomNav via cloneElement.
                        icon: <Icon size={22} color="#000" strokeWidth={2} />,
                        badge: cfg.badge,
                    };
                })
                .filter((t): t is NonNullable<typeof t> => t !== null);

            const activeKey = props.state.routes[props.state.index]?.name ?? "dashboard";

            return (
                <View
                    pointerEvents="box-none"
                    style={{
                        position: "absolute",
                        left: spacing[3],
                        right: spacing[3],
                        bottom: insets.bottom + spacing[2],
                    }}
                >
                    <BottomNav
                        tabs={tabsForNav}
                        activeKey={activeKey}
                        onChange={(key) => {
                            const target = props.state.routes.find((r) => r.name === key);
                            if (!target) return;
                            const event = props.navigation.emit({
                                type: "tabPress",
                                target: target.key,
                                canPreventDefault: true,
                            });
                            if (!event.defaultPrevented) {
                                props.navigation.navigate(target.name);
                            }
                        }}
                        accessibilityLabel="Navegação principal do treinador"
                    />
                </View>
            );
        },
        [insets.bottom, isTablet, totalUnread, pendingFormsCount],
    );

    const tabContent = (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: { display: "none" },
            }}
            tabBar={renderBottomNav}
        >
            <Tabs.Screen
                name="dashboard"
                options={{ title: "Dashboard", tabBarAccessibilityLabel: "Painel de controle" }}
            />
            <Tabs.Screen
                name="students"
                options={{ title: "Alunos", tabBarAccessibilityLabel: "Lista de alunos" }}
            />
            <Tabs.Screen
                name="messages"
                options={{ title: "Mensagens", tabBarAccessibilityLabel: "Mensagens" }}
            />
            <Tabs.Screen
                name="forms"
                options={{ title: "Formulários", tabBarAccessibilityLabel: "Formulários" }}
            />
            <Tabs.Screen name="training-room" options={{ href: null }} />
            <Tabs.Screen
                name="more"
                options={{ title: "Mais", tabBarAccessibilityLabel: "Mais opções" }}
            />
        </Tabs>
    );

    // Gate reativo de assinatura: se deixou de ser válida, bloqueia na hora
    // (espelha a checagem do app/index.tsx, mas continua valendo dentro das tabs).
    if (!isLoadingRole && isTrainer && subscriptionStatus !== "active" && subscriptionStatus !== "trialing") {
        return <Redirect href="/trainer-subscription-blocked" />;
    }

    if (!isTablet) return tabContent;

    return (
        <View style={{ flexDirection: "row", flex: 1 }}>
            <NavigationSidebar
                expanded={isLandscape}
                tabs={TRAINER_TABS}
                activeTab={activeTab}
                onTabPress={handleTabPress}
            />
            <View style={{ flex: 1 }}>{tabContent}</View>
        </View>
    );
}
