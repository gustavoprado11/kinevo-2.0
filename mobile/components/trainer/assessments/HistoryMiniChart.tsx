import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Polyline, Circle } from 'react-native-svg';
import { colors } from '@/theme';

export interface HistoryPoint {
    completed_at: string;       // ISO
    value: number;
}

interface Props {
    points: HistoryPoint[];
    label: string;
    unit?: string;
    /** Optional fixed Y-axis bounds; auto-fits when omitted. */
    min?: number;
    max?: number;
}

const W = 280;
const H = 70;
const PAD_X = 8;
const PAD_Y = 10;

/**
 * Tiny sparkline of historical points. Uses native SVG (no recharts on
 * mobile). Renders a soft polyline + circle markers; empty state renders
 * a "Sem histórico" placeholder.
 */
export function HistoryMiniChart({ points, label, unit, min, max }: Props) {
    if (!points || points.length === 0) {
        return (
            <View
                style={{
                    backgroundColor: colors.background.card,
                    borderRadius: 14,
                    padding: 16,
                    height: 100,
                    justifyContent: 'center',
                    alignItems: 'center',
                }}>
                <Text style={{ fontSize: 13, color: colors.text.tertiary }}>
                    Sem histórico ainda
                </Text>
            </View>
        );
    }

    const values = points.map((p) => p.value);
    const lo = min ?? Math.min(...values);
    const hi = max ?? Math.max(...values);
    const range = hi - lo || 1;

    const last = points[points.length - 1]!;

    const pts = points.map((p, i) => {
        const x = PAD_X + (i * (W - 2 * PAD_X)) / Math.max(points.length - 1, 1);
        const y = PAD_Y + (1 - (p.value - lo) / range) * (H - 2 * PAD_Y);
        return { x, y };
    });

    const polyline = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

    return (
        <View
            style={{
                backgroundColor: colors.background.card,
                borderRadius: 14,
                padding: 16,
                gap: 6,
            }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text
                    style={{
                        fontSize: 12,
                        fontWeight: '700',
                        color: colors.text.tertiary,
                        textTransform: 'uppercase',
                        letterSpacing: 1.2,
                    }}>
                    {label}
                </Text>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text.primary }}>
                    {last.value.toFixed(1)}
                    {unit ?? ''}
                </Text>
            </View>
            <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
                <Polyline
                    points={polyline}
                    fill="none"
                    stroke={colors.brand.primary}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                />
                {pts.map((p, i) => (
                    <Circle
                        key={i}
                        cx={p.x}
                        cy={p.y}
                        r={2.5}
                        fill={colors.brand.primary}
                    />
                ))}
            </Svg>
        </View>
    );
}
