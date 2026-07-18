/**
 * KPICard — composite card pra dashboard. Top border tinted + ícone + número + delta + sparkline.
 *
 * Uses react-native-svg pra desenhar o sparkline (path quadrático suavizado, fill gradient transparente).
 *
 * Tokens: shared/tokens/v2.
 */
import React, { useMemo } from 'react';
import { Platform, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Path, Stop } from 'react-native-svg';
import { TrendingUp, TrendingDown } from 'lucide-react-native';
import { v2 } from '@kinevo/shared/tokens';
import { useV2Colors } from '../../hooks/useV2Colors';
import { toRgba } from '../../lib/brandColor';

const { spacing, radius, shadows } = v2;

export type KPIAccent = 'purple' | 'success' | 'warning' | 'info' | 'neutral';

export interface KPIDelta {
    direction: 'up' | 'down';
    label: string;
}

export interface KPICardProps {
    label: string;
    value: string;
    valueSub?: string;
    icon: React.ReactNode;
    accent: KPIAccent;
    delta?: KPIDelta;
    /**
     * Série pra sparkline. Quando ausente ou com menos de 2 pontos
     * válidos, e sem `delta`, a bottom row do card é omitida — o
     * card fica naturalmente compacto (top row + value).
     */
    data?: number[];
    accessibilityLabel?: string;
    style?: StyleProp<ViewStyle>;
}

const ACCENT_MAP: Record<Exclude<KPIAccent, 'neutral' | 'purple'>, { fg: string; bg: string }> = {
    success: { fg: '#10B981', bg: 'rgba(16,185,129,0.10)' },
    warning: { fg: '#F59E0B', bg: 'rgba(245,158,11,0.10)' },
    info: { fg: '#3B82F6', bg: 'rgba(59,130,246,0.10)' },
};

function nativeShadow(token: typeof shadows.xs) {
    return Platform.OS === 'ios' ? token.ios : token.android;
}

/**
 * Converte uma série numérica em um path SVG suave (quadrático).
 * Retorna `{ line, fill }`. `fill` fecha o path no eixo X pra preencher debaixo da linha.
 */
function pointsToPath(rawData: number[], w: number, h: number): { line: string; fill: string } | null {
    const data = rawData.filter((n) => Number.isFinite(n));
    if (data.length < 2) return null;

    const min = Math.min(...data);
    const max = Math.max(...data);
    const span = max - min || 1;

    const padY = 2;
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
    return { line, fill };
}

const SPARK_W = 70;
const SPARK_H = 22;

function Sparkline({ data, color }: { data: number[]; color: string }) {
    // O componente KPICard só renderiza Sparkline quando data tem ≥2 pontos
    // válidos, então paths === null não é alcançável aqui na prática. Mantemos
    // o guard por robustez (Sparkline pode ser usado isolado no futuro).
    const paths = useMemo(() => pointsToPath(data, SPARK_W, SPARK_H), [data]);
    if (!paths) return null;

    return (
        <Svg width={SPARK_W} height={SPARK_H}>
            <Defs>
                <SvgLinearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={color} stopOpacity={0.28} />
                    <Stop offset="1" stopColor={color} stopOpacity={0} />
                </SvgLinearGradient>
            </Defs>
            <Path d={paths.fill} fill="url(#sparkFill)" />
            <Path d={paths.line} stroke={color} strokeWidth={1.5} fill="none" />
        </Svg>
    );
}

export function KPICard({
    label,
    value,
    valueSub,
    icon,
    accent,
    delta,
    data,
    accessibilityLabel,
    style,
}: KPICardProps) {
    const colors = useV2Colors();
    // Redesign (fase 5B): 'neutral' é o accent padrão de métrica — tinta sobre
    // inset, sem festa de cor; cor fica pros estados semânticos (warning etc.).
    // Accent roxo segue a marca do estúdio (rebrand via colors.purple[N]).
    const accentPair = accent === 'neutral'
        ? { fg: colors.text.secondary, bg: toRgba(colors.text.primary, 0.05) }
        : accent === 'purple'
            ? { fg: colors.purple[600], bg: toRgba(colors.purple[600], 0.10) }
            : ACCENT_MAP[accent as Exclude<KPIAccent, 'neutral' | 'purple'>];

    const a11y = accessibilityLabel
        ?? `${label}: ${value}${valueSub ?? ''}${delta ? `, variação ${delta.direction === 'up' ? 'positiva' : 'negativa'} ${delta.label}` : ''}`;

    return (
        <View
            accessibilityRole="summary"
            accessibilityLabel={a11y}
            style={[
                styles.card,
                {
                    backgroundColor: colors.surface.card,
                    borderColor: colors.border.default,
                },
                nativeShadow(shadows.xs),
                style,
            ]}
        >
            {accent !== 'neutral' && (
                <View style={[styles.topBorder, { backgroundColor: accentPair.fg, opacity: 0.6 }]} />
            )}

            <View style={styles.topRow}>
                <View style={[styles.iconBox, { backgroundColor: accentPair.bg }]}>
                    {icon}
                </View>
                <Text
                    style={[styles.label, { color: colors.text.tertiary }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.8}
                >
                    {label}
                </Text>
            </View>

            <View style={styles.valueRow}>
                <Text style={[styles.value, { color: colors.text.primary }]}>{value}</Text>
                {valueSub ? (
                    <Text style={[styles.valueSub, { color: colors.text.tertiary }]}>{valueSub}</Text>
                ) : null}
            </View>

            {(() => {
                const hasSparklineData = !!data && data.filter((n) => Number.isFinite(n)).length >= 2;
                const hasDelta = delta != null;
                if (!hasSparklineData && !hasDelta) return null;

                return (
                    <View style={styles.bottomRow}>
                        {hasDelta && delta ? (
                            <View style={styles.deltaWrap}>
                                {delta.direction === 'up' ? (
                                    <TrendingUp size={12} color={colors.semantic.success.default} strokeWidth={2.5} />
                                ) : (
                                    <TrendingDown size={12} color={colors.semantic.danger.default} strokeWidth={2.5} />
                                )}
                                <Text
                                    style={[
                                        styles.deltaText,
                                        {
                                            color:
                                                delta.direction === 'up'
                                                    ? colors.semantic.success.fg
                                                    : colors.semantic.danger.fg,
                                        },
                                    ]}
                                >
                                    {delta.label}
                                </Text>
                            </View>
                        ) : (
                            <View />
                        )}
                        {hasSparklineData ? (
                            <Sparkline data={data!} color={accentPair.fg} />
                        ) : null}
                    </View>
                );
            })()}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        borderRadius: radius.md,
        borderWidth: 1,
        padding: spacing[4],
        overflow: 'hidden',
        position: 'relative',
    },
    topBorder: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 2,
    },
    topRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[2],
    },
    iconBox: {
        width: 28,
        height: 28,
        borderRadius: radius.sm,
        alignItems: 'center',
        justifyContent: 'center',
    },
    label: {
        flexShrink: 1,
        fontFamily: 'MonaSans_700Bold',
        fontSize: 11,
        letterSpacing: 1.1,
        textTransform: 'uppercase',
    },
    valueRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        marginTop: spacing[3],
        gap: spacing[1],
    },
    value: {
        fontFamily: 'MonaSans_800ExtraBold',
        fontSize: 28,
        letterSpacing: -1.1,
        lineHeight: 32,
    },
    valueSub: {
        fontFamily: 'MonaSans_600SemiBold',
        fontSize: 14,
    },
    bottomRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        marginTop: spacing[3],
    },
    deltaWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    deltaText: {
        fontFamily: 'MonaSans_700Bold',
        fontSize: 12,
    },
});
