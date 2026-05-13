import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Moon, Heart, Footprints, Activity, Zap } from 'lucide-react-native';
import { HealthMetricCard } from '../../components/health/HealthMetricCard';
import { SleepWeekChart } from '../../components/health/SleepWeekChart';
import { useHealthDashboard } from '../../hooks/useHealthDashboard';
import { useHealthKitSync } from '../../hooks/useHealthKitSync';
import { useHealthConnectSync } from '../../hooks/useHealthConnectSync';
import { useRouter } from 'expo-router';
import { Platform } from 'react-native';
import { toast } from '../../lib/toast';

function formatDurationHM(min: number | null | undefined): string | null {
  if (min == null) return null;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h${String(m).padStart(2, '0')}`;
}

function formatToday(): string {
  const d = new Date();
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function HealthScreen() {
  const router = useRouter();
  const { data, isLoading, refresh } = useHealthDashboard();
  const hk = useHealthKitSync();
  const hc = useHealthConnectSync();
  const syncIncremental = Platform.OS === 'ios' ? hk.syncIncremental : hc.syncIncremental;
  const isSyncing = Platform.OS === 'ios' ? hk.isLoading : hc.isLoading;
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await syncIncremental();
      if (!res.ok) {
        toast.error('Não foi possível atualizar agora', 'Tente novamente em alguns instantes.');
      }
      await refresh();
    } catch {
      toast.error('Não foi possível atualizar agora', 'Tente novamente em alguns instantes.');
    } finally {
      setRefreshing(false);
    }
  }, [syncIncremental, refresh]);

  const hasAnyConnection = (data?.connections.length ?? 0) > 0;
  const hasAnyData =
    !!data?.sleepYesterday ||
    data?.hrRestingToday != null ||
    data?.stepsToday != null ||
    data?.hrvToday != null;

  // Estado vazio: zero conexões
  if (!isLoading && !hasAnyConnection) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerDate}>{formatToday()}</Text>
          <Text style={styles.headerTitle}>Sua saúde</Text>
        </View>
        <View style={styles.emptyCard}>
          <Heart size={32} color="#A78BFA" strokeWidth={2.5} />
          <Text style={styles.emptyTitle}>Conecte sua fonte de saúde</Text>
          <Text style={styles.emptyBody}>
            Veja sono, frequência cardíaca, passos e recuperação direto no Kinevo.
          </Text>
          <Pressable
            onPress={() => router.push('/profile/connections')}
            style={styles.emptyCta}
          >
            <Text style={styles.emptyCtaText}>Configurar</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Loading inicial (conectado mas dashboard ainda fetching)
  if (isLoading && !data) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color="#A78BFA" />
          <Text style={styles.loadingText}>Carregando sua saúde...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Loading da primeira sync (conectado mas sem dados ainda)
  if (hasAnyConnection && !hasAnyData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color="#A78BFA" />
          <Text style={styles.loadingText}>Importando últimos 30 dias...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Estado normal
  const sleepDur = data?.sleepYesterday?.duration_minutes;
  const sleepEff = data?.sleepYesterday?.efficiency_pct;
  const hrToday = data?.hrRestingToday ?? null;
  const hrBaseline = data?.hrBaseline30d ?? null;
  const steps = data?.stepsToday ?? null;
  const hrv = data?.hrvToday != null ? Math.round(Number(data.hrvToday)) : null;
  const hrvBase = data?.hrvBaseline30d ?? null;

  const stepsGoal = 8000;
  const stepsProgress = steps != null ? Math.min(100, Math.round((steps / stepsGoal) * 100)) : null;

  const hrTrend: 'up' | 'down' | 'flat' | null =
    hrToday != null && hrBaseline != null
      ? hrToday > hrBaseline + 3
        ? 'up'
        : hrToday < hrBaseline - 3
        ? 'down'
        : 'flat'
      : null;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing || isSyncing} onRefresh={onRefresh} tintColor="#A78BFA" />}
      >
        <View style={styles.header}>
          <Text style={styles.headerDate}>{formatToday()}</Text>
          <Text style={styles.headerTitle}>Sua saúde</Text>
        </View>

        <View style={styles.grid}>
          <View style={styles.gridRow}>
            <HealthMetricCard
              icon={Moon}
              label="Sono · ontem"
              value={formatDurationHM(sleepDur ?? null) ?? null}
              sub={sleepEff != null ? `${sleepEff}% eficiência` : null}
              color="#6366F1"
            />
            <HealthMetricCard
              icon={Heart}
              label="HR repouso"
              value={hrToday}
              unit="bpm"
              sub={hrBaseline != null ? `Média 30d: ${hrBaseline}` : null}
              color="#EF4444"
              trend={hrTrend}
            />
          </View>
          <View style={styles.gridRow}>
            <HealthMetricCard
              icon={Footprints}
              label="Passos hoje"
              value={steps != null ? steps.toLocaleString('pt-BR') : null}
              sub={stepsProgress != null ? `${stepsProgress}% da meta 8k` : null}
              color="#22C55E"
            />
            <HealthMetricCard
              icon={Zap}
              label="HRV"
              value={hrv}
              unit="ms"
              sub={hrvBase != null ? `Baseline: ${hrvBase}` : 'Sem Apple Watch'}
              color="#06B6D4"
            />
          </View>
        </View>

        <SleepWeekChart data={data?.sleepWeek ?? []} />

        <View style={styles.sourcesCard}>
          <Text style={styles.sourcesLabel}>FONTES CONECTADAS</Text>
          <View style={styles.chips}>
            {(data?.connections ?? []).map((c) => (
              <View key={c.source} style={[styles.chip, c.status === 'active' ? styles.chipActive : styles.chipInactive]}>
                <Activity size={11} color={c.status === 'active' ? '#22C55E' : 'rgba(255,255,255,0.45)'} strokeWidth={2.5} />
                <Text style={styles.chipText}>
                  {c.source === 'healthkit' ? 'Apple Saúde' : 'Google Health Connect'}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D17',
  },
  scroll: {
    paddingHorizontal: 16,
    paddingBottom: 120,
  },
  header: {
    paddingTop: 16,
    paddingBottom: 20,
  },
  headerDate: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    textTransform: 'capitalize',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#F1F5F9',
    letterSpacing: -0.6,
    marginTop: 2,
  },
  grid: {
    gap: 12,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 12,
  },
  sourcesCard: {
    backgroundColor: '#1A1A2E',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
  },
  sourcesLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: 'rgba(255,255,255,0.55)',
    marginBottom: 10,
  },
  chips: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  chipActive: {
    backgroundColor: 'rgba(34,197,94,0.12)',
  },
  chipInactive: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F1F5F9',
  },
  emptyCard: {
    margin: 16,
    backgroundColor: '#1A1A2E',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F1F5F9',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyCta: {
    marginTop: 8,
    backgroundColor: '#7c3aed',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyCtaText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
  },
});
