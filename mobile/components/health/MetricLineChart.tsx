// Fase 14d — Gráfico de linha SVG com baseline tracejada + área gradient.
// Adapta light/dark via useV2Colors. Renderiza últimos 7/30/90 pontos.
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Line, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useV2Colors, type V2Palette } from '../../hooks/useV2Colors';

export interface MetricLineChartProps {
  samples: { date: Date; value: number | null }[];
  baseline?: number | null;
  /** Cor da linha + gradient. Default purple[600]. */
  color?: string;
  height?: number;
}

const CHART_HEIGHT_DEFAULT = 140;
const HORIZONTAL_PADDING = 4;

export function MetricLineChart({
  samples,
  baseline,
  color,
  height = CHART_HEIGHT_DEFAULT,
}: MetricLineChartProps) {
  const colors = useV2Colors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const lineColor = color ?? colors.purple[600];

  // Estado vazio
  const valid = samples.filter((s): s is { date: Date; value: number } => s.value != null && Number.isFinite(s.value));
  if (valid.length < 2) {
    return (
      <View style={[styles.emptyWrap, { height }]}>
        <Text style={styles.emptyText}>Sem dados suficientes pra esse período</Text>
      </View>
    );
  }

  const values = valid.map((s) => s.value);
  const minValue = Math.min(...values, baseline ?? Infinity);
  const maxValue = Math.max(...values, baseline ?? -Infinity);
  const range = Math.max(1, maxValue - minValue);
  // Padding visual no eixo Y (5% top/bottom)
  const yPadding = range * 0.1;
  const yMin = minValue - yPadding;
  const yMax = maxValue + yPadding;
  const yRange = yMax - yMin;

  const widthFraction = (idx: number) => {
    if (valid.length === 1) return 0.5;
    return idx / (valid.length - 1);
  };

  // Construir path string via porcentagens (Svg viewport-based)
  // Vamos usar viewBox "0 0 100 100" e a height vem do prop.
  const chartViewBoxWidth = 100;
  const chartViewBoxHeight = 100;

  const points = valid.map((s, i) => ({
    x: HORIZONTAL_PADDING + widthFraction(i) * (chartViewBoxWidth - HORIZONTAL_PADDING * 2),
    y: chartViewBoxHeight - ((s.value - yMin) / yRange) * chartViewBoxHeight,
  }));

  const linePath = points
    .map((p, i) => (i === 0 ? `M ${p.x.toFixed(2)} ${p.y.toFixed(2)}` : `L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`))
    .join(' ');

  const areaPath =
    linePath +
    ` L ${points[points.length - 1].x.toFixed(2)} ${chartViewBoxHeight}` +
    ` L ${points[0].x.toFixed(2)} ${chartViewBoxHeight} Z`;

  const baselineY =
    baseline != null && Number.isFinite(baseline)
      ? chartViewBoxHeight - ((baseline - yMin) / yRange) * chartViewBoxHeight
      : null;

  const lastPoint = points[points.length - 1];

  return (
    <View style={[styles.wrap, { height }]}>
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${chartViewBoxWidth} ${chartViewBoxHeight}`}
        preserveAspectRatio="none"
      >
        <Defs>
          <LinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={lineColor} stopOpacity="0.32" />
            <Stop offset="1" stopColor={lineColor} stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {/* Área degradê sob a linha */}
        <Path d={areaPath} fill="url(#areaGrad)" />

        {/* Baseline tracejada */}
        {baselineY !== null && (
          <Line
            x1={0}
            y1={baselineY}
            x2={chartViewBoxWidth}
            y2={baselineY}
            stroke={colors.text.quaternary}
            strokeWidth={0.5}
            strokeDasharray="2,2"
            opacity={0.7}
          />
        )}

        {/* Linha principal */}
        <Path
          d={linePath}
          stroke={lineColor}
          strokeWidth={1.5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />

        {/* Ponto destacado (hoje) */}
        <Circle cx={lastPoint.x} cy={lastPoint.y} r={2.4} fill={lineColor} />
        <Circle cx={lastPoint.x} cy={lastPoint.y} r={4.8} fill={lineColor} opacity={0.18} />
      </Svg>
    </View>
  );
}

function createStyles(c: V2Palette) {
  return StyleSheet.create({
    wrap: {
      width: '100%',
    },
    emptyWrap: {
      width: '100%',
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 12,
      color: c.text.tertiary,
    },
  });
}
