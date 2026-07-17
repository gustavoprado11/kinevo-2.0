/**
 * AssistantDashboard — Home no modo Assistente (Frame 1 do design).
 *
 * "Precisa da sua atenção" combina os INSIGHTS de IA (assistant_insights — os
 * mesmos da home web: Estagnado / Pronto p/ evoluir / Nota, que abrem o chat já
 * ESCOPADO ao aluno com um prompt otimizado) com as pendências operacionais do
 * dashboard (cobranças, programas vencendo). Header mostra o medidor de
 * créditos; "Conversas recentes" reabre threads direto no chat.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, Pressable, Keyboard, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import Animated, { FadeIn, FadeInUp, Easing } from 'react-native-reanimated';
import {
    AlertTriangle,
    CreditCard,
    CalendarClock,
    ChevronRight,
    TrendingUp,
    TrendingDown,
    FileText,
    MessagesSquare,
} from 'lucide-react-native';
import { v2 } from '@kinevo/shared/tokens';
import { useV2Colors } from '../../hooks/useV2Colors';
import { useRoleMode } from '../../contexts/RoleModeContext';
import { useTrainerDashboard } from '../../hooks/useTrainerDashboard';
import { useAssistantMode } from '../../hooks/useAssistantMode';
import { useAssistantInsights } from '../../hooks/useAssistantInsights';
import { useAssistantAccess } from '../../hooks/useAssistantAccess';
import { useAssistantConversations } from '../../hooks/useAssistantConversations';
import { useVoiceInput } from '../../hooks/useVoiceInput';
import { AssistantModeToggle } from './AssistantModeToggle';
import { AssistantComposer } from './AssistantComposer';
import { CreditMeter } from './CreditMeter';
import {
    HOME_SUGGESTIONS,
    optimizePrompt,
    attentionKind,
    attentionPrompt,
    ATTENTION_KIND_LABEL,
    type AttentionKind,
} from '../../lib/assistantPrompts';
import { Avatar } from '../v2';

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
    const { insights, refresh: refreshInsights } = useAssistantInsights();
    const { summary, refresh: refreshAccess } = useAssistantAccess();
    const { items: recentConversations, refresh: refreshConversations } = useAssistantConversations();

    // Re-busca ao (re)ganhar foco — um turno de chat muda créditos, insights e
    // conversas; sem isso a home volta stale do /assistant.
    useFocusEffect(
        useCallback(() => {
            void refreshConversations();
            void refreshInsights();
            void refreshAccess();
        }, [refreshConversations, refreshInsights, refreshAccess]),
    );

    const firstName = trainerProfile?.name?.split(' ')[0] || 'Treinador';

    const openChat = (
        initialMessage?: string,
        scope?: { studentId: string; studentName: string },
        opts?: { autoSend?: boolean },
    ) => {
        router.push({
            pathname: '/assistant',
            params: {
                ...(initialMessage ? { q: initialMessage } : {}),
                // send=1 → o chat ENVIA o q na chegada (composer real do dashboard:
                // quem digitou e apertou enviar não deve ter que enviar de novo).
                // Sem o flag, q só pré-preenche (chips de sugestão — usuário revisa).
                ...(opts?.autoSend ? { send: '1' } : {}),
                ...(scope ? { studentId: scope.studentId, studentName: scope.studentName } : {}),
            },
        } as never);
    };

    // Composer REAL na home (antes era um Pressable que só navegava — o campo
    // prometia digitação e entregava um botão). Digita-se aqui; o envio navega
    // pro chat com o turno já disparado. Rascunho sobrevive a idas e vindas.
    const [draft, setDraft] = useState('');
    // Ditado in-place (mesmo padrão do chat): transcript parcial/final vira draft.
    const voice = useVoiceInput((t) => setDraft(t));
    const sendDraft = () => {
        const text = draft.trim();
        if (!text) return;
        if (voice.isListening) voice.toggle();
        setDraft('');
        Keyboard.dismiss();
        openChat(text, undefined, { autoSend: true });
    };

    // Teclado aberto → colapsa a folga da BottomNav (ela fica atrás do teclado;
    // sem isso o composer flutua com um vão gigante). Mesmo padrão do assistant.tsx.
    const [keyboardVisible, setKeyboardVisible] = useState(false);
    useEffect(() => {
        const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
        const s = Keyboard.addListener(showEvt, () => setKeyboardVisible(true));
        const h = Keyboard.addListener(hideEvt, () => setKeyboardVisible(false));
        return () => {
            s.remove();
            h.remove();
        };
    }, []);

    // ── Cards de atenção: INSIGHTS de IA primeiro (paridade com a home web),
    //    depois as pendências operacionais do dashboard ──
    const attention: AttentionCardData[] = [];
    const KIND_META: Record<AttentionKind, { icon: AttentionCardData['icon']; tint: string }> = {
        estagnado: { icon: TrendingDown, tint: colors.semantic.warning.default },
        pronto_para_evoluir: { icon: TrendingUp, tint: colors.semantic.success.default },
        nota: { icon: FileText, tint: colors.purple[600] },
    };
    for (const ins of insights) {
        const kind = attentionKind(ins);
        const meta = KIND_META[kind];
        attention.push({
            key: `insight-${ins.id}`,
            title: ins.studentName
                ? `${ins.studentName} · ${ATTENTION_KIND_LABEL[kind]}`
                : ins.title,
            subtitle: ins.studentName ? ins.title : ins.body,
            icon: meta.icon,
            tint: meta.tint,
            // Abre o chat JÁ ESCOPADO ao aluno, com o prompt otimizado do insight.
            onPress: () =>
                openChat(
                    attentionPrompt(ins),
                    ins.studentId && ins.studentName
                        ? { studentId: ins.studentId, studentName: ins.studentName }
                        : undefined,
                ),
        });
    }
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
    const attentionCount =
        insights.length +
        (pendingActions
            ? pendingActions.inactiveStudents.length +
              pendingActions.pendingFinancial.length +
              pendingActions.expiringPrograms.length
            : 0);

    const onRefreshAll = () => {
        refresh();
        void refreshInsights();
        void refreshConversations();
        void refreshAccess();
    };

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
                            fontFamily: 'MonaSans_500Medium',
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
                            fontFamily: 'MonaSans_700Bold',
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
                <CreditMeter summary={summary} />
                <Avatar
                    name={trainerProfile?.name || 'Treinador'}
                    src={trainerProfile?.avatar_url ?? undefined}
                    size="md"
                />
            </Animated.View>

            {/* Mode toggle */}
            <View style={{ paddingHorizontal: spacing[5], marginBottom: spacing[4] }}>
                <AssistantModeToggle mode="assistant" onChange={setMode} />
            </View>

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={0}
            >
            {/* Scrollable content */}
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: spacing[5], paddingBottom: spacing[4] }}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={isRefreshing} onRefresh={onRefreshAll} tintColor={colors.purple[600]} />
                }
            >
                {/* Precisa da sua atenção */}
                <Animated.View entering={FadeInUp.delay(40).duration(300).easing(Easing.out(Easing.cubic))}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[3] }}>
                        <Text
                            style={{
                                fontFamily: 'MonaSans_700Bold',
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
                                <Text style={{ fontFamily: 'MonaSans_700Bold', fontSize: 10, color: colors.semantic.danger.fg }}>
                                    {attentionCount}
                                </Text>
                            </View>
                        ) : null}
                        <Text
                            style={{
                                marginLeft: 'auto',
                                fontFamily: 'MonaSans_500Medium',
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
                            <Text style={{ fontFamily: 'MonaSans_500Medium', fontSize: 13, color: colors.text.tertiary }}>
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
                                fontFamily: 'MonaSans_700Bold',
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

                {/* Conversas recentes — reabrem direto no chat (param c) */}
                {recentConversations.length > 0 ? (
                    <Animated.View
                        entering={FadeInUp.delay(140).duration(300).easing(Easing.out(Easing.cubic))}
                        style={{ marginTop: spacing[5] }}
                    >
                        <Text
                            style={{
                                fontFamily: 'MonaSans_700Bold',
                                fontSize: 11.5,
                                letterSpacing: 1.2,
                                textTransform: 'uppercase',
                                color: colors.text.tertiary,
                                marginBottom: spacing[3],
                            }}
                        >
                            Conversas recentes
                        </Text>
                        <View style={{ gap: spacing[2] }}>
                            {recentConversations.slice(0, 3).map((conv) => (
                                <Pressable
                                    key={conv.id}
                                    onPress={() =>
                                        // Reabre preservando o escopo visual (header/placeholder do aluno).
                                        router.push({
                                            pathname: '/assistant',
                                            params: {
                                                c: conv.id,
                                                ...(conv.student_id && conv.studentName
                                                    ? { studentId: conv.student_id, studentName: conv.studentName }
                                                    : {}),
                                            },
                                        } as never)
                                    }
                                    accessibilityRole="button"
                                    accessibilityLabel={`Abrir conversa: ${conv.title}`}
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: spacing[3],
                                        backgroundColor: colors.surface.card,
                                        borderRadius: radius.lg,
                                        paddingVertical: spacing[3],
                                        paddingHorizontal: spacing[4],
                                        borderWidth: 1,
                                        borderColor: colors.border.default,
                                    }}
                                >
                                    <MessagesSquare size={16} color={colors.text.tertiary} strokeWidth={1.9} />
                                    <View style={{ flex: 1, minWidth: 0 }}>
                                        <Text
                                            numberOfLines={1}
                                            style={{ fontFamily: 'MonaSans_600SemiBold', fontSize: 13.5, color: colors.text.primary }}
                                        >
                                            {conv.title}
                                        </Text>
                                        {conv.studentName ? (
                                            <Text
                                                numberOfLines={1}
                                                style={{ fontFamily: 'MonaSans_500Medium', fontSize: 11.5, color: colors.text.tertiary, marginTop: 1 }}
                                            >
                                                {conv.studentName}
                                            </Text>
                                        ) : null}
                                    </View>
                                    <ChevronRight size={16} color={colors.text.quaternary} strokeWidth={2} />
                                </Pressable>
                            ))}
                        </View>
                    </Animated.View>
                ) : null}
            </ScrollView>

            {/* Composer fixo acima da BottomNav (real: digita aqui, envia → chat) */}
            <View
                style={{
                    paddingHorizontal: spacing[4],
                    paddingTop: spacing[2],
                    paddingBottom: keyboardVisible ? spacing[2] : insets.bottom + NAV_CLEARANCE,
                }}
            >
                <AssistantComposer
                    suggestions={SUGGESTION_LABELS}
                    onSuggestionPress={(label) => openChat(optimizePrompt(label))}
                    value={draft}
                    onChangeText={setDraft}
                    onSend={sendDraft}
                    onPressMic={voice.toggle}
                    listening={voice.isListening}
                    micAvailable={voice.available}
                />
            </View>
            </KeyboardAvoidingView>
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
                    style={{ fontFamily: 'MonaSans_600SemiBold', fontSize: 14.5, color: colors.text.primary }}
                    numberOfLines={1}
                >
                    {data.title}
                </Text>
                {data.subtitle ? (
                    <Text
                        style={{ fontFamily: 'MonaSans_500Medium', fontSize: 12.5, color: colors.text.tertiary, marginTop: 1 }}
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
            <Text style={{ fontFamily: 'MonaSans_500Medium', fontSize: 11, color: colors.text.tertiary }}>
                {label}
            </Text>
            <Text
                style={{
                    fontFamily: 'MonaSans_800ExtraBold',
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
