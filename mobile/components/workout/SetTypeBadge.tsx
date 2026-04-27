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

interface SetTypeBadgeProps {
    setType: SetType;
    /** When `compact`, renders only the icon dot (used inside SetRow alongside #). */
    compact?: boolean;
}

interface BadgeStyle {
    label: string;
    bg: string;
    fg: string;
    Icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
}

const STYLE_BY_TYPE: Record<Exclude<SetType, 'normal'>, BadgeStyle> = {
    warmup:  { label: 'Aq.',    bg: 'rgba(148, 163, 184, 0.18)', fg: '#475569', Icon: Flame },
    top:     { label: 'Top',    bg: 'rgba(249, 115, 22, 0.16)',  fg: '#c2410c', Icon: ArrowUp },
    backoff: { label: 'Back',   bg: 'rgba(100, 116, 139, 0.16)', fg: '#475569', Icon: ArrowDown },
    drop:    { label: 'Drop',   bg: 'rgba(239, 68, 68, 0.16)',   fg: '#b91c1c', Icon: ChevronsDown },
    failure: { label: 'Falha',  bg: 'rgba(127, 29, 29, 0.18)',   fg: '#7f1d1d', Icon: Zap },
    cluster: { label: 'Cluster',bg: 'rgba(124, 58, 237, 0.16)',  fg: '#6d28d9', Icon: Layers },
    amrap:   { label: 'AMRAP',  bg: 'rgba(59, 130, 246, 0.16)',  fg: '#1d4ed8', Icon: InfinityIcon },
};

export function SetTypeBadge({ setType, compact }: SetTypeBadgeProps) {
    if (setType === 'normal') return null;
    const style = STYLE_BY_TYPE[setType];
    if (!style) return null;
    const { label, bg, fg, Icon } = style;

    if (compact) {
        return (
            <View
                accessibilityLabel={label}
                style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    backgroundColor: bg,
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <Icon size={12} color={fg} strokeWidth={2.4} />
            </View>
        );
    }

    return (
        <View
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 6,
                backgroundColor: bg,
                gap: 3,
            }}
        >
            <Icon size={11} color={fg} strokeWidth={2.4} />
            <Text style={{ fontSize: 10, fontWeight: '700', color: fg }}>{label}</Text>
        </View>
    );
}
