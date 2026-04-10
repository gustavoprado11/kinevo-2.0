import React, { useCallback } from 'react';
import { View, Text, SectionList, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, Bell, CheckCheck } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeInUp, Easing } from 'react-native-reanimated';
import { colors } from '@/theme';
import { toast } from '@/lib/toast';
import { ResponsiveContainer } from '../../components/shared/ResponsiveContainer';
import { EmptyState } from '../../components/shared/EmptyState';
import { NotificationItem } from '../../components/trainer/notifications/NotificationItem';
import { NotificationFilters } from '../../components/trainer/notifications/NotificationFilters';
import {
    useTrainerNotifications,
    type TrainerNotification,
} from '../../hooks/useTrainerNotifications';

// ---------------------------------------------------------------------------
// Deep link resolver
// ---------------------------------------------------------------------------

function getDeepLinkForNotification(n: TrainerNotification): { pathname: string; params?: Record<string, string> } | null {
    const data = n.data as Record<string, string>;

    switch (n.type) {
        case 'form_request':
        case 'feedback':
        case 'form_submission':
            if (data?.inbox_item_id) {
                return { pathname: '/inbox/[id]', params: { id: data.inbox_item_id } };
            }
            return null;

        case 'message':
        case 'student_message':
        case 'text_message':
            return { pathname: '/(tabs)/inbox' };

        case 'program_assigned':
            return { pathname: '/(tabs)/home' };

        case 'workout_completed':
        case 'new_student':
        case 'program_expired':
            if (data?.student_id) {
                return { pathname: '/student/[id]', params: { id: data.student_id } };
            }
            return null;

        case 'payment_received':
        case 'payment_failed':
        case 'payment_overdue':
        case 'subscription_canceled':
        case 'cancellation_alert':
            if (data?.contract_id) {
                return { pathname: '/financial/contract/[id]', params: { id: data.contract_id } };
            }
            return { pathname: '/financial' };

        default:
            if (data?.student_id) {
                return { pathname: '/student/[id]', params: { id: data.student_id } };
            }
            return null;
    }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function NotificationsScreen() {
    const router = useRouter();
    const {
        sections,
        filter,
        setFilter,
        unreadCount,
        isLoading,
        isRefreshing,
        markAsRead,
        markAllAsRead,
        refresh,
    } = useTrainerNotifications();

    const handleNotificationPress = useCallback(
        async (notification: TrainerNotification) => {
            if (!notification.is_read) {
                await markAsRead(notification.id);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }

            const link = getDeepLinkForNotification(notification);
            if (link) {
                router.push(link as any);
            }
        },
        [markAsRead, router]
    );

    const handleMarkAllAsRead = useCallback(async () => {
        await markAllAsRead();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        toast.success('Todas marcadas como lidas');
    }, [markAllAsRead]);

    const renderItem = useCallback(
        ({ item }: { item: TrainerNotification }) => (
            <NotificationItem
                notification={item}
                onPress={() => handleNotificationPress(item)}
            />
        ),
        [handleNotificationPress]
    );

    const renderSectionHeader = useCallback(
        ({ section }: { section: { title: string } }) => (
            <Text
                style={{
                    fontSize: 11,
                    fontWeight: '700',
                    color: colors.text.tertiary,
                    letterSpacing: 2,
                    textTransform: 'uppercase',
                    marginBottom: 8,
                    marginTop: 16,
                    paddingHorizontal: 20,
                }}
            >
                {section.title}
            </Text>
        ),
        []
    );

    const isEmpty = !isLoading && sections.length === 0;

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }} edges={['top']}>
          <ResponsiveContainer maxWidth={800} padding={false}>
            {/* Header */}
            <Animated.View
                entering={FadeIn.duration(300)}
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                }}
            >
                <TouchableOpacity
                    onPress={() => router.back()}
                    accessibilityRole="button"
                    accessibilityLabel="Voltar"
                    hitSlop={12}
                >
                    <ChevronLeft size={24} color={colors.text.primary} />
                </TouchableOpacity>

                <Text
                    style={{
                        fontSize: 18,
                        fontWeight: '700',
                        color: colors.text.primary,
                    }}
                >
                    Notificações
                </Text>

                {unreadCount > 0 ? (
                    <TouchableOpacity
                        onPress={handleMarkAllAsRead}
                        accessibilityRole="button"
                        accessibilityLabel="Marcar todas como lidas"
                        hitSlop={12}
                    >
                        <CheckCheck size={22} color={colors.brand.primary} />
                    </TouchableOpacity>
                ) : (
                    <View style={{ width: 24 }} />
                )}
            </Animated.View>

            {/* Filters */}
            <NotificationFilters filter={filter} setFilter={setFilter} />

            {/* List */}
            {isEmpty ? (
                <EmptyState
                    icon={<Bell size={48} color={colors.text.tertiary} />}
                    title="Nenhuma notificação"
                    description="Quando seus alunos completarem treinos, enviarem formulários ou houver atualizações, você verá aqui."
                />
            ) : (
                <SectionList
                    sections={sections}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    renderSectionHeader={renderSectionHeader}
                    contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
                    showsVerticalScrollIndicator={false}
                    stickySectionHeadersEnabled={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefreshing}
                            onRefresh={refresh}
                            tintColor={colors.brand.primary}
                        />
                    }
                />
            )}
          </ResponsiveContainer>
        </SafeAreaView>
    );
}
