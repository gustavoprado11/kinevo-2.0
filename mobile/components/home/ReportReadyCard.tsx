import React from "react";
import { View, Text } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInUp, Easing } from "react-native-reanimated";
import { Award, ChevronRight, Sparkles } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { PressableScale } from "../shared/PressableScale";

// ============================================================================
// ReportReadyCard
// ============================================================================
// Card de destaque no home do aluno quando há um relatório publicado não lido.
// Momento bom na jornada — tom celebrativo mas sem exagerar no "🎉".
//
// UX:
// - Toque → chama onPress que navega pra /report/[id] + marca como completed.
// - Som: Haptic medium (mais "weighty" que um toque normal).
// - Some do home assim que o aluno abre (o hook pai controla o estado).
// ============================================================================

interface ReportReadyCardProps {
    programName: string;
    onPress: () => void;
}

export function ReportReadyCard({ programName, onPress }: ReportReadyCardProps) {
    const handlePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress();
    };

    return (
        <Animated.View
            entering={FadeInUp.duration(400).easing(Easing.out(Easing.cubic))}
            style={{ marginBottom: 16 }}
        >
            <PressableScale onPress={handlePress} pressScale={0.98}>
                <LinearGradient
                    colors={["#f59e0b", "#d97706"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                        borderRadius: 20,
                        padding: 18,
                        shadowColor: "#d97706",
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.2,
                        shadowRadius: 12,
                        elevation: 4,
                    }}
                >
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                        {/* Icon with soft halo */}
                        <View
                            style={{
                                width: 48,
                                height: 48,
                                borderRadius: 14,
                                backgroundColor: "rgba(255, 255, 255, 0.22)",
                                alignItems: "center",
                                justifyContent: "center",
                                marginRight: 14,
                            }}
                        >
                            <Award size={24} color="#ffffff" strokeWidth={2.2} />
                        </View>

                        <View style={{ flex: 1 }}>
                            {/* Little eyebrow line with sparkle */}
                            <View
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 5,
                                    marginBottom: 2,
                                }}
                            >
                                <Sparkles size={11} color="#fef3c7" />
                                <Text
                                    style={{
                                        color: "#fef3c7",
                                        fontSize: 10,
                                        fontWeight: "700",
                                        letterSpacing: 1.5,
                                        textTransform: "uppercase",
                                    }}
                                >
                                    Relatório pronto
                                </Text>
                            </View>
                            <Text
                                style={{
                                    color: "#ffffff",
                                    fontSize: 16,
                                    fontWeight: "700",
                                    marginTop: 1,
                                }}
                                numberOfLines={1}
                            >
                                Parabéns, seu programa chegou ao fim!
                            </Text>
                            <Text
                                style={{
                                    color: "rgba(255, 255, 255, 0.9)",
                                    fontSize: 13,
                                    marginTop: 3,
                                    lineHeight: 18,
                                }}
                                numberOfLines={2}
                            >
                                {`Veja como foi "${programName}" — seu relatório tá disponível.`}
                            </Text>
                        </View>

                        <ChevronRight size={22} color="#ffffff" />
                    </View>
                </LinearGradient>
            </PressableScale>
        </Animated.View>
    );
}
