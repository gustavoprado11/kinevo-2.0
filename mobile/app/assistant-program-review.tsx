/**
 * app/assistant-program-review — revisar / aprovar programa gerado (Frame 3).
 *
 * Fase 1: apresentacional, com programa de demonstração (DEMO_PROGRAM). O botão
 * "Aprovar e atribuir" ainda não persiste — o wiring (assign / draft no perfil
 * do aluno) entra na Fase 2.
 */
import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, Pencil, Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { v2 } from '@kinevo/shared/tokens';
import { useV2Colors } from '../hooks/useV2Colors';
import { ProgramReviewCard, DEMO_PROGRAM } from '../components/assistant/ProgramReviewCard';

const { spacing, radius } = v2;

export default function AssistantProgramReviewScreen() {
    const colors = useV2Colors();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.canvas }} edges={['top']}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Nav header */}
            <View
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing[3],
                    paddingHorizontal: spacing[4],
                    paddingVertical: spacing[2],
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border.subtle,
                }}
            >
                <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Voltar" hitSlop={10}>
                    <ChevronLeft size={24} color={colors.text.secondary} strokeWidth={1.9} />
                </Pressable>
                <Text style={{ flex: 1, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: colors.text.primary }}>
                    Programa para {DEMO_PROGRAM.studentName.split(' ')[0]}
                </Text>
            </View>

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: spacing[4] }}
                showsVerticalScrollIndicator={false}
            >
                <ProgramReviewCard program={DEMO_PROGRAM} />
            </ScrollView>

            {/* Approve bar */}
            <View
                style={{
                    flexDirection: 'row',
                    gap: spacing[3],
                    paddingHorizontal: spacing[4],
                    paddingTop: spacing[3],
                    paddingBottom: insets.bottom + spacing[2],
                    borderTopWidth: 1,
                    borderTopColor: colors.border.subtle,
                }}
            >
                <Pressable
                    onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
                    accessibilityRole="button"
                    accessibilityLabel="Editar programa"
                    style={{
                        width: 52,
                        height: 50,
                        borderWidth: 1,
                        borderColor: colors.border.default,
                        backgroundColor: colors.surface.card,
                        borderRadius: radius.md,
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <Pencil size={19} color={colors.text.secondary} strokeWidth={1.8} />
                </Pressable>
                <Pressable
                    onPress={() => {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        router.back();
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Aprovar e atribuir programa"
                    style={{ flex: 1, borderRadius: radius.md, overflow: 'hidden' }}
                >
                    <LinearGradient
                        colors={[colors.purple[500], colors.purple[700]]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2], paddingVertical: 14 }}
                    >
                        <Check size={16} color="#FFFFFF" strokeWidth={2.3} />
                        <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: '#FFFFFF' }}>
                            Aprovar e atribuir
                        </Text>
                    </LinearGradient>
                </Pressable>
            </View>
        </SafeAreaView>
    );
}
