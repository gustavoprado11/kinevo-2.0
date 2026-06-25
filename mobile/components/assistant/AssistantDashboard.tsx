/**
 * AssistantDashboard — Home no modo Assistente (Frame 1 do design).
 *
 * Reaproveita os dados do useTrainerDashboard (mesmas pendências/stats do
 * dashboard clássico), reapresentados no layout do Assistente: header com
 * saudação, toggle Clássico/Assistente, seção "Precisa da sua atenção",
 * "Esta semana" e uma barra de composição fixa que abre o chat.
 *
 * Phase 1: apresentacional. A composição abre /assistant (chat). Wiring de
 * backend (envio real, créditos, Pro+) entra na Fase 2.
 */
import React from 'react';
import { View, Text, ScrollView, RefreshControl, Pressable } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, FadeInUp, Easing } from 'react-native-reanimated';
import {
    AlertTriangle,
    CreditCard,
    CalendarClock,
    ChevronRight,
} from 'lucide-react-native';
import { v2 } from '@kinevo/shared/tokens';
import { useV2Colors } from '../../hooks/useV2Colors';
import { useRoleMode } from '../../contexts/RoleModeContext';
import { useTrainerDashboard } from '../../hooks/useTrainerDashboard';
import { useAssistantMode } from '../../hooks/useAssistantMode';
import { AssistantModeToggle } from './AssistantModeToggle';
import { AssistantComposer } from './AssistantComposer';
import { HOME_SUGGESTIONS, optimizePrompt } from '../../lib/assistantPrompts';

const { spacing, radius, typography } = v2;

const NAV_CLEARANCE = 80; // BottomNav (64) + offset (8) + folga (8)

const SUGGESTION_LABELS = HOME_SUGGESTIONS.map((s) => s.label);

function getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
}

function formatDate(): string {
    const raw = new Date().toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
    });
    return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function formatCurrency(value: number): string {
    return `R$ ${value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
}

interface AttentionCardData {
    key: string;
    title: string;
    subtitle: string;
    icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
    tint: string;
    onPress: () => void;
}

export function AssistantDashboard() {
    const colors = useV2Colors();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { trainerProfile } = useRoleMode();
    const { stats, pendingActions, isRefreshing, refresh } = useTrainerDashboard();
    const { setMode } = useAssistantMode();

    const firstName = trainerProfile?.name?.split(' ')[0] || 'Treinador';
    const initial = firstName.charAt(0).toUpperCase();

    const openChat = (initialMessage?: string) => {
        router.push({
            pathname: '/assistant',
            params: initialMessage ? { q: initialMessage } : {},
        } as never);
    };

    // ── Monta os cards de atenção a partir das pendências reais ──
    const attention: AttentionCardData[] = [];
    if (pendingActions) {
        const { inactiveStudents, pendingFinancial, expiringPrograms } = pendingActions;

        if (inactiveStudents.length > 0) {
            const names = inactiveStudents.slice(0, 3).map((s) => s.name.split(' ')[0]).join(', ');
            attention.push({
                key: 'inactive',
                title: `${inactiveStudents.length} ${inactiveStudents.length === 1 ? 'aluno sem treino' : 'alunos sem treino'}`,
                subtitle: names,
                icon: AlertTriangle,
                tint: colors.semantic.danger.default,
                onPress: () => {
                    if (inactiveStudents.length === 1) {
                        router.push({ pathname: '/student/[id]', params: { id: inactiveStudents[0].id } } as never);
                    } else {
                        openChat('Quais alunos estão sem treino e o que fazer?');
                    }
                },
            });
        }
        if (pendingFinancial.length > 0) {
            attention.push({
                key: 'financial',
                title: `${pendingFinancial.length} ${pendingFinancial.length === 1 ? 'cobrança pendente' : 'cobranças pendentes'}`,
                subtitle: pendingFinancial.slice(0, 3).map((p) => p.student_name.split(' ')[0]).join(', '),
                icon: CreditCard,
                tint: colors.semantic.warning.default,
                onPress: () => router.push('/financial' as never),
            });
        }
        if (expiringPrograms.length > 0) {
            const first = expiringPrograms[0];
            attention.push({
                key: 'expiring',
                title: expiringPrograms.length === 1 ? 'Programa vencendo' : `${expiringPrograms.length} programas vencendo`,
                subtitle:
                    expiringPrograms.length === 1
                        ? `${first.student_name} · em ${first.ends_in_days} dia${first.ends_in_days === 1 ? '' : 's'}`
                        : `${first.student_name.split(' ')[0]} e mais ${expiringPrograms.length - 1}`,
                icon: CalendarClock,
                tint: colors.purple[600],
                onPress: () =>
                    router.push({ pathname: '/student/[id]', params: { id: first.student_id } } as never),
            });
        }
    }
    const attentionCount = pendingActions
        ? pendingActions.inactiveStudents.length +
          pendingActions.pendingFinancial.length +
          pendingActions.expiringPrograms.length
        : 0;

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.canvas }} edges={['top']}>
            {/* Header */}
            <Animated.View
                entering={FadeIn.duration(400)}
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing[3],
                    paddingHorizontal: spacing[5],
                    paddingTop: spacing[2],
                    marginBottom: spacing[4],
                }}
            >
                <View style={{ flex: 1 }}>
                    <Text
                        style={{
                            fontFamily: 'PlusJakartaSans_500Medium',
                            fontSize: typography.bodySm.size,
                            color: colors.text.tertiary,
                        }}
                    >
                        {formatDate()}
                    </Text>
                    <Text
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        style={{
                            fontFamily: 'PlusJakartaSans_700Bold',
                            fontSize: 25,
                            lineHeight: 30,
                            letterSpacing: -0.6,
                            color: colors.text.primary,
                            marginTop: 2,
                        }}
                    >
                        {getGreeting()}, {firstName}
                    </Text>
                </View>
                <View
                    style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        backgroundColor: colors.text.primary,
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: '#FFFFFF' }}>
                        {initial}
                    </Text>
                </View>
            </Animated.View>

            {/* Mode toggle */}
            <View style={{ paddingHorizontal: spacing[5], marginBottom: spacing[4] }}>
                <AssistantModeToggle mode="assistant" onChange={setMode} />
            </View>

            {/* Scrollable content */}
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: spacing[5], paddingBottom: spacing[4] }}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor={colors.purple[600]} />
                }
            >
                {/* Precisa da sua atenção */}
                <Animated.View entering={FadeInUp.delay(40).duration(300).easing(Easing.out(Easing.cubic))}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[3] }}>
                        <Text
                            style={{
                                fontFamily: 'PlusJakartaSans_700Bold',
                                fontSize: 11.5,
                                letterSpacing: 1.2,
                                textTransform: 'uppercase',
                                color: colors.text.tertiary,
                            }}
                        >
                            Precisa da sua atenção
                        </Text>
                        {attentionCount > 0 ? (
                            <View
                                style={{
                                    backgroundColor: colors.semantic.danger.bg,
                                    borderRadius: 7,
                                    paddingHorizontal: 8,
                                    paddingVertical: 2,
                                }}
                            >
                                <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 10, color: colors.semantic.danger.fg }}>
                                    {attentionCount}
                                </Text>
                            </View>
                        ) : null}
                        <Text
                            style={{
                                marginLeft: 'auto',
                                fontFamily: 'PlusJakartaSans_500Medium',
                                fontSize: 11.5,
                                color: colors.text.quaternary,
                            }}
                        >
                            atualizado agora
                        </Text>
                    </View>

                    {attention.length > 0 ? (
                        <View style={{ gap: spacing[3] }}>
                            {attention.map((a) => (
                                <AttentionCard key={a.key} data={a} />
                            ))}
                        </View>
                    ) : (
                        <View
                            style={{
                                backgroundColor: colors.surface.card,
                                borderRadius: radius.lg,
                                padding: spacing[4],
                                borderWidth: 1,
                                borderColor: colors.border.default,
                            }}
                        >
                            <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13, color: colors.text.tertiary }}>
                                Tudo em dia. Nenhuma pendência. ✓
                            </Text>
                        </View>
                    )}
                </Animated.View>

                {/* Esta semana */}
                {stats ? (
                    <Animated.View
                        entering={FadeInUp.delay(100).duration(300).easing(Easing.out(Easing.cubic))}
                        style={{ marginTop: spacing[5] }}
                    >
                        <Text
                            style={{
                                fontFamily: 'PlusJakartaSans_700Bold',
                                fontSize: 11.5,
                                letterSpacing: 1.2,
                                textTransform: 'uppercase',
                                color: colors.text.tertiary,
                                marginBottom: spacing[3],
                            }}
                        >
                            Esta semana
                        </Text>
                        <View style={{ flexDirection: 'row', gap: spacing[3] }}>
                            <MiniStat
                                label="Aderência"
                                value={`${stats.adherencePercent}%`}
                                valueColor={
                                    stats.adherencePercent >= 70
                                        ? colors.text.primary
                                        : colors.semantic.warning.fg
                                }
                            />
                            <MiniStat label="Receita · mês" value={formatCurrency(stats.mrr)} valueColor={colors.text.primary} />
                        </View>
                    </Animated.View>
                ) : null}
            </ScrollView>

            {/* Composer fixo acima da BottomNav */}
            <View
                style={{
                    paddingHorizontal: spacing[4],
                    paddingTop: spacing[2],
                    paddingBottom: insets.bottom + NAV_CLEARANCE,
                }}
            >
                <AssistantComposer
                    suggestions={SUGGESTION_LABELS}
                    onSuggestionPress={(label) => openChat(optimizePrompt(label))}
                    onPress={() => openChat()}
                    onPressMic={() => openChat()}
                />
            </View>
        </SafeAreaView>
    );
}

function AttentionCard({ data }: { data: AttentionCardData }) {
    const colors = useV2Colors();
    return (
        <Pressable
            onPress={data.onPress}
            accessibilityRole="button"
            accessibilityLabel={`${data.title}. ${data.subtitle}`}
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing[3],
                backgroundColor: colors.surface.card,
                borderRadius: radius.lg,
                padding: spacing[4],
                borderWidth: 1,
                borderColor: colors.border.default,
            }}
        >
            <View
                style={{
                    width: 42,
                    height: 42,
                    borderRadius: 13,
                    backgroundColor: data.tint + '1A',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <data.icon size={19} color={data.tint} strokeWidth={1.9} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                    style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14.5, color: colors.text.primary }}
                    numberOfLines={1}
                >
                    {data.title}
                </Text>
                {data.subtitle ? (
                    <Text
                        style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12.5, color: colors.text.tertiary, marginTop: 1 }}
                        numberOfLines={1}
                    >
                        {data.subtitle}
                    </Text>
                ) : null}
            </View>
            <ChevronRight size={18} color={colors.text.quaternary} strokeWidth={2} />
        </Pressable>
    );
}

function MiniStat({ label, value, valueColor }: { label: string; value: string; valueColor: string }) {
    const colors = useV2Colors();
    return (
        <View
            style={{
                flex: 1,
                backgroundColor: colors.surface.card,
                borderRadius: radius.lg,
                padding: spacing[4],
                borderWidth: 1,
                borderColor: colors.border.default,
            }}
        >
            <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11, color: colors.text.tertiary }}>
                {label}
            </Text>
            <Text
                style={{
                    fontFamily: 'PlusJakartaSans_800ExtraBold',
                    fontSize: 24,
                    letterSpacing: -0.5,
                    color: valueColor,
                    marginTop: 6,
                }}
                numberOfLines={1}
                adjustsFontSizeToFit
            >
                {value}
            </Text>
        </View>
    );
}
