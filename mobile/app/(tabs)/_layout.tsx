import React, { useRef, useEffect, useCallback } from "react";
import { Tabs, usePathname, useRouter } from "expo-router";
import { Home, User, Clock, MessageCircle } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, View, Text, Platform } from "react-native";
import { BlurView } from "expo-blur";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSequence,
    withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useUnreadCount } from "../../hooks/useUnreadCount";
import { useResponsive } from "../../hooks/useResponsive";
import { NavigationSidebar, TabConfig } from "../../components/shared/NavigationSidebar";
import { ANIM } from "../../lib/animations";

// ─── Animated Tab Icon ───
function AnimatedTabIcon({
    IconComponent,
    color,
    focused,
    badge,
}: {
    IconComponent: typeof Home;
    color: string;
    focused: boolean;
    badge?: number;
}) {
    const scale = useSharedValue(1);
    const prevFocused = useRef(focused);

    useEffect(() => {
        if (focused && !prevFocused.current) {
            scale.value = withSequence(
                withTiming(1.08, { duration: 200, easing: ANIM.timing.fast.easing }),
                withTiming(1, ANIM.timing.fast)
            );
            Haptics.selectionAsync();
        }
        prevFocused.current = focused;
    }, [focused]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    return (
        <Animated.View style={[animatedStyle, { alignItems: 'center', justifyContent: 'center' }]}>
            <View>
                <IconComponent
                    size={22}
                    color={color}
                    strokeWidth={focused ? 2.5 : 1.5}
                />
                {!!badge && badge > 0 && (
                    <View
                        style={{
                            position: "absolute",
                            top: -6,
                            right: -10,
                            minWidth: 16,
                            height: 16,
                            borderRadius: 8,
                            backgroundColor: "#ef4444",
                            alignItems: "center",
                            justifyContent: "center",
                            paddingHorizontal: 4,
                        }}
                    >
                        <Text style={{ fontSize: 10, fontWeight: "700", color: "#ffffff" }}>
                            {badge > 99 ? "99+" : badge}
                        </Text>
                    </View>
                )}
            </View>
            {focused && (
                <View
                    style={{
                        width: 4,
                        height: 4,
                        borderRadius: 2,
                        backgroundColor: color,
                        marginTop: 4,
                    }}
                />
            )}
        </Animated.View>
    );
}

export default function TabsLayout() {
    const insets = useSafeAreaInsets();
    const { total: unreadCount } = useUnreadCount();
    const { isTablet, isLandscape } = useResponsive();
    const router = useRouter();
    const pathname = usePathname();

    const STUDENT_TABS: TabConfig[] = [
        { key: 'home', label: 'Início', icon: Home },
        { key: 'inbox', label: 'Mensagens', icon: MessageCircle, badge: unreadCount },
        { key: 'logs', label: 'Histórico', icon: Clock },
        { key: 'profile', label: 'Perfil', icon: User },
    ];

    const activeTab = STUDENT_TABS.find(t => pathname.includes(t.key))?.key ?? 'home';

    const handleTabPress = useCallback((tabKey: string) => {
        router.navigate(`/(tabs)/${tabKey}` as any);
    }, [router]);

    const tabBarStyle = isTablet
        ? { display: 'none' as const }
        : {
            position: 'absolute' as const,
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: 'transparent',
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: 'rgba(0, 0, 0, 0.08)',
            elevation: 0,
            shadowOpacity: 0,
            height: 50 + insets.bottom,
            paddingBottom: insets.bottom,
        };

    const tabContent = (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarBackground: () =>
                    isTablet ? null : (
                        <BlurView
                            tint="light"
                            intensity={90}
                            style={[
                                StyleSheet.absoluteFill,
                                { backgroundColor: 'rgba(255, 255, 255, 0.78)' },
                            ]}
                        />
                    ),
                tabBarStyle,
                tabBarActiveTintColor: "#7c3aed",
                tabBarInactiveTintColor: "#94a3b8",
                tabBarShowLabel: false,
                tabBarItemStyle: {
                    height: 50,
                    paddingTop: 0,
                    paddingBottom: 0,
                },
            }}
        >
            <Tabs.Screen
                name="home"
                options={{
                    title: "Início",
                    tabBarIcon: ({ color, focused }) => (
                        <AnimatedTabIcon IconComponent={Home} color={color} focused={focused} />
                    ),
                }}
            />
            <Tabs.Screen
                name="inbox"
                options={{
                    title: "Mensagens",
                    tabBarIcon: ({ color, focused }) => (
                        <AnimatedTabIcon IconComponent={MessageCircle} color={color} focused={focused} badge={unreadCount} />
                    ),
                }}
            />
            <Tabs.Screen
                name="logs"
                options={{
                    title: "Histórico",
                    tabBarIcon: ({ color, focused }) => (
                        <AnimatedTabIcon IconComponent={Clock} color={color} focused={focused} />
                    ),
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: "Perfil",
                    tabBarIcon: ({ color, focused }) => (
                        <AnimatedTabIcon IconComponent={User} color={color} focused={focused} />
                    ),
                }}
            />
        </Tabs>
    );

    if (!isTablet) return tabContent;

    return (
        <View style={{ flexDirection: 'row', flex: 1 }}>
            <NavigationSidebar
                expanded={isLandscape}
                tabs={STUDENT_TABS}
                activeTab={activeTab}
                onTabPress={handleTabPress}
            />
            <View style={{ flex: 1 }}>
                {tabContent}
            </View>
        </View>
    );
}
