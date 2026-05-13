// Fase 14d — Tela detalhe de uma métrica de saúde.
// `/health/sleep | hr_resting | steps | hrv` — variação 4-way.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useV2Colors, type V2Palette } from '../../hooks/useV2Colors';
import { HealthDetailHeader } from '../../components/health/HealthDetailHeader';
import { HeroStatBlock } from '../../components/health/HeroStatBlock';
import { MetricLineChart } from '../../components/health/MetricLineChart';
import { MiniStat } from '../../components/health/MiniStat';
import { PeriodTabs, type PeriodValue } from '../../components/health/PeriodTabs';
import { EduCard } from '../../components/health/EduCard';
import { EDUCATION, type MetricKind } from '../../lib/healthInsights/education';

const PERIOD_DAYS: Record<PeriodValue, number> = { '7d': 7, '30d': 30, '90d': 90 };

const METRIC_TITLE: Record<MetricKind, string> = {
  sleep: 'Sono',
  hr_resting: 'FC repouso',
  steps: 'Passos',
  hrv: 'HRV',
};

const METRIC_COLOR: Record<MetricKind, string> = {
  sleep: '#6366F1',
  hr_resting: '#EF4444',
  steps: '#22C55E',
  hrv: '#06B6D4',
};

const METRIC_UNIT: Record<MetricKind, string> = {
  sleep: 'h',
  hr_resting: 'bpm',
  steps: '',
  hrv: 'ms',
};

const METRIC_EYEBROW: Record<MetricKind, string> = {
  sleep: 'Sono · ontem',
  hr_resting: 'HR repouso · hoje',
  steps: 'Passos · hoje',
  hrv: 'HRV · hoje',
};

interface DataPoint {
  date: Date;
  value: number | null;
}

interface MetricSeries {
  points: DataPoint[];
  baseline: number | null;
  todayValue: number | null;
  todayEfficiency?: number | null;
  todayStages?: {
    deep: number | null;
    rem: number | null;
    light: number | null;
    awake: number | null;
  };
}

function isValidMetric(m: string | undefined): m is MetricKind {
  return m === 'sleep' || m === 'hr_resting' || m === 'steps' || m === 'hrv';
}

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function avg(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

async function getStudentId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: student } = await supabase
    .from('students' as any).select('id').eq('auth_user_id', user.id).maybeSingle();
  return (student as any)?.id ?? null;
}

async function fetchSeries(metric: MetricKind, days: number): Promise<MetricSeries> {
  const studentId = await getStudentId();
  if (!studentId) {
    return { points: [], baseline: null, todayValue: null };
  }

  const today = new Date();
  const startDate = new Date(today.getTime() - days * 24 * 60 * 60 * 1000);
  const startISO = toDateOnly(startDate);

  // 90 dias retroativos pra baseline (independente do period selecionado)
  const baselineStart = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
  const baselineStartISO = toDateOnly(baselineStart);

  if (metric === 'sleep') {
    const { data: rows }: any = await supabase
      .from('daily_sleep_samples' as any)
      .select('sample_date, duration_minutes, efficiency_pct, deep_minutes, rem_minutes, light_minutes, awake_minutes')
      .eq('student_id', studentId)
      .gte('sample_date', baselineStartISO)
      .order('sample_date', { ascending: true });

    const all = (rows ?? []) as Array<any>;
    const points: DataPoint[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const iso = toDateOnly(d);
      const row = all.find((r) => r.sample_date === iso);
      const minutes = row?.duration_minutes ?? null;
      points.push({ date: d, value: minutes != null ? minutes / 60 : null });
    }
    const allMinutes = all.map((r) => r.duration_minutes).filter((m: number | null): m is number => m != null && Number.isFinite(m));
    const baseline = allMinutes.length > 0 ? avg(allMinutes) / 60 : null;

    const sorted = [...all].sort((a, b) => b.sample_date.localeCompare(a.sample_date));
    const last = sorted[0];

    return {
      points,
      baseline,
      todayValue: last?.duration_minutes != null ? last.duration_minutes / 60 : null,
      todayEfficiency: last?.efficiency_pct ?? null,
      todayStages: last
        ? {
            deep: last.deep_minutes ?? null,
            rem: last.rem_minutes ?? null,
            light: last.light_minutes ?? null,
            awake: last.awake_minutes ?? null,
          }
        : undefined,
    };
  }

  if (metric === 'hr_resting') {
    const { data: rows }: any = await supabase
      .from('hr_resting_samples' as any)
      .select('sample_date, bpm')
      .eq('student_id', studentId)
      .gte('sample_date', baselineStartISO)
      .order('sample_date', { ascending: true });
    const all = (rows ?? []) as Array<{ sample_date: string; bpm: number }>;
    const points: DataPoint[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const iso = toDateOnly(d);
      const row = all.find((r) => r.sample_date === iso);
      points.push({ date: d, value: row?.bpm ?? null });
    }
    const allBpm = all.map((r) => Number(r.bpm)).filter(Number.isFinite);
    const baseline = allBpm.length > 0 ? avg(allBpm) : null;
    const sorted = [...all].sort((a, b) => b.sample_date.localeCompare(a.sample_date));
    return { points, baseline, todayValue: sorted[0]?.bpm ?? null };
  }

  if (metric === 'steps') {
    const stepsBaselineStart = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    const { data: rows }: any = await supabase
      .from('daily_activity_samples' as any)
      .select('sample_date, steps')
      .eq('student_id', studentId)
      .gte('sample_date', toDateOnly(stepsBaselineStart))
      .order('sample_date', { ascending: true });
    const all = (rows ?? []) as Array<{ sample_date: string; steps: number | null }>;
    const points: DataPoint[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const iso = toDateOnly(d);
      const row = all.find((r) => r.sample_date === iso);
      points.push({ date: d, value: row?.steps ?? null });
    }
    const allSteps = all.map((r) => r.steps).filter((s): s is number => s != null && Number.isFinite(s));
    const baseline = allSteps.length > 0 ? avg(allSteps) : null;
    const sorted = [...all].sort((a, b) => b.sample_date.localeCompare(a.sample_date));
    return { points, baseline, todayValue: sorted[0]?.steps ?? null };
  }

  // hrv
  const { data: rows }: any = await supabase
    .from('hrv_samples' as any)
    .select('sample_date, value_ms')
    .eq('student_id', studentId)
    .gte('sample_date', baselineStartISO)
    .order('sample_date', { ascending: true });
  const all = (rows ?? []) as Array<{ sample_date: string; value_ms: number }>;
  const points: DataPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
    const iso = toDateOnly(d);
    const row = all.find((r) => r.sample_date === iso);
    points.push({ date: d, value: row?.value_ms ?? null });
  }
  const allMs = all.map((r) => Number(r.value_ms)).filter(Number.isFinite);
  const baseline = allMs.length > 0 ? avg(allMs) : null;
  const sorted = [...all].sort((a, b) => b.sample_date.localeCompare(a.sample_date));
  return { points, baseline, todayValue: sorted[0]?.value_ms ?? null };
}

function formatHours(hours: number | null | undefined): string | null {
  if (hours == null || !Number.isFinite(hours)) return null;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h${String(m).padStart(2, '0')}`;
}

function formatMinutes(min: number | null | undefined): string | null {
  if (min == null || !Number.isFinite(min)) return null;
  return formatHours(min / 60);
}

export default function HealthMetricDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ metric?: string }>();
  const colors = useV2Colors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const metricParam = typeof params.metric === 'string' ? params.metric : '';
  const metric: MetricKind = isValidMetric(metricParam) ? metricParam : 'sleep';

  const [period, setPeriod] = useState<PeriodValue>('30d');
  const [series, setSeries] = useState<MetricSeries | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadSeries = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await fetchSeries(metric, PERIOD_DAYS[period]);
      setSeries(result);
    } finally {
      setIsLoading(false);
    }
  }, [metric, period]);

  useEffect(() => {
    void loadSeries();
  }, [loadSeries]);

  const color = METRIC_COLOR[metric];
  const unit = METRIC_UNIT[metric];

  // Hero values
  const heroValue = useMemo(() => {
    if (series?.todayValue == null) return null;
    if (metric === 'sleep') {
      return formatHours(series.todayValue);
    }
    if (metric === 'steps') {
      return Math.round(series.todayValue).toLocaleString('pt-BR');
    }
    return Math.round(series.todayValue);
  }, [metric, series]);

  // Delta vs baseline
  const deltaInfo = useMemo(() => {
    if (series?.todayValue == null || series.baseline == null) return null;
    const delta = series.todayValue - series.baseline;
    if (metric === 'sleep') {
      const sign = delta >= 0 ? '+' : '';
      const formatted = formatHours(Math.abs(delta));
      const severity = delta >= 0 ? 'positive' : 'caution';
      return {
        text: `${sign}${delta < 0 ? '-' : ''}${formatted} vs média`,
        severity: severity as 'positive' | 'caution',
      };
    }
    if (metric === 'hr_resting') {
      const sign = delta >= 0 ? '+' : '';
      const severity = delta <= 0 ? 'positive' : 'caution';
      return {
        text: `${sign}${Math.round(delta)} bpm vs baseline`,
        severity: severity as 'positive' | 'caution',
      };
    }
    if (metric === 'steps') {
      const pct = series.baseline > 0 ? ((delta / series.baseline) * 100) : 0;
      const sign = pct >= 0 ? '+' : '';
      const severity = pct >= 0 ? 'positive' : 'caution';
      return {
        text: `${sign}${Math.round(pct)}% vs média`,
        severity: severity as 'positive' | 'caution',
      };
    }
    // hrv
    const sign = delta >= 0 ? '+' : '';
    const severity = delta >= 0 ? 'positive' : 'caution';
    return {
      text: `${sign}${Math.round(delta)}ms vs baseline`,
      severity: severity as 'positive' | 'caution',
    };
  }, [metric, series]);

  // Mini stats (média / melhor / pior dentro do período)
  const miniStats = useMemo(() => {
    if (!series) return null;
    const validPts = series.points.filter((p): p is { date: Date; value: number } => p.value != null);
    if (validPts.length === 0) return null;
    const values = validPts.map((p) => p.value);
    const avgValue = avg(values);
    // "Melhor" depende da métrica:
    // sleep / steps / hrv → maior é melhor
    // hr_resting → menor é melhor
    const isLowerBetter = metric === 'hr_resting';
    const best = isLowerBetter ? Math.min(...values) : Math.max(...values);
    const worst = isLowerBetter ? Math.max(...values) : Math.min(...values);

    const format = (v: number): string => {
      if (metric === 'sleep') return formatHours(v) ?? '–';
      if (metric === 'steps') return Math.round(v).toLocaleString('pt-BR');
      return String(Math.round(v));
    };

    return {
      avg: { value: format(avgValue), unit: metric === 'steps' ? '' : unit },
      best: { value: format(best), unit: metric === 'steps' ? '' : unit },
      worst: { value: format(worst), unit: metric === 'steps' ? '' : unit },
    };
  }, [metric, series, unit]);

  if (!isValidMetric(metricParam)) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.errorText}>Métrica desconhecida</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']}>
        <HealthDetailHeader
          title={METRIC_TITLE[metric]}
          subtitle={PERIOD_DAYS[period] + ' dias'}
          onBack={() => router.back()}
        />
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scroll}>
        <HeroStatBlock
          eyebrow={METRIC_EYEBROW[metric]}
          value={heroValue}
          unit={metric === 'sleep' ? undefined : unit}
          deltaText={deltaInfo?.text ?? null}
          deltaSeverity={deltaInfo?.severity ?? 'neutral'}
          extra={
            metric === 'sleep' && series?.todayEfficiency != null ? (
              <View style={styles.sleepExtraRow}>
                <Text style={styles.sleepExtraLabel}>Eficiência</Text>
                <Text style={styles.sleepExtraValue}>{Math.round(series.todayEfficiency)}%</Text>
              </View>
            ) : null
          }
        />

        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartLabel}>TENDÊNCIA</Text>
            <PeriodTabs value={period} onChange={setPeriod} />
          </View>
          {isLoading && !series ? (
            <View style={styles.chartLoadingWrap}>
              <ActivityIndicator size="small" color={colors.purple[400]} />
            </View>
          ) : (
            <MetricLineChart
              samples={series?.points ?? []}
              baseline={series?.baseline ?? null}
              color={color}
            />
          )}
          {series?.baseline != null && (
            <Text style={styles.baselineCaption}>
              Linha tracejada = baseline ({metric === 'sleep'
                ? formatHours(series.baseline)
                : metric === 'steps'
                  ? Math.round(series.baseline).toLocaleString('pt-BR')
                  : Math.round(series.baseline)} {metric === 'steps' ? '' : unit})
            </Text>
          )}
        </View>

        {miniStats && (
          <View style={styles.miniStatsRow}>
            <MiniStat label="Média" value={miniStats.avg.value} unit={miniStats.avg.unit || undefined} />
            <MiniStat label="Melhor" value={miniStats.best.value} unit={miniStats.best.unit || undefined} />
            <MiniStat label="Pior" value={miniStats.worst.value} unit={miniStats.worst.unit || undefined} />
          </View>
        )}

        {/* Fases do sono (slot extra) — só sleep */}
        {metric === 'sleep' && series?.todayStages && (
          <View style={styles.stagesCard}>
            <Text style={styles.chartLabel}>FASES · ONTEM</Text>
            <View style={styles.stagesRow}>
              <View style={styles.stageItem}>
                <Text style={styles.stageValue}>{formatMinutes(series.todayStages.deep) ?? '–'}</Text>
                <Text style={styles.stageLabel}>Profundo</Text>
              </View>
              <View style={styles.stageItem}>
                <Text style={styles.stageValue}>{formatMinutes(series.todayStages.rem) ?? '–'}</Text>
                <Text style={styles.stageLabel}>REM</Text>
              </View>
              <View style={styles.stageItem}>
                <Text style={styles.stageValue}>{formatMinutes(series.todayStages.light) ?? '–'}</Text>
                <Text style={styles.stageLabel}>Leve</Text>
              </View>
              <View style={styles.stageItem}>
                <Text style={styles.stageValue}>{formatMinutes(series.todayStages.awake) ?? '–'}</Text>
                <Text style={styles.stageLabel}>Acordado</Text>
              </View>
            </View>
          </View>
        )}

        <EduCard
          title={EDUCATION[metric].title}
          body={EDUCATION[metric].body}
          idealRange={EDUCATION[metric].idealRange}
        />
      </ScrollView>
    </View>
  );
}

function createStyles(c: V2Palette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.surface.canvas },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    errorText: { color: c.text.tertiary, fontSize: 14 },
    scroll: { paddingHorizontal: 16, paddingBottom: 80 },
    chartCard: {
      backgroundColor: c.surface.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: c.border.subtle,
      marginBottom: 12,
    },
    chartHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14,
    },
    chartLabel: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 1.6,
      color: c.text.tertiary,
    },
    chartLoadingWrap: { height: 140, justifyContent: 'center', alignItems: 'center' },
    baselineCaption: {
      fontSize: 11,
      color: c.text.tertiary,
      marginTop: 10,
    },
    miniStatsRow: {
      flexDirection: 'row',
      gap: 8,
    },
    stagesCard: {
      backgroundColor: c.surface.card,
      borderRadius: 16,
      padding: 16,
      marginTop: 12,
      borderWidth: 1,
      borderColor: c.border.subtle,
    },
    stagesRow: {
      flexDirection: 'row',
      marginTop: 12,
      justifyContent: 'space-between',
    },
    stageItem: { alignItems: 'center', flex: 1 },
    stageValue: {
      fontSize: 14,
      fontWeight: '700',
      color: c.text.primary,
    },
    stageLabel: {
      fontSize: 10,
      color: c.text.tertiary,
      marginTop: 3,
      fontWeight: '600',
    },
    sleepExtraRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.2)',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
    },
    sleepExtraLabel: {
      fontSize: 12,
      color: 'rgba(255,255,255,0.7)',
      fontWeight: '600',
    },
    sleepExtraValue: {
      fontSize: 14,
      color: '#FFFFFF',
      fontWeight: '700',
    },
  });
}
