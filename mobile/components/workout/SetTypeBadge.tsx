import React from 'react';
import { View, Text } from 'react-native';
import {
    Flame,
    ArrowUp,
    ArrowDown,
    ChevronsDown,
    Zap,
    Layers,
    Infinity as InfinityIcon,
} from 'lucide-react-native';
import type { SetType } from '@kinevo/shared/types/prescription';
import {
    SET_TYPE_LABELS,
    SET_TYPE_BADGE_LABELS,
} from '@kinevo/shared/lib/prescription/set-type-labels';

interface SetTypeBadgeProps {
    setType: SetType;
    /** When `compact`, renders only the icon dot (used to the left of the
     *  set number — saves horizontal space inside the row). */
    compact?: boolean;
}

interface BadgeStyle {
    bg: string;
    fg: string;
    Icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
}

const STYLE_BY_TYPE: Record<Exclude<SetType, 'normal'>, BadgeStyle> = {
    warmup:  { bg: 'rgba(148, 163, 184, 0.18)', fg: '#57534E', Icon: Flame },
    top:     { bg: 'rgba(249, 115, 22, 0.16)',  fg: '#c2410c', Icon: ArrowUp },
    backoff: { bg: 'rgba(14, 165, 233, 0.14)',  fg: '#0369a1', Icon: ArrowDown },
    drop:    { bg: 'rgba(244, 63, 94, 0.16)',   fg: '#be123c', Icon: ChevronsDown },
    failure: { bg: 'rgba(127, 29, 29, 0.20)',   fg: '#7f1d1d', Icon: Zap },
    cluster: { bg: 'rgba(124, 58, 237, 0.16)',  fg: '#6d28d9', Icon: Layers },
    amrap:   { bg: 'rgba(59, 130, 246, 0.16)',  fg: '#1d4ed8', Icon: InfinityIcon },
};

export function SetTypeBadge({ setType, compact }: SetTypeBadgeProps) {
    if (setType === 'normal') return null;
    const style = STYLE_BY_TYPE[setType];
    if (!style) return null;
    const { bg, fg, Icon } = style;
    const badgeText = SET_TYPE_BADGE_LABELS[setType];
    const fullLabel = SET_TYPE_LABELS[setType];

    if (compact) {
        return (
            <View
                accessibilityLabel={fullLabel}
                style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    backgroundColor: bg,
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <Icon size={13} color={fg} strokeWidth={2.4} />
            </View>
        );
    }

    return (
        <View
            accessibilityLabel={fullLabel}
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 6,
                paddingVertical: 3,
                borderRadius: 6,
                backgroundColor: bg,
                gap: 3,
            }}
        >
            <Icon size={11} color={fg} strokeWidth={2.5} />
            <Text style={{ fontSize: 10.5, fontWeight: '700', color: fg, letterSpacing: 0.1 }}>
                {badgeText}
            </Text>
        </View>
    );
}
