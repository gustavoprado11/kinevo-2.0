import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useNotificationStore } from '../stores/notification-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TrainerNotification {
    id: string;
    type: string;
    category: 'students' | 'forms' | 'payments' | 'programs';
    title: string;
    body: string | null;
    data: Record<string, unknown>;
    is_read: boolean;
    created_at: string;
}

export type NotificationFilter = 'all' | 'students' | 'forms' | 'payments' | 'programs';

export interface NotificationSection {
    title: string;
    data: TrainerNotification[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function groupIntoSections(notifications: TrainerNotification[]): NotificationSection[] {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Sunday

    const today: TrainerNotification[] = [];
    const thisWeek: TrainerNotification[] = [];
    const earlier: TrainerNotification[] = [];

    for (const n of notifications) {
        const date = new Date(n.created_at);
        if (date >= todayStart) {
            today.push(n);
        } else if (date >= weekStart) {
            thisWeek.push(n);
        } else {
            earlier.push(n);
        }
    }

    const sections: NotificationSection[] = [];
    if (today.length > 0) sections.push({ title: 'Hoje', data: today });
    if (thisWeek.length > 0) sections.push({ title: 'Esta semana', data: thisWeek });
    if (earlier.length > 0) sections.push({ title: 'Anteriores', data: earlier });

    return sections;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useTrainerNotifications() {
    const [notifications, setNotifications] = useState<TrainerNotification[]>([]);
    const [filter, setFilter] = useState<NotificationFilter>('all');
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const { setUnreadCount } = useNotificationStore();

    const fetchNotifications = useCallback(async (showRefreshing = false) => {
        if (showRefreshing) setIsRefreshing(true);

        try {
            const { data, error } = await (supabase as any)
                .from('trainer_notifications')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100);

            if (error) {
                if (__DEV__) console.error('[notifications] Fetch error:', error.message);
                return;
            }

            const typed = (data ?? []) as TrainerNotification[];
            setNotifications(typed);

            const unread = typed.filter((n) => !n.is_read).length;
            setUnreadCount(unread);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [setUnreadCount]);

    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    const filtered = useMemo(() => {
        if (filter === 'all') return notifications;
        return notifications.filter((n) => n.category === filter);
    }, [notifications, filter]);

    const sections = useMemo(() => groupIntoSections(filtered), [filtered]);

    const unreadCount = useMemo(
        () => notifications.filter((n) => !n.is_read).length,
        [notifications]
    );

    const markAsRead = useCallback(async (id: string) => {
        // Optimistic update
        setNotifications((prev) =>
            prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
        );
        setUnreadCount(Math.max(0, unreadCount - 1));

        const { error } = await (supabase as any).rpc('mark_notification_read', {
            p_notification_id: id,
        });

        if (error && __DEV__) {
            console.error('[notifications] Mark read error:', error.message);
        }
    }, [unreadCount, setUnreadCount]);

    const markAllAsRead = useCallback(async () => {
        // Optimistic update
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
        setUnreadCount(0);

        const { error } = await (supabase as any).rpc('mark_all_notifications_read');

        if (error && __DEV__) {
            console.error('[notifications] Mark all read error:', error.message);
        }
    }, [setUnreadCount]);

    const refresh = useCallback(() => fetchNotifications(true), [fetchNotifications]);

    return {
        notifications: filtered,
        sections,
        filter,
        setFilter,
        unreadCount,
        isLoading,
        isRefreshing,
        markAsRead,
        markAllAsRead,
        refresh,
    };
}
