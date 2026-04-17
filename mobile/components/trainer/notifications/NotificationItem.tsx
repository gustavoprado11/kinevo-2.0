import React from 'react';
import { View, Text } from 'react-native';
import { Users, ClipboardList, CreditCard, Calendar, FileText } from 'lucide-react-native';
import { PressableScale } from '../../shared/PressableScale';
import { colors } from '@/theme';
import type { TrainerNotification } from '../../../hooks/useTrainerNotifications';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Ícone decidido por type quando há caso específico; senão cai no genérico
// da categoria. Isso permite notificações da mesma categoria com ícones
// distintos (ex.: Calendar pra programa expirado vs FileText pra relatório
// pendente — ambos 'programs').
function getIcon(type: string, category: string) {
    // Tipos específicos que merecem ícone próprio
    switch (type) {
        case 'program_report_pending':
            return { Icon: FileText, color: colors.brand.primary, bg: colors.brand.primaryLight };
    }

    switch (category) {
        case 'students':
            return { Icon: Users, color: colors.brand.primary, bg: colors.status.presencialBg };
        case 'forms':
            return { Icon: ClipboardList, color: colors.warning.default, bg: colors.warning.light };
        case 'payments':
            return { Icon: CreditCard, color: colors.success.default, bg: colors.success.light };
        case 'programs':
            return { Icon: Calendar, color: colors.info.default, bg: colors.info.light };
        default:
            return { Icon: Users, color: colors.brand.primary, bg: colors.status.presencialBg };
    }
}

function timeAgo(dateStr: string): string {
    const now = Date.now();
    const date = new Date(dateStr).getTime();
    const diff = now - date;

    const minutes = Math.floor(diff / 60_000);
    if (minutes < 1) return 'agora';
    if (minutes < 60) return `há ${minutes} min`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `há ${hours}h`;

    const days = Math.floor(hours / 24);
    if (days === 1) return 'ontem';
    if (days < 7) return `há ${days} dias`;

    const weeks = Math.floor(days / 7);
    if (weeks === 1) return 'há 1 sem';
    return `há ${weeks} sem`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface NotificationItemProps {
    notification: TrainerNotification;
    onPress: () => void;
}

export function NotificationItem({ notification, onPress }: NotificationItemProps) {
    const { Icon, color, bg } = getIcon(notification.type, notification.category);
    const isUnread = !notification.is_read;

    return (
        <PressableScale
            onPress={onPress}
            pressScale={0.98}
            accessibilityRole="button"
            accessibilityLabel={`${notification.title}${notification.body ? `. ${notification.body}` : ''}. ${isUnread ? 'Não lida' : 'Lida'}`}
            accessibilityHint="Toque para ver detalhes"
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 14,
                paddingHorizontal: 16,
                backgroundColor: isUnread ? colors.brand.primaryLight : colors.background.card,
                borderRadius: 14,
                marginBottom: 8,
                gap: 12,
            }}
        >
            {/* Unread dot */}
            <View style={{ width: 8, alignItems: 'center' }}>
                {isUnread && (
                    <View
                        style={{
                            width: 8,
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: colors.brand.primary,
                        }}
                    />
                )}
            </View>

            {/* Icon */}
            <View
                style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    backgroundColor: bg,
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <Icon size={20} color={color} strokeWidth={1.8} />
            </View>

            {/* Content */}
            <View style={{ flex: 1 }}>
                <Text
                    numberOfLines={1}
                    style={{
                        fontSize: 14,
                        fontWeight: isUnread ? '600' : '400',
                        color: colors.text.primary,
                    }}
                >
                    {notification.title}
                </Text>
                {notification.body && (
                    <Text
                        numberOfLines={2}
                        style={{
                            fontSize: 13,
                            color: colors.text.secondary,
                            marginTop: 2,
                            lineHeight: 18,
                        }}
                    >
                        {notification.body}
                    </Text>
                )}
            </View>

            {/* Time */}
            <Text
                style={{
                    fontSize: 11,
                    color: colors.text.tertiary,
                    fontWeight: '500',
                }}
            >
                {timeAgo(notification.created_at)}
            </Text>
        </PressableScale>
    );
}
