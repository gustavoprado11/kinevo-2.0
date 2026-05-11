import React, { useCallback } from "react";
import { Tabs, usePathname, useRouter } from "expo-router";
import { Home, MessageCircle, Clock, User } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useUnreadCount } from "../../hooks/useUnreadCount";
import { useResponsive } from "../../hooks/useResponsive";
import { NavigationSidebar, TabConfig } from "../../components/shared/NavigationSidebar";
import { BottomNav } from "../../components/v2";
import { v2 } from "@kinevo/shared/tokens";

const { spacing } = v2;

export default function TabsLayout() {
    const insets = useSafeAreaInsets();
    const { total: unreadCount } = useUnreadCount();
    const { isTablet, isLandscape } = useResponsive();
    const router = useRouter();
    const pathname = usePathname();

    const STUDENT_TABS: TabConfig[] = [
        { key: "home", label: "Início", icon: Home },
        { key: "inbox", label: "Mensagens", icon: MessageCircle, badge: unreadCount },
        { key: "logs", label: "Histórico", icon: Clock },
        { key: "profile", label: "Perfil", icon: User },
    ];

    const activeTab = STUDENT_TABS.find((t) => pathname.includes(t.key))?.key ?? "home";

    const handleTabPress = useCallback(
        (tabKey: string) => {
            router.navigate(`/(tabs)/${tabKey}` as never);
        },
        [router],
    );

    const renderBottomNav = useCallback(
        (props: BottomTabBarProps) => {
            if (isTablet) return null;

            const tabsForNav = props.state.routes
                .map((route) => {
                    const cfg = STUDENT_TABS.find((t) => t.key === route.name);
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

            const activeKey = props.state.routes[props.state.index]?.name ?? "home";

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
                        accessibilityLabel="Navegação principal do aluno"
                    />
                </View>
            );
        },
        [insets.bottom, isTablet, unreadCount],
    );

    const tabContent = (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: { display: "none" },
            }}
            tabBar={renderBottomNav}
        >
            <Tabs.Screen name="home" options={{ title: "Início" }} />
            <Tabs.Screen name="inbox" options={{ title: "Mensagens" }} />
            <Tabs.Screen name="logs" options={{ title: "Histórico" }} />
            <Tabs.Screen name="profile" options={{ title: "Perfil" }} />
        </Tabs>
    );

    if (!isTablet) return tabContent;

    return (
        <View style={{ flexDirection: "row", flex: 1 }}>
            <NavigationSidebar
                expanded={isLandscape}
                tabs={STUDENT_TABS}
                activeTab={activeTab}
                onTabPress={handleTabPress}
            />
            <View style={{ flex: 1 }}>{tabContent}</View>
        </View>
    );
}
