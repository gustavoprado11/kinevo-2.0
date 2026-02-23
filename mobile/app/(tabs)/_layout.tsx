import React, { useRef, useEffect } from "react";
import { Tabs } from "expo-router";
import { Home, User, Clock, Inbox } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, View, Platform } from "react-native";
import { BlurView } from "expo-blur";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withSequence,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

// ─── Animated Tab Icon with Bounce ───
function AnimatedTabIcon({
    IconComponent,
    color,
    focused,
}: {
    IconComponent: typeof Home;
    color: string;
    focused: boolean;
}) {
    const scale = useSharedValue(1);
    const prevFocused = useRef(focused);

    useEffect(() => {
        if (focused && !prevFocused.current) {
            scale.value = withSequence(
                withSpring(1.25, { damping: 8, stiffness: 250, mass: 0.5 }),
                withSpring(1, { damping: 12, stiffness: 200, mass: 0.6 })
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
            <IconComponent
                size={22}
                color={color}
                strokeWidth={focused ? 2.5 : 1.5}
            />
            {/* Active indicator dot */}
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

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarBackground: () => (
                    <BlurView
                        tint="light"
                        intensity={90}
                        style={[
                            StyleSheet.absoluteFill,
                            { backgroundColor: 'rgba(255, 255, 255, 0.78)' },
                        ]}
                    />
                ),
                tabBarStyle: {
                    position: 'absolute',
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
                },
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
                    title: "Inbox",
                    tabBarIcon: ({ color, focused }) => (
                        <AnimatedTabIcon IconComponent={Inbox} color={color} focused={focused} />
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
}
