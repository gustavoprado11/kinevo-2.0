import React, { useRef, useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import {
    View, Text, Image, ScrollView, RefreshControl, Pressable,
    Animated as RNAnimated, PanResponder,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
    FileText, MessageSquare, Bell, ChevronRight, CheckCircle2,
    Inbox as InboxIcon, Trash2, MessageCircle, Award, AlertCircle, User,
} from "lucide-react-native";
import Animated, {
    FadeInUp, FadeIn, Easing,
    useSharedValue, useAnimatedStyle, withTiming, interpolate,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { ANIM } from "../../lib/animations";
import { useInbox, type InboxItem } from "../../hooks/useInbox";
import { useUnreadCount, refetchUnreadCounts } from "../../hooks/useUnreadCount";
import { useStudentProfile } from "../../hooks/useStudentProfile";
import { PressableScale } from "../../components/shared/PressableScale";
import { ChatView } from "../../components/chat/ChatView";
import { useV2Colors } from "../../hooks/useV2Colors";
import { toRgba } from "../../lib/brandColor";
import { useBrand } from "../../stores/brandStore";
import { LinearGradient } from "expo-linear-gradient";

// ── Helpers ──
// Themed icon mapping: cada tipo de InboxItem ganha cor/ícone próprio.
// Match com InboxItemType em mobile/hooks/useInbox.ts:
//   form_request | feedback | system_alert | text_message | program_report_published
type IconTheme = {
    Icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
    fg: string;
    /** Gradient [start, end] usado no bg do ícone. */
    grad: [string, string];
};

function getIconTheme(type: InboxItem["type"]): IconTheme {
    if (type === "form_request")
        return { Icon: FileText, fg: '#6D28D9', grad: ['#EDE9FE', '#DDD6FE'] };
    if (type === "feedback")
        return { Icon: MessageSquare, fg: '#047857', grad: ['#D1FAE5', '#A7F3D0'] };
    if (type === "program_report_published")
        return { Icon: Award, fg: '#B45309', grad: ['#FEF3C7', '#FDE68A'] };
    if (type === "system_alert")
        return { Icon: AlertCircle, fg: '#B91C1C', grad: ['#FEE2E2', '#FECACA'] };
    if (type === "text_message")
        return { Icon: MessageCircle, fg: '#1D4ED8', grad: ['#DBEAFE', '#BFDBFE'] };
    return { Icon: Bell, fg: '#0EA5E9', grad: ['#E0F2FE', '#BAE6FD'] };
}

function TypeIconBubble({ type }: { type: InboxItem["type"] }) {
    const theme = getIconTheme(type);
    const { Icon } = theme;
    return (
        <LinearGradient
            colors={theme.grad}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            <Icon size={18} color={theme.fg} strokeWidth={2} />
        </LinearGradient>
    );
}

function typeLabel(type: InboxItem["type"]) {
    if (type === "form_request") return "Formulário";
    if (type === "feedback") return "Feedback";
    if (type === "system_alert") return "Alerta";
    if (type === "program_report_published") return "Relatório";
    return "Mensagem";
}

function statusLabel(status: InboxItem["status"]) {
    if (status === "unread") return "Não lido";
    if (status === "pending_action") return "Pendente";
    if (status === "completed") return "Concluído";
    return "Arquivado";
}

// ── Animated Segmented Control (same pattern as logs.tsx) ──
function SegmentBadge({ count }: { count: number }) {
    if (count <= 0) return null;
    return (
        <View
            style={{
                minWidth: 18,
                height: 18,
                borderRadius: 9,
                backgroundColor: '#ef4444',
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 5,
            }}
        >
            <Text style={{ fontSize: 10, fontWeight: '700', color: '#ffffff' }}>
                {count > 99 ? '99+' : count}
            </Text>
        </View>
    );
}

function AnimatedSegmentedControl({
    activeTab,
    onTabChange,
    messagesBadge = 0,
    notificationsBadge = 0,
}: {
    activeTab: 'messages' | 'notifications';
    onTabChange: (tab: 'messages' | 'notifications') => void;
    messagesBadge?: number;
    notificationsBadge?: number;
}) {
    const pillX = useSharedValue(activeTab === 'messages' ? 0 : 1);

    const handlePress = useCallback((tab: 'messages' | 'notifications') => {
        Haptics.selectionAsync();
        pillX.value = withTiming(tab === 'messages' ? 0 : 1, ANIM.timing.normal);
        onTabChange(tab);
    }, [onTabChange]);

    const pillAnimStyle = useAnimatedStyle(() => ({
        left: `${interpolate(pillX.value, [0, 1], [0.8, 50.8])}%`,
    }));

    return (
        <View
            style={{
                marginHorizontal: 20,
                marginVertical: 16,
                backgroundColor: 'rgba(226, 232, 240, 0.7)',
                borderRadius: 14,
                padding: 4,
                flexDirection: 'row',
                position: 'relative',
            }}
        >
            {/* Sliding pill */}
            <Animated.View
                style={[
                    {
                        position: 'absolute',
                        top: 4,
                        bottom: 4,
                        width: '48%',
                        borderRadius: 11,
                        backgroundColor: '#ffffff',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.08,
                        shadowRadius: 3,
                        elevation: 2,
                    },
                    pillAnimStyle,
                ]}
            />

            {/* Messages tab */}
            <Pressable
                onPress={() => handlePress('messages')}
                style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingVertical: 10,
                    borderRadius: 11,
                    gap: 6,
                }}
            >
                <MessageCircle size={16} color={activeTab === 'messages' ? '#1C1917' : '#57534E'} />
                <Text
                    style={{
                        fontSize: 13,
                        fontWeight: activeTab === 'messages' ? '700' : '500',
                        letterSpacing: 0.5,
                        color: activeTab === 'messages' ? '#1C1917' : '#57534E',
                    }}
                >
                    Mensagens
                </Text>
                <SegmentBadge count={messagesBadge} />
            </Pressable>

            {/* Notifications tab */}
            <Pressable
                onPress={() => handlePress('notifications')}
                style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingVertical: 10,
                    borderRadius: 11,
                    gap: 6,
                }}
            >
                <Bell size={16} color={activeTab === 'notifications' ? '#1C1917' : '#57534E'} />
                <Text
                    style={{
                        fontSize: 13,
                        fontWeight: activeTab === 'notifications' ? '700' : '500',
                        letterSpacing: 0.5,
                        color: activeTab === 'notifications' ? '#1C1917' : '#57534E',
                    }}
                >
                    Notificações
                </Text>
                <SegmentBadge count={notificationsBadge} />
            </Pressable>
        </View>
    );
}

// ── Swipeable Card ──
function SwipeableInboxCard({
    item,
    onPress,
    index,
    showSwipe = false,
}: {
    item: InboxItem;
    onPress: (item: InboxItem) => void;
    index: number;
    showSwipe?: boolean;
}) {
    const colors = useV2Colors();
    const translateX = useRef(new RNAnimated.Value(0)).current;
    const swipeThreshold = -80;
    const didTriggerHaptic = useRef(false);

    const panResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (_, gestureState) => {
                return showSwipe && Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dy) < 10;
            },
            onPanResponderMove: (_, gestureState) => {
                if (gestureState.dx < 0) {
                    translateX.setValue(gestureState.dx);
                    if (gestureState.dx <= swipeThreshold && !didTriggerHaptic.current) {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        didTriggerHaptic.current = true;
                    }
                    if (gestureState.dx > swipeThreshold) {
                        didTriggerHaptic.current = false;
                    }
                }
            },
            onPanResponderRelease: (_, gestureState) => {
                didTriggerHaptic.current = false;
                RNAnimated.spring(translateX, {
                    toValue: gestureState.dx <= swipeThreshold ? -100 : 0,
                    useNativeDriver: true,
                    tension: 100,
                    friction: 12,
                }).start();
            },
        })
    ).current;

    const resetSwipe = () => {
        RNAnimated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            tension: 100,
            friction: 12,
        }).start();
    };

    return (
        <Animated.View
            entering={FadeInUp.delay(index * 35).duration(300).easing(Easing.out(Easing.cubic))}
            style={{ marginBottom: 10, borderRadius: 20, overflow: 'hidden' }}
        >
            {showSwipe && (
                <View
                    style={{
                        position: 'absolute', top: 0, bottom: 0, right: 0, width: 100,
                        backgroundColor: '#ef4444', borderTopRightRadius: 20, borderBottomRightRadius: 20,
                        alignItems: 'center', justifyContent: 'center',
                    }}
                >
                    <Trash2 size={20} color="#ffffff" />
                </View>
            )}

            <RNAnimated.View
                {...(showSwipe ? panResponder.panHandlers : {})}
                style={{ transform: [{ translateX }] }}
            >
                <PressableScale
                    onPress={() => { resetSwipe(); onPress(item); }}
                    pressScale={0.98}
                    style={{
                        backgroundColor: colors.surface.card, borderRadius: 20, padding: 14,
                        borderWidth: 1, borderColor: colors.border.default,
                        shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
                    }}
                >
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <View style={{ marginRight: 12 }}>
                            <TypeIconBubble type={item.type} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={{ color: colors.text.primary, fontWeight: "700", fontSize: 14 }}>{item.title}</Text>
                            {!!item.subtitle && (
                                <Text style={{ color: colors.text.tertiary, fontSize: 12, marginTop: 2 }} numberOfLines={2}>{item.subtitle}</Text>
                            )}
                            <View style={{ flexDirection: "row", marginTop: 8, gap: 8 }}>
                                <Text style={{ color: colors.text.quaternary, fontSize: 10, fontWeight: "700", letterSpacing: 1 }}>{typeLabel(item.type).toUpperCase()}</Text>
                                <Text style={{ color: colors.text.quaternary, fontSize: 10 }}>•</Text>
                                <Text style={{ color: colors.text.quaternary, fontSize: 10, fontWeight: "700", letterSpacing: 1 }}>{statusLabel(item.status).toUpperCase()}</Text>
                            </View>
                        </View>
                        <ChevronRight size={18} color={colors.text.quaternary} />
                    </View>
                </PressableScale>
            </RNAnimated.View>
        </Animated.View>
    );
}

// ── Unread Widget ──
function UnreadWidget({ count }: { count: number }) {
    const colors = useV2Colors();
    if (count === 0) {
        return (
            <Animated.View entering={FadeIn.duration(400)} style={{
                marginTop: 16, marginBottom: 16, backgroundColor: 'rgba(16,185,129,0.10)', borderRadius: 16,
                paddingVertical: 14, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center',
                gap: 10, borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.18)',
            }}>
                <CheckCircle2 size={20} color="#10b981" fill="#D1FAE5" />
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#059669', flex: 1 }}>Tudo em dia!</Text>
                <Text style={{ fontSize: 12, color: '#10b981', fontWeight: '500' }}>Inbox zero</Text>
            </Animated.View>
        );
    }

    return (
        <Animated.View entering={FadeIn.duration(400)} style={{
            marginTop: 16, marginBottom: 16, backgroundColor: colors.surface.card, borderRadius: 20, padding: 20,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            borderWidth: 1, borderColor: colors.border.default,
            shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
        }}>
            <View>
                <Text style={{ color: colors.text.quaternary, fontSize: 11, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' }}>Não lidos</Text>
                <Text style={{ color: colors.brand.primary, fontSize: 32, fontWeight: '900', marginTop: 2 }}>{count}</Text>
            </View>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: toRgba(colors.brand.primary, 0.12), alignItems: 'center', justifyContent: 'center' }}>
                <InboxIcon size={20} color={colors.brand.primary} />
            </View>
        </Animated.View>
    );
}

// ── Empty State ──
function EmptyState({ label }: { label: string }) {
    const colors = useV2Colors();
    return (
        <View style={{ alignItems: 'center', paddingVertical: 32, gap: 10 }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.neutral[100], alignItems: 'center', justifyContent: 'center' }}>
                <InboxIcon size={22} color={colors.text.quaternary} />
            </View>
            <Text style={{ color: colors.text.tertiary, fontSize: 13, fontWeight: '500' }}>{label}</Text>
        </View>
    );
}

// ── Notifications Content (former Inbox content) ──
function NotificationsTab() {
    const colors = useV2Colors();
    const router = useRouter();
    const {
        pendingItems, completedItems, unreadCount,
        isLoading, isRefreshing, refresh, markItemOpened,
    } = useInbox();

    const handleOpenItem = useCallback(async (item: InboxItem) => {
        await markItemOpened(item);

        // Deep link direto pra tela do relatório quando for notificação de
        // relatório publicado. Evita passar pela tela genérica /inbox/[id]
        // (que é desenhada pra forms).
        if (item.type === "program_report_published") {
            const reportId = item.payload?.report_id;
            if (reportId) {
                router.push(`/report/${reportId}`);
                return;
            }
        }

        router.push(`/inbox/${item.id}`);
    }, [markItemOpened, router]);

    return (
        <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 120 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
                <RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor={colors.brand.primary} />
            }
        >
            <UnreadWidget count={unreadCount} />

            <Animated.View entering={FadeInUp.delay(60).duration(300).easing(Easing.out(Easing.cubic))}>
                <Text style={[sectionLabelStyle, { color: colors.text.quaternary }]}>Pendentes</Text>
            </Animated.View>

            {isLoading ? (
                <Text style={{ color: colors.text.quaternary, marginBottom: 18, fontSize: 13 }}>Carregando...</Text>
            ) : pendingItems.length === 0 ? (
                <EmptyState label="Nenhuma pendência no momento" />
            ) : (
                pendingItems.map((item, index) => (
                    <SwipeableInboxCard key={item.id} item={item} onPress={handleOpenItem} index={index} showSwipe={false} />
                ))
            )}

            <Animated.View entering={FadeInUp.delay(120).duration(300).easing(Easing.out(Easing.cubic))}>
                <Text style={[sectionLabelStyle, { color: colors.text.quaternary, marginTop: 16 }]}>Concluídos</Text>
            </Animated.View>

            {completedItems.length === 0 ? (
                <EmptyState label="Nenhum item concluído ainda" />
            ) : (
                completedItems.map((item, index) => (
                    <SwipeableInboxCard key={item.id} item={item} onPress={handleOpenItem} index={index + pendingItems.length} showSwipe={false} />
                ))
            )}
        </ScrollView>
    );
}

// ── Main Screen ──
export default function InboxScreen() {
    const colors = useV2Colors();
    const { profile } = useStudentProfile();
    const [activeTab, setActiveTab] = useState<'messages' | 'notifications'>('messages');
    const { messages: unreadMessages, notifications: unreadNotifications } = useUnreadCount();

    // Safety net: refetch counts from DB when inbox tab gains focus
    useFocusEffect(
        useCallback(() => {
            refetchUnreadCounts();
        }, [])
    );

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.canvas }} edges={["top"]}>
            {/* Header */}
            <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
                <Text style={{ fontSize: 30, fontWeight: "800", color: colors.text.primary }}>
                    Mensagens
                </Text>
            </View>

            {/* Trainer card hero (V2 polish) — só renderiza se aluno tem coach.
                Online status / response time não estão expostos pelo hook,
                então omitimos esses placeholders pra não inventar dados. */}
            {profile?.coach ? (
                <TrainerCardHero
                    name={profile.coach.name}
                    avatarUrl={profile.coach.avatar_url}
                    onPress={() => setActiveTab('messages')}
                />
            ) : null}

            <AnimatedSegmentedControl
                activeTab={activeTab}
                onTabChange={setActiveTab}
                messagesBadge={unreadMessages}
                notificationsBadge={unreadNotifications}
            />

            {activeTab === 'messages' ? (
                <ChatView />
            ) : (
                <NotificationsTab />
            )}
        </SafeAreaView>
    );
}

// ── Trainer card hero: dark gradient + avatar + eyebrow + nome.
// Online status / response time omitidos (hook não expõe).
function TrainerCardHero({
    name,
    avatarUrl,
    onPress,
}: {
    name: string;
    avatarUrl: string | null;
    onPress: () => void;
}) {
    const brand = useBrand();
    const initials = name
        .split(' ')
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={`Abrir conversa com ${name}`}
            style={{
                marginHorizontal: 20,
                marginBottom: 4,
                borderRadius: 20,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.06)',
            }}
        >
            <LinearGradient
                colors={['#18181B', '#27272A', brand.deep]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                    padding: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 14,
                }}
            >
                {/* Avatar com border branca */}
                <View
                    style={{
                        width: 48,
                        height: 48,
                        borderRadius: 24,
                        borderWidth: 2,
                        borderColor: 'rgba(255,255,255,0.9)',
                        overflow: 'hidden',
                        backgroundColor: brand.dark,
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    {avatarUrl ? (
                        <Image source={{ uri: avatarUrl }} style={{ width: '100%', height: '100%' }} />
                    ) : (
                        <Text
                            style={{
                                fontFamily: 'MonaSans_800ExtraBold',
                                fontSize: 16,
                                color: '#FFFFFF',
                            }}
                        >
                            {initials || <User size={20} color="#FFFFFF" />}
                        </Text>
                    )}
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                    <Text
                        style={{
                            fontFamily: 'MonaSans_700Bold',
                            fontSize: 9.5,
                            letterSpacing: 1,
                            textTransform: 'uppercase',
                            color: 'rgba(255,255,255,0.5)',
                        }}
                    >
                        Seu treinador
                    </Text>
                    <Text
                        style={{
                            fontFamily: 'MonaSans_800ExtraBold',
                            fontSize: 15,
                            letterSpacing: -0.2,
                            color: '#FFFFFF',
                        }}
                        numberOfLines={1}
                    >
                        {name}
                    </Text>
                </View>
                <View
                    style={{
                        width: 30,
                        height: 30,
                        borderRadius: 15,
                        backgroundColor: 'rgba(255,255,255,0.14)',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <ChevronRight size={16} color="#FFFFFF" strokeWidth={2.5} />
                </View>
            </LinearGradient>
        </Pressable>
    );
}

// Color override aplicado nos call sites (via useV2Colors).
const sectionLabelStyle = {
    marginBottom: 10,
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: "700" as const,
    textTransform: "uppercase" as const,
    paddingLeft: 1,
};
