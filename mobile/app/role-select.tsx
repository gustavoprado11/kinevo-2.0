import React, { useCallback } from "react";
import { View, Text, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Dumbbell, Users } from "lucide-react-native";
import Animated, { FadeInUp, FadeIn } from "react-native-reanimated";
import { useRoleMode } from "../contexts/RoleModeContext";
import { PressableScale } from "../components/shared/PressableScale";

export default function RoleSelectScreen() {
    const { switchToStudent, switchToTrainer, subscriptionStatus } = useRoleMode();
    const router = useRouter();

    const handleStudent = useCallback(() => {
        switchToStudent();
        router.replace("/(tabs)/home");
    }, [switchToStudent, router]);

    const handleTrainer = useCallback(() => {
        switchToTrainer();
        if (subscriptionStatus !== "active" && subscriptionStatus !== "trialing") {
            router.replace("/trainer-subscription-blocked");
        } else {
            router.replace("/(trainer-tabs)/dashboard");
        }
    }, [switchToTrainer, subscriptionStatus, router]);

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: "#F2F2F7" }}>
            <StatusBar barStyle="dark-content" />
            <View style={{ flex: 1, paddingHorizontal: 24, justifyContent: "center" }}>
                {/* Header */}
                <Animated.View entering={FadeIn.duration(500)} style={{ marginBottom: 40, alignItems: "center" }}>
                    <Text style={{ fontSize: 28, fontWeight: "800", color: "#0f172a", textAlign: "center" }}>
                        Como deseja usar{"\n"}o Kinevo?
                    </Text>
                    <Text style={{ fontSize: 14, color: "#64748b", marginTop: 8, textAlign: "center" }}>
                        Você pode alternar entre os modos a qualquer momento.
                    </Text>
                </Animated.View>

                {/* Student Card */}
                <Animated.View entering={FadeInUp.delay(100).duration(400)}>
                    <PressableScale
                        onPress={handleStudent}
                        pressScale={0.97}
                        style={{
                            backgroundColor: "#ffffff",
                            borderRadius: 20,
                            padding: 24,
                            marginBottom: 16,
                            borderWidth: 1,
                            borderColor: "rgba(0,0,0,0.04)",
                            shadowColor: "#000",
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.06,
                            shadowRadius: 12,
                            elevation: 3,
                        }}
                    >
                        <View style={{ flexDirection: "row", alignItems: "center" }}>
                            <View
                                style={{
                                    width: 52,
                                    height: 52,
                                    borderRadius: 16,
                                    backgroundColor: "#f0fdf4",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    marginRight: 16,
                                }}
                            >
                                <Dumbbell size={24} color="#16a34a" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 17, fontWeight: "700", color: "#0f172a" }}>
                                    Modo Aluno
                                </Text>
                                <Text style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
                                    Acessar meus treinos e acompanhar meu progresso
                                </Text>
                            </View>
                        </View>
                    </PressableScale>
                </Animated.View>

                {/* Trainer Card */}
                <Animated.View entering={FadeInUp.delay(200).duration(400)}>
                    <PressableScale
                        onPress={handleTrainer}
                        pressScale={0.97}
                        style={{
                            backgroundColor: "#ffffff",
                            borderRadius: 20,
                            padding: 24,
                            borderWidth: 1,
                            borderColor: "rgba(0,0,0,0.04)",
                            shadowColor: "#000",
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.06,
                            shadowRadius: 12,
                            elevation: 3,
                        }}
                    >
                        <View style={{ flexDirection: "row", alignItems: "center" }}>
                            <View
                                style={{
                                    width: 52,
                                    height: 52,
                                    borderRadius: 16,
                                    backgroundColor: "#f5f3ff",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    marginRight: 16,
                                }}
                            >
                                <Users size={24} color="#7c3aed" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 17, fontWeight: "700", color: "#0f172a" }}>
                                    Modo Treinador
                                </Text>
                                <Text style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
                                    Gerenciar alunos e acompanhar treinos
                                </Text>
                            </View>
                        </View>
                    </PressableScale>
                </Animated.View>
            </View>
        </SafeAreaView>
    );
}
