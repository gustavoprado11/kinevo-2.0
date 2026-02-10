import { Tabs } from "expo-router";
import { View } from "react-native";
import { Home, User, Clock } from "lucide-react-native";

export default function TabsLayout() {
    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: "#0D0D17", // kinevo-background
                    borderTopWidth: 0,
                    elevation: 0,
                    height: 60,
                    paddingBottom: 10,
                    paddingTop: 10,
                },
                tabBarActiveTintColor: "#8b5cf6", // violet-500 (vibrant purple)
                tabBarInactiveTintColor: "#475569", // slate-600 (darker slate)
                tabBarShowLabel: false,
            }}
        >
            <Tabs.Screen
                name="home"
                options={{
                    title: "Início",
                    tabBarIcon: ({ color, size, focused }) => (
                        <Home size={24} color={color} strokeWidth={focused ? 2.5 : 1.5} />
                    ),
                }}
            />
            <Tabs.Screen
                name="logs"
                options={{
                    title: "Histórico",
                    tabBarIcon: ({ color, focused }) => (
                        <Clock size={24} color={color} strokeWidth={focused ? 2.5 : 1.5} />
                    ),
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: "Perfil",
                    tabBarIcon: ({ color, size, focused }) => (
                        <User size={24} color={color} strokeWidth={focused ? 2.5 : 1.5} />
                    ),
                }}
            />
        </Tabs>
    );
}
