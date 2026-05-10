import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Calendar, ClipboardList } from 'lucide-react-native';
import { colors } from '@/theme';
import { useV2Colors } from '@/hooks/useV2Colors';
import { SessionStatusBadge, type BadgeKind } from './SessionStatusBadge';
import type { AssessmentSessionListItem } from '@kinevo/shared/types/assessments';

interface Props {
    session: AssessmentSessionListItem;
    /** When set, the row is rendered as an in-progress draft from the local
     *  store (not yet a row in `assessment_sessions` results). Drafts get
     *  the 'draft' badge and a presencial-tinted left border. */
    isDraft?: boolean;
    /** Used to flag overdue (>7d past scheduled_at) — pre-computed by the
     *  list to avoid repeating the math. */
    isOverdue?: boolean;
    onPress: (sessionId: string) => void;
    /** Optional summary right-side: "3/8 testes" for in-progress / drafts. */
    progress?: { done: number; total: number };
}

function relativeDay(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(d);
    target.setHours(0, 0, 0, 0);
    const diff = (target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000);
    if (diff === 0) return 'Hoje';
    if (diff === 1) return 'Amanhã';
    if (diff === -1) return 'Ontem';
    if (diff > 1 && diff < 7) return `Em ${diff} dias`;
    if (diff < -1 && diff > -7) return `${Math.abs(diff)} dias atrás`;
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export function SessionListItem({ session, isDraft, isOverdue, onPress, progress }: Props) {
    const v2c = useV2Colors();
    const kind: BadgeKind = isDraft
        ? 'draft'
        : isOverdue
            ? 'overdue'
            : (session.status ?? 'scheduled');

    const accent =
        kind === 'overdue'
            ? colors.error.default
            : kind === 'completed'
                ? colors.status.active
                : colors.status.presencial;

    return (
        <TouchableOpacity
            onPress={() => onPress(session.id)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`Sessão de ${session.student_name}`}
            style={{
                flexDirection: 'row',
                gap: 12,
                padding: 14,
                backgroundColor: v2c.surface.card,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: v2c.border.default,
                borderLeftWidth: isDraft ? 3 : 1,
                borderLeftColor: isDraft ? accent : v2c.border.default,
            }}>
            {session.student_avatar ? (
                <Image
                    source={{ uri: session.student_avatar }}
                    style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: v2c.neutral[100] }}
                />
            ) : (
                <View
                    style={{
                        width: 44,
                        height: 44,
                        borderRadius: 14,
                        backgroundColor: colors.status.presencialBg,
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: colors.status.presencial }}>
                        {(session.student_name ?? '?').charAt(0).toUpperCase()}
                    </Text>
                </View>
            )}

            <View style={{ flex: 1, gap: 4 }}>
                <Text
                    numberOfLines={1}
                    style={{ fontSize: 15, fontWeight: '700', color: v2c.text.primary }}>
                    {session.student_name}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <ClipboardList size={12} color={v2c.text.tertiary} />
                    <Text
                        numberOfLines={1}
                        style={{ fontSize: 12, color: v2c.text.tertiary, flex: 1 }}>
                        {session.template_title ?? 'Sem template'}
                    </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
                    <SessionStatusBadge kind={kind} />
                    {session.scheduled_at && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                            <Calendar size={11} color={v2c.text.tertiary} />
                            <Text style={{ fontSize: 11, color: v2c.text.tertiary }}>
                                {relativeDay(session.scheduled_at)}
                            </Text>
                        </View>
                    )}
                    {progress && (
                        <Text style={{ fontSize: 11, color: v2c.text.tertiary, marginLeft: 'auto' }}>
                            {progress.done}/{progress.total} testes
                        </Text>
                    )}
                </View>
            </View>
        </TouchableOpacity>
    );
}
