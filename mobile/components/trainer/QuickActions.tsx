import React from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { DollarSign, Dumbbell } from "lucide-react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { colors } from "@/theme";

interface QuickAction {
    key: string;
    label: string;
    subtitle: string;
    icon: React.ComponentType<any>;
    iconColor: string;
    iconBg: string;
    route: string;
}

const ACTIONS: QuickAction[] = [
    {
        key: "financial",
        label: "Financeiro",
        subtitle: "Receita e contratos",
        icon: DollarSign,
        iconColor: "#0ea5e9",
        iconBg: "#f0f9ff",
        route: "/financial",
    },
    {
        key: "exercises",
        label: "Exercícios",
        subtitle: "Biblioteca e vídeos",
        icon: Dumbbell,
        iconColor: "#f59e0b",
        iconBg: "#fffbeb",
        route: "/exercises",
    },
];

export function QuickActions() {
    const router = useRouter();

    return (
        <View>
            <Text
                style={{
                    fontSize: 11,
                    fontWeight: "700",
                    color: colors.text.tertiary,
                    letterSpacing: 2,
                    textTransform: "uppercase",
                    marginBottom: 10,
                    paddingLeft: 1,
                }}
            >
                Acesso rápido
            </Text>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 10 }}
            >
                {ACTIONS.map((action) => {
                    const Icon = action.icon;
                    return (
                        <TouchableOpacity
                            key={action.key}
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                router.push(action.route as any);
                            }}
                            activeOpacity={0.7}
                            accessibilityRole="button"
                            accessibilityLabel={action.label}
                            style={{
                                backgroundColor: colors.background.card,
                                borderRadius: 14,
                                padding: 14,
                                width: 140,
                                borderWidth: 1,
                                borderColor: colors.border.primary,
                            }}
                        >
                            <View
                                style={{
                                    width: 38,
                                    height: 38,
                                    borderRadius: 10,
                                    backgroundColor: action.iconBg,
                                    alignItems: "center",
                                    justifyContent: "center",
                                    marginBottom: 10,
                                }}
                            >
                                <Icon size={18} color={action.iconColor} />
                            </View>
                            <Text
                                style={{
                                    fontSize: 14,
                                    fontWeight: "700",
                                    color: colors.text.primary,
                                }}
                                numberOfLines={1}
                            >
                                {action.label}
                            </Text>
                            <Text
                                style={{
                                    fontSize: 11,
                                    color: colors.text.tertiary,
                                    marginTop: 2,
                                }}
                                numberOfLines={1}
                            >
                                {action.subtitle}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
        </View>
    );
}
