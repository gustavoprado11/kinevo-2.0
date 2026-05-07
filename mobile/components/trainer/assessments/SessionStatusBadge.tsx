import React from 'react';
import { View, Text } from 'react-native';
import { colors } from '@/theme';
import type { AssessmentSessionStatus } from '@kinevo/shared/types/assessments';

export type BadgeKind = AssessmentSessionStatus | 'overdue' | 'draft';

const STYLES: Record<BadgeKind, { bg: string; fg: string; label: string }> = {
    scheduled:    { bg: colors.status.onlineBg,     fg: colors.status.online,     label: 'Agendada' },
    in_progress:  { bg: colors.status.presencialBg, fg: colors.status.presencial, label: 'Em andamento' },
    completed:    { bg: colors.status.activeBg,     fg: colors.status.active,     label: 'Concluída' },
    cancelled:    { bg: colors.status.inactiveBg,   fg: colors.status.inactive,   label: 'Cancelada' },
    overdue:      { bg: colors.error.light,         fg: colors.error.default,     label: 'Em atraso' },
    draft:        { bg: colors.status.presencialBg, fg: colors.status.presencial, label: 'Rascunho' },
};

export function SessionStatusBadge({ kind }: { kind: BadgeKind }) {
    const s = STYLES[kind];
    return (
        <View
            style={{
                alignSelf: 'flex-start',
                backgroundColor: s.bg,
                paddingHorizontal: 10,
                paddingVertical: 3,
                borderRadius: 100,
            }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: s.fg }}>{s.label}</Text>
        </View>
    );
}
