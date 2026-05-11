import React, { useState, useMemo } from "react";
import { View, Text, LayoutChangeEvent } from "react-native";
import Svg, {
    Path,
    Circle,
    Line,
    Defs,
    LinearGradient,
    Stop,
    Text as SvgText,
} from "react-native-svg";
import { Dumbbell, TrendingUp, TrendingDown, Minus } from "lucide-react-native";
import { spacing, typography } from "@/theme";
import { useV2Colors } from "@/hooks/useV2Colors";
import type { WeeklyProgress, ProgressSummary } from "../../../hooks/useStudentProgress";

const DEFAULT_CHART_HEIGHT = 200;
const PADDING = { top: 24, right: 16, bottom: 28, left: 44 };

function formatTonnage(t: number): string {
    if (t >= 1000) return `${(t / 1000).toFixed(1)}t`;
    return `${Math.round(t)}kg`;
}

interface Props {
    data: WeeklyProgress[];
    summary: ProgressSummary;
    chartHeight?: number;
    weeksToShow?: number;
}

export function TonnageChart({ data, summary, chartHeight = DEFAULT_CHART_HEIGHT, weeksToShow = 8 }: Props) {
    const colors = useV2Colors();
    const [containerWidth, setContainerWidth] = useState(0);
    const cardStyle = {
        backgroundColor: colors.surface.card,
        borderRadius: 14,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border.default,
    } as const;

    const onLayout = (e: LayoutChangeEvent) => {
        setContainerWidth(e.nativeEvent.layout.width);
    };

    // Filter to weeks that have data or are within the range
    const chartData = useMemo(() => {
        // Find first week with data
        const firstIdx = data.findIndex((w) => w.totalTonnage > 0);
        if (firstIdx === -1) return [];
        const sliced = data.slice(firstIdx);
        return sliced.slice(-weeksToShow);
    }, [data, weeksToShow]);

    const hasEnoughData = chartData.filter((w) => w.totalTonnage > 0).length >= 2;

    const trendColor =
        summary.tonnageTrendDirection === "up"
            ? colors.semantic.success.default
            : summary.tonnageTrendDirection === "down"
              ? colors.semantic.danger.default
              : colors.text.tertiary;

    const TrendIcon =
        summary.tonnageTrendDirection === "up"
            ? TrendingUp
            : summary.tonnageTrendDirection === "down"
              ? TrendingDown
              : Minus;

    if (!hasEnoughData) {
        return (
            <View style={cardStyle}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <Dumbbell size={14} color={colors.purple[600]} />
                    <Text style={{ fontSize: typography.size.base, fontWeight: typography.weight.semibold, color: colors.text.primary }}>
                        Progressão de Carga
                    </Text>
                </View>
                <Text style={{ fontSize: typography.size.md, color: colors.text.tertiary, textAlign: "center", paddingVertical: 24 }}>
                    Dados insuficientes para exibir o gráfico.{"\n"}Necessário no mínimo 2 semanas com treinos.
                </Text>
            </View>
        );
    }

    const plotWidth = containerWidth - PADDING.left - PADDING.right;
    const plotHeight = chartHeight - PADDING.top - PADDING.bottom;

    const maxTonnage = Math.max(...chartData.map((d) => d.totalTonnage));
    const yMax = maxTonnage * 1.15; // 15% headroom

    const xScale = (i: number) =>
        PADDING.left + (chartData.length > 1 ? (i / (chartData.length - 1)) * plotWidth : plotWidth / 2);
    const yScale = (v: number) =>
        PADDING.top + plotHeight - (yMax > 0 ? (v / yMax) * plotHeight : 0);

    // Path for line
    const linePoints = chartData.map((d, i) => ({ x: xScale(i), y: yScale(d.totalTonnage) }));
    const pathD = linePoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");

    // Area path
    const areaD = `${pathD} L ${linePoints[linePoints.length - 1].x.toFixed(1)} ${(PADDING.top + plotHeight).toFixed(1)} L ${linePoints[0].x.toFixed(1)} ${(PADDING.top + plotHeight).toFixed(1)} Z`;

    // Y-axis grid lines (4 lines)
    const gridLines = [0, 0.25, 0.5, 0.75, 1].map((pct) => ({
        y: PADDING.top + plotHeight * (1 - pct),
        label: formatTonnage(yMax * pct),
    }));

    return (
        <View style={cardStyle} onLayout={onLayout}>
            {/* Header */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Dumbbell size={14} color={colors.purple[600]} />
                    <Text style={{ fontSize: typography.size.base, fontWeight: typography.weight.semibold, color: colors.text.primary }}>
                        Progressão de Carga
                    </Text>
                </View>
                {summary.tonnageTrend !== 0 && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                        <TrendIcon size={12} color={trendColor} />
                        <Text style={{ fontSize: typography.size.xs, fontWeight: typography.weight.semibold, color: trendColor }}>
                            {summary.tonnageTrend > 0 ? "+" : ""}
                            {summary.tonnageTrend.toFixed(1)}%
                        </Text>
                    </View>
                )}
            </View>

            {containerWidth > 0 && (
                <Svg width={containerWidth} height={chartHeight}>
                    <Defs>
                        <LinearGradient id="tonnageGrad" x1="0" y1="0" x2="0" y2="1">
                            <Stop offset="0%" stopColor={colors.purple[600]} stopOpacity={0.2} />
                            <Stop offset="100%" stopColor={colors.purple[600]} stopOpacity={0} />
                        </LinearGradient>
                    </Defs>

                    {/* Grid lines */}
                    {gridLines.map((g, i) => (
                        <React.Fragment key={i}>
                            <Line
                                x1={PADDING.left}
                                y1={g.y}
                                x2={containerWidth - PADDING.right}
                                y2={g.y}
                                stroke={colors.border.default}
                                strokeWidth={0.5}
                            />
                            {i > 0 && (
                                <SvgText
                                    x={PADDING.left - 6}
                                    y={g.y + 3}
                                    textAnchor="end"
                                    fontSize={9}
                                    fill={colors.text.tertiary}
                                >
                                    {g.label}
                                </SvgText>
                            )}
                        </React.Fragment>
                    ))}

                    {/* Area fill */}
                    <Path d={areaD} fill="url(#tonnageGrad)" />

                    {/* Line */}
                    <Path
                        d={pathD}
                        stroke={colors.purple[600]}
                        strokeWidth={2.5}
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />

                    {/* Data points */}
                    {linePoints.map((p, i) => (
                        <Circle
                            key={i}
                            cx={p.x}
                            cy={p.y}
                            r={chartData[i].totalTonnage > 0 ? 4 : 0}
                            fill={colors.purple[600]}
                            stroke={colors.surface.card}
                            strokeWidth={1.5}
                        />
                    ))}

                    {/* X axis labels */}
                    {chartData.map((d, i) => {
                        // Show every 2nd label if too many
                        const showLabel = chartData.length <= 8 || i % 2 === 0 || i === chartData.length - 1;
                        if (!showLabel) return null;
                        return (
                            <SvgText
                                key={i}
                                x={xScale(i)}
                                y={chartHeight - 6}
                                textAnchor="middle"
                                fontSize={9}
                                fill={colors.text.tertiary}
                            >
                                {d.weekLabel}
                            </SvgText>
                        );
                    })}
                </Svg>
            )}

            {/* Summary row */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: colors.border.default }}>
                <View>
                    <Text style={{ fontSize: 9, fontWeight: typography.weight.semibold, color: colors.text.tertiary, textTransform: "uppercase" }}>
                        Primeira sem.
                    </Text>
                    <Text style={{ fontSize: typography.size.base, fontWeight: typography.weight.bold, color: colors.text.primary }}>
                        {formatTonnage(chartData.find((w) => w.totalTonnage > 0)?.totalTonnage ?? 0)}
                    </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ fontSize: 9, fontWeight: typography.weight.semibold, color: colors.text.tertiary, textTransform: "uppercase" }}>
                        Última sem.
                    </Text>
                    <Text style={{ fontSize: typography.size.base, fontWeight: typography.weight.bold, color: colors.text.primary }}>
                        {formatTonnage(chartData[chartData.length - 1]?.totalTonnage ?? 0)}
                    </Text>
                </View>
            </View>
        </View>
    );
}

