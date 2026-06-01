/**
 * KPRCard — personal record com progression sparkline.
 *
 * `recent=true` (PR batido em < 7 dias) ativa:
 *   - bg gradient gold sutil
 *   - border gold
 *   - shadow gold glow
 *   - sparkline em gold
 *   - badge "RECENTE"
 *
 * Sparkline reusa o padrão do KPICard (path quadrático suavizado + fill gradient).
 * Último ponto destacado com Circle r=4 na cor da linha.
 *
 * Estado vazio: sem `data` ou < 2 pontos válidos, sparkline omitido — card fica compacto.
 *
 * Tokens: shared/tokens/v2 via useV2Colors.
 */
import React, { useMemo } from 'react';
import { Platform, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Path, Stop, Circle } from 'react-native-svg';
import { v2 } from '@kinevo/shared/tokens';
import { PressableScale } from '../../shared/PressableScale';
import { useV2Colors, useIsDark } from '../../../hooks/useV2Colors';

const { spacing, radius } = v2;

export interface KPRCardProps {
    exercise: string;
    value: number;
    unit?: 'kg' | 'lb' | 'reps' | string;
    delta?: { amount: number; sinceDate: Date };
    recent?: boolean;
    data?: number[];
    onPress?: () => void;
    accessibilityLabel?: string;
    style?: StyleProp<ViewStyle>;
}

const SPARK_W = 110;
const SPARK_H = 36;

function pointsToPath(rawData: number[], w: number, h: number) {
    const data = rawData.filter((n) => Number.isFinite(n));
    if (data.length < 2) return null;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const span = max - min || 1;
    const padY = 4;
    const innerH = h - padY * 2;

    const points = data.map((value, i) => {
        const x = (i / (data.length - 1)) * w;
        const y = padY + innerH - ((value - min) / span) * innerH;
        return [x, y] as const;
    });

    let line = `M ${points[0][0].toFixed(2)} ${points[0][1].toFixed(2)}`;
    for (let i = 1; i < points.length; i++) {
        const [px, py] = points[i - 1];
        const [cx, cy] = points[i];
        const midX = (px + cx) / 2;
        const midY = (py + cy) / 2;
        line += ` Q ${px.toFixed(2)} ${py.toFixed(2)} ${midX.toFixed(2)} ${midY.toFixed(2)}`;
        if (i === points.length - 1) {
            line += ` T ${cx.toFixed(2)} ${cy.toFixed(2)}`;
        }
    }
    const fill = `${line} L ${w.toFixed(2)} ${h.toFixed(2)} L 0 ${h.toFixed(2)} Z`;
    const last = points[points.length - 1];
    return { line, fill, lastX: last[0], lastY: last[1] };
}

function formatDate(date: Date): string {
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}`;
}

export function KPRCard({
    exercise,
    value,
    unit = 'kg',
    delta,
    recent,
    data,
    onPress,
    accessibilityLabel,
    style,
}: KPRCardProps) {
    const colors = useV2Colors();
    const isDark = useIsDark();

    const validData = useMemo(() => (data ?? []).filter((n) => Number.isFinite(n)), [data]);
    const sparkPath = useMemo(() => pointsToPath(validData, SPARK_W, SPARK_H), [validData]);

    const lineColor = recent ? '#F59E0B' : sparkPath ? colors.purple[600] : colors.neutral[400];

    const a11y =
        accessibilityLabel
        ?? `${exercise}: ${value} ${unit}${
            delta ? `, ${delta.amount > 0 ? 'mais' : 'menos'} ${Math.abs(delta.amount)}${unit} desde ${formatDate(delta.sinceDate)}` : ''
        }${recent ? ', PR recente' : ''}`;

    const cardBg = colors.surface.card;
    const cardBorder = recent
        ? 'rgba(245,158,11,0.30)'
        : colors.border.default;

    const gradColors: [string, string] = recent
        ? isDark
            ? ['rgba(245,158,11,0.10)', 'rgba(245,158,11,0.02)']
            : [cardBg, '#FFF8EB']
        : [cardBg, cardBg];

    const glow = recent
        ? Platform.OS === 'ios'
            ? {
                  shadowColor: '#F59E0B',
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.18,
                  shadowRadius: 14,
              }
            : { elevation: 4 }
        : Platform.OS === 'ios'
          ? {
                shadowColor: '#09090B',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.04,
                shadowRadius: 2,
            }
          : { elevation: 1 };

    const Inner = (
        <LinearGradient
            colors={gradColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.card, { borderColor: cardBorder }]}
        >
            <View style={styles.topRow}>
                <Text style={[styles.exercise, { color: colors.text.primary }]} numberOfLines={1}>
                    {exercise}
                </Text>
                {recent ? (
                    <View style={styles.recentBadge}>
                        <Text style={styles.recentBadgeText}>RECENTE</Text>
                    </View>
                ) : null}
            </View>

            <View style={styles.bodyRow}>
                <View style={styles.valueWrap}>
                    <Text style={[styles.value, { color: colors.text.primary }]}>{value}</Text>
                    <Text style={[styles.unit, { color: colors.text.tertiary }]}>{unit}</Text>
                </View>

                {sparkPath ? (
                    <Svg width={SPARK_W} height={SPARK_H}>
                        <Defs>
                            <SvgLinearGradient id="prSparkFill" x1="0" y1="0" x2="0" y2="1">
                                <Stop offset="0" stopColor={lineColor} stopOpacity={0.32} />
                                <Stop offset="1" stopColor={lineColor} stopOpacity={0} />
                            </SvgLinearGradient>
                        </Defs>
                        <Path d={sparkPath.fill} fill="url(#prSparkFill)" />
                        <Path d={sparkPath.line} stroke={lineColor} strokeWidth={1.8} fill="none" />
                        <Circle cx={sparkPath.lastX} cy={sparkPath.lastY} r={4} fill={lineColor} />
                    </Svg>
                ) : null}
            </View>

            {delta ? (
                <Text style={[styles.delta, { color: recent ? '#B45309' : colors.text.tertiary }]}>
                    {delta.amount > 0 ? '+' : ''}{delta.amount}{unit} desde {formatDate(delta.sinceDate)}
                </Text>
            ) : null}
        </LinearGradient>
    );

    const wrapStyle = [styles.shadowWrap, glow, style];

    if (onPress) {
        return (
            <PressableScale
                onPress={onPress}
                pressScale={0.99}
                style={wrapStyle}
                accessibilityRole="button"
                accessibilityLabel={a11y}
            >
                {Inner}
            </PressableScale>
        );
    }
    return (
        <View
            style={wrapStyle}
            accessibilityRole="summary"
            accessibilityLabel={a11y}
            accessible
        >
            {Inner}
        </View>
    );
}

const styles = StyleSheet.create({
    shadowWrap: {
        borderRadius: radius.md,
    },
    card: {
        borderRadius: radius.md,
        borderWidth: 1,
        padding: spacing[4],
        overflow: 'hidden',
    },
    topRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing[2],
    },
    exercise: {
        fontFamily: 'PlusJakartaSans_700Bold',
        fontSize: 14,
        flex: 1,
    },
    recentBadge: {
        backgroundColor: 'rgba(245,158,11,0.18)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: radius.sm,
    },
    recentBadgeText: {
        fontFamily: 'PlusJakartaSans_800ExtraBold',
        fontSize: 9,
        letterSpacing: 0.8,
        color: '#B45309',
    },
    bodyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: spacing[3],
    },
    valueWrap: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 4,
    },
    value: {
        fontFamily: 'PlusJakartaSans_800ExtraBold',
        fontSize: 30,
        letterSpacing: -1.2,
        lineHeight: 34,
    },
    unit: {
        fontFamily: 'PlusJakartaSans_600SemiBold',
        fontSize: 13,
    },
    delta: {
        fontFamily: 'PlusJakartaSans_600SemiBold',
        fontSize: 10.5,
        marginTop: spacing[2],
    },
});
