import React, { useState, useMemo } from "react";
import { View, Text, LayoutChangeEvent } from "react-native";
import Svg, {
    Rect,
    Line,
    Text as SvgText,
    Defs,
    LinearGradient,
    Stop,
} from "react-native-svg";
import { CalendarCheck } from "lucide-react-native";
import { colors, spacing, typography } from "@/theme";
import type { WeeklyProgress } from "../../../hooks/useStudentProgress";

const DEFAULT_CHART_HEIGHT = 160;
const PADDING = { top: 16, right: 16, bottom: 28, left: 28 };

interface Props {
    data: WeeklyProgress[];
    expectedPerWeek: number;
    chartHeight?: number;
    weeksToShow?: number;
}

export function FrequencyChart({ data, expectedPerWeek, chartHeight = DEFAULT_CHART_HEIGHT, weeksToShow = 8 }: Props) {
    const [containerWidth, setContainerWidth] = useState(0);

    const onLayout = (e: LayoutChangeEvent) => {
        setContainerWidth(e.nativeEvent.layout.width);
    };

    const displayData = data.slice(-weeksToShow);
    const hasData = displayData.some((w) => w.sessionCount > 0);

    if (!hasData) {
        return (
            <View style={cardStyle}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <CalendarCheck size={14} color={colors.info.default} />
                    <Text style={{ fontSize: typography.size.base, fontWeight: typography.weight.semibold, color: colors.text.primary }}>
                        Frequência Semanal
                    </Text>
                </View>
                <Text style={{ fontSize: typography.size.md, color: colors.text.tertiary, textAlign: "center", paddingVertical: 24 }}>
                    Nenhuma sessão registrada nas últimas 12 semanas.
                </Text>
            </View>
        );
    }

    const plotWidth = containerWidth - PADDING.left - PADDING.right;
    const plotHeight = chartHeight - PADDING.top - PADDING.bottom;

    const maxSessions = Math.max(expectedPerWeek, ...displayData.map((d) => d.sessionCount));
    const yMax = maxSessions + 1;

    const barWidth = displayData.length > 0 ? (plotWidth / displayData.length) * 0.6 : 0;
    const barGap = displayData.length > 0 ? (plotWidth / displayData.length) * 0.4 : 0;

    const xScale = (i: number) => PADDING.left + i * (barWidth + barGap) + barGap / 2;
    const yScale = (v: number) => PADDING.top + plotHeight - (v / yMax) * plotHeight;
    const barHeight = (v: number) => (v / yMax) * plotHeight;

    // Expected line Y position
    const expectedY = yScale(expectedPerWeek);

    return (
        <View style={cardStyle} onLayout={onLayout}>
            {/* Header */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <CalendarCheck size={14} color={colors.info.default} />
                    <Text style={{ fontSize: typography.size.base, fontWeight: typography.weight.semibold, color: colors.text.primary }}>
                        Frequência Semanal
                    </Text>
                </View>
                {/* Legend */}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: colors.brand.primary }} />
                        <Text style={{ fontSize: 9, color: colors.text.tertiary }}>Realizadas</Text>
                    </View>
                    {expectedPerWeek > 0 && (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                            <View style={{ width: 8, height: 1, backgroundColor: colors.text.tertiary }} />
                            <Text style={{ fontSize: 9, color: colors.text.tertiary }}>Meta</Text>
                        </View>
                    )}
                </View>
            </View>

            {containerWidth > 0 && (
                <Svg width={containerWidth} height={chartHeight}>
                    {/* Expected line */}
                    {expectedPerWeek > 0 && (
                        <Line
                            x1={PADDING.left}
                            y1={expectedY}
                            x2={containerWidth - PADDING.right}
                            y2={expectedY}
                            stroke={colors.text.tertiary}
                            strokeWidth={1}
                            strokeDasharray="4 3"
                            opacity={0.6}
                        />
                    )}

                    {/* Bars */}
                    {displayData.map((d, i) => {
                        const x = xScale(i);
                        const h = barHeight(d.sessionCount);
                        const y = PADDING.top + plotHeight - h;

                        const metGoal = expectedPerWeek > 0 && d.sessionCount >= expectedPerWeek;
                        const barColor = d.sessionCount === 0
                            ? colors.background.inset
                            : metGoal
                              ? colors.brand.primary
                              : colors.warning.default;

                        return (
                            <React.Fragment key={i}>
                                {/* Bar */}
                                <Rect
                                    x={x}
                                    y={d.sessionCount > 0 ? y : PADDING.top + plotHeight - 2}
                                    width={barWidth}
                                    height={d.sessionCount > 0 ? h : 2}
                                    rx={3}
                                    fill={barColor}
                                    opacity={d.sessionCount === 0 ? 0.3 : 0.85}
                                />

                                {/* Count label above bar */}
                                {d.sessionCount > 0 && (
                                    <SvgText
                                        x={x + barWidth / 2}
                                        y={y - 4}
                                        textAnchor="middle"
                                        fontSize={9}
                                        fontWeight="600"
                                        fill={barColor}
                                    >
                                        {d.sessionCount}
                                    </SvgText>
                                )}

                                {/* X label */}
                                {(displayData.length <= 8 || i % 2 === 0 || i === displayData.length - 1) && (
                                    <SvgText
                                        x={x + barWidth / 2}
                                        y={chartHeight - 6}
                                        textAnchor="middle"
                                        fontSize={9}
                                        fill={colors.text.tertiary}
                                    >
                                        {d.weekLabel}
                                    </SvgText>
                                )}
                            </React.Fragment>
                        );
                    })}
                </Svg>
            )}
        </View>
    );
}

const cardStyle = {
    backgroundColor: colors.background.card,
    borderRadius: 14,
    padding: spacing.lg,
} as const;
