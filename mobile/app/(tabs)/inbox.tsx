import React, { useRef, useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import {
    View, Text, ScrollView, RefreshControl, Pressable,
    Animated as RNAnimated, PanResponder,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
    FileText, MessageSquare, Bell, ChevronRight, CheckCircle2,
    Inbox as InboxIcon, Trash2, MessageCircle,
} from "lucide-react-native";
import Animated, {
    FadeInUp, FadeIn, Easing,
    useSharedValue, useAnimatedStyle, withTiming, interpolate,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { ANIM } from "../../lib/animations";
import { useInbox, type InboxItem } from "../../hooks/useInbox";
import { useUnreadCount, refetchUnreadCounts } from "../../hooks/useUnreadCount";
import { PressableScale } from "../../components/shared/PressableScale";
import { ChatView } from "../../components/chat/ChatView";

// ── Helpers ──
function TypeIcon({ type }: { type: InboxItem["type"] }) {
    if (type === "form_request") return <FileText size={18} color="#7c3aed" />;
    if (type === "feedback") return <MessageSquare size={18} color="#16a34a" />;
    return <Bell size={18} color="#0ea5e9" />;
}

function typeLabel(type: InboxItem["type"]) {
    if (type === "form_request") return "Formulário";
    if (type === "feedback") return "Feedback";
    if (type === "system_alert") return "Alerta";
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
                <MessageCircle size={16} color={activeTab === 'messages' ? '#0f172a' : '#64748b'} />
                <Text
                    style={{
                        fontSize: 13,
                        fontWeight: activeTab === 'messages' ? '700' : '500',
                        letterSpacing: 0.5,
                        color: activeTab === 'messages' ? '#0f172a' : '#64748b',
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
                <Bell size={16} color={activeTab === 'notifications' ? '#0f172a' : '#64748b'} />
                <Text
                    style={{
                        fontSize: 13,
                        fontWeight: activeTab === 'notifications' ? '700' : '500',
                        letterSpacing: 0.5,
                        color: activeTab === 'notifications' ? '#0f172a' : '#64748b',
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

    const iconBg =
        item.type === "feedback" ? "#ecfdf5" :
            item.type === "form_request" ? "#f5f3ff" : "#f0f9ff";

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
                        backgroundColor: '#ffffff', borderRadius: 20, padding: 14,
                        borderWidth: 1, borderColor: 'rgba(0, 0, 0, 0.04)',
                        shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
                    }}
                >
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: iconBg, alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                            <TypeIcon type={item.type} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={{ color: "#0f172a", fontWeight: "700", fontSize: 14 }}>{item.title}</Text>
                            {!!item.subtitle && (
                                <Text style={{ color: "#64748b", fontSize: 12, marginTop: 2 }} numberOfLines={2}>{item.subtitle}</Text>
                            )}
                            <View style={{ flexDirection: "row", marginTop: 8, gap: 8 }}>
                                <Text style={{ color: "#94a3b8", fontSize: 10, fontWeight: "700", letterSpacing: 1 }}>{typeLabel(item.type).toUpperCase()}</Text>
                                <Text style={{ color: "#cbd5e1", fontSize: 10 }}>•</Text>
                                <Text style={{ color: "#94a3b8", fontSize: 10, fontWeight: "700", letterSpacing: 1 }}>{statusLabel(item.status).toUpperCase()}</Text>
                            </View>
                        </View>
                        <ChevronRight size={18} color="#cbd5e1" />
                    </View>
                </PressableScale>
            </RNAnimated.View>
        </Animated.View>
    );
}

// ── Unread Widget ──
function UnreadWidget({ count }: { count: number }) {
    if (count === 0) {
        return (
            <Animated.View entering={FadeIn.duration(400)} style={{
                marginTop: 16, marginBottom: 16, backgroundColor: '#ecfdf5', borderRadius: 16,
                paddingVertical: 14, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center',
                gap: 10, borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.12)',
            }}>
                <CheckCircle2 size={20} color="#10b981" fill="#d1fae5" />
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#059669', flex: 1 }}>Tudo em dia!</Text>
                <Text style={{ fontSize: 12, color: '#10b981', fontWeight: '500' }}>Inbox zero</Text>
            </Animated.View>
        );
    }

    return (
        <Animated.View entering={FadeIn.duration(400)} style={{
            marginTop: 16, marginBottom: 16, backgroundColor: '#ffffff', borderRadius: 20, padding: 20,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            borderWidth: 1, borderColor: 'rgba(0, 0, 0, 0.04)',
            shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
        }}>
            <View>
                <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' }}>Não lidos</Text>
                <Text style={{ color: '#7c3aed', fontSize: 32, fontWeight: '900', marginTop: 2 }}>{count}</Text>
            </View>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#f5f3ff', alignItems: 'center', justifyContent: 'center' }}>
                <InboxIcon size={20} color="#7c3aed" />
            </View>
        </Animated.View>
    );
}

// ── Empty State ──
function EmptyState({ label }: { label: string }) {
    return (
        <View style={{ alignItems: 'center', paddingVertical: 32, gap: 10 }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' }}>
                <InboxIcon size={22} color="#cbd5e1" />
            </View>
            <Text style={{ color: '#94a3b8', fontSize: 13, fontWeight: '500' }}>{label}</Text>
        </View>
    );
}

// ── Notifications Content (former Inbox content) ──
function NotificationsTab() {
    const router = useRouter();
    const {
        pendingItems, completedItems, unreadCount,
        isLoading, isRefreshing, refresh, markItemOpened,
    } = useInbox();

    const handleOpenItem = useCallback(async (item: InboxItem) => {
        await markItemOpened(item);
        router.push(`/inbox/${item.id}`);
    }, [markItemOpened, router]);

    return (
        <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 120 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
                <RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor="#7c3aed" />
            }
        >
            <UnreadWidget count={unreadCount} />

            <Animated.View entering={FadeInUp.delay(60).duration(300).easing(Easing.out(Easing.cubic))}>
                <Text style={sectionLabelStyle}>Pendentes</Text>
            </Animated.View>

            {isLoading ? (
                <Text style={{ color: "#94a3b8", marginBottom: 18, fontSize: 13 }}>Carregando...</Text>
            ) : pendingItems.length === 0 ? (
                <EmptyState label="Nenhuma pendência no momento" />
            ) : (
                pendingItems.map((item, index) => (
                    <SwipeableInboxCard key={item.id} item={item} onPress={handleOpenItem} index={index} showSwipe={false} />
                ))
            )}

            <Animated.View entering={FadeInUp.delay(120).duration(300).easing(Easing.out(Easing.cubic))}>
                <Text style={[sectionLabelStyle, { marginTop: 16 }]}>Concluídos</Text>
            </Animated.View>

            {completedItems.length === 0 ? (
                <EmptyState label="Nenhum item concluído ainda" />
            ) : (
                completedItems.map((item, index) => (
                    <SwipeableInboxCard key={item.id} item={item} onPress={handleOpenItem} index={index + pendingItems.length} showSwipe={true} />
                ))
            )}
        </ScrollView>
    );
}

// ── Main Screen ──
export default function InboxScreen() {
    const [activeTab, setActiveTab] = useState<'messages' | 'notifications'>('messages');
    const { messages: unreadMessages, notifications: unreadNotifications } = useUnreadCount();

    // Safety net: refetch counts from DB when inbox tab gains focus
    useFocusEffect(
        useCallback(() => {
            refetchUnreadCounts();
        }, [])
    );

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: "#F2F2F7" }} edges={["top"]}>
            {/* Header */}
            <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
                <Text style={{ fontSize: 30, fontWeight: "800", color: "#0f172a" }}>
                    Mensagens
                </Text>
            </View>

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

const sectionLabelStyle = {
    marginBottom: 10,
    color: "#94a3b8",
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: "700" as const,
    textTransform: "uppercase" as const,
    paddingLeft: 1,
};
