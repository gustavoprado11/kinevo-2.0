import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, StyleSheet, Pressable, ActivityIndicator, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Moon, Heart, Footprints, Activity, Zap, AlertTriangle } from 'lucide-react-native';
import * as BackgroundFetch from 'expo-background-fetch';
import { HealthMetricCard } from '../../components/health/HealthMetricCard';
import { SleepWeekChart } from '../../components/health/SleepWeekChart';
import { useHealthDashboard, toLocalDateISO } from '../../hooks/useHealthDashboard';
import { useHealthKitSync } from '../../hooks/useHealthKitSync';
import { useHealthConnectSync } from '../../hooks/useHealthConnectSync';
import { useHealthInsights } from '../../hooks/useHealthInsights';
import { useRouter, useFocusEffect } from 'expo-router';
import { Platform } from 'react-native';
import { toast } from '../../lib/toast';
import { useV2Colors, type V2Palette } from '../../hooks/useV2Colors';
import { useBrand } from '../../stores/brandStore';
import { supabase } from '../../lib/supabase';
import { isStravaConnected, syncStravaIncremental } from '../../lib/healthSync/stravaSync';
import { InsightsCard } from '../../components/health/InsightsCard';
import { ActivityWeekCard } from '../../components/strava/ActivityWeekCard';
import { hrvMetricLabel } from '../../lib/hrv';

function formatDurationHM(min: number | null | undefined): string | null {
  if (min == null) return null;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h${String(m).padStart(2, '0')}`;
}

function formatToday(): string {
  const d = new Date();
  const s = d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  // Sentence case (só a 1ª letra). Evita "Quinta-Feira, 21 De Maio" do capitalize.
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Fix discrepância #4: frescor do dado. O aluno comparava o Kinevo (defasado
// até 12h pelo background sync) com o app de saúde aberto ao vivo e via
// "discrepância". Mostrar "atualizado há X" deixa o atraso explícito.
function formatRelativeTime(iso: string | null): string | null {
  if (!iso) return null;
  const diffMs = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diffMs) || diffMs < 60_000) return 'agora';
  const min = Math.floor(diffMs / 60_000);
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}

// Rótulo temporal do registro exibido (fix C7): hoje → sem sufixo; ontem →
// "ontem"; mais velho → dd/mm. Deixa explícito quando o card mostra dado que
// não é de hoje, em vez de "–" ou de um número sem contexto.
function dayLabel(date: string | null | undefined): string | null {
  if (!date) return null;
  const now = new Date();
  if (date === toLocalDateISO(now)) return null;
  if (date === toLocalDateISO(new Date(now.getTime() - 24 * 60 * 60 * 1000))) return 'ontem';
  const [, m, d] = date.split('-');
  return `${d}/${m}`;
}

const SOURCE_LABEL: Record<string, string> = {
  healthkit: 'Apple Saúde',
  health_connect: 'Health Connect',
  oura: 'Oura Ring',
  strava: 'Strava',
};

// Padding lateral do ScrollView (scroll.paddingHorizontal) e gap entre os
// dois cards da gridRow. Calculados aqui pra derivar a largura do card.
const SCROLL_PADDING_H = 16;
const GRID_GAP = 12;

export default function HealthScreen() {
  const router = useRouter();
  const colors = useV2Colors();
  const brand = useBrand();
  const styles = useMemo(() => createStyles(colors), [colors]);
  // "purpleAccent" agora segue a marca do coach (estúdio).
  const purpleAccent = brand.color;
  // Largura fixa em dp pra cada card da grid 2x2. Calculada via
  // useWindowDimensions (deterministic, sem depender de measure-pass do
  // Pressable iOS que vinha colapsando os cards).
  const { width: screenW } = useWindowDimensions();
  const cardWidth = Math.floor((screenW - SCROLL_PADDING_H * 2 - GRID_GAP) / 2);
  const { data, isLoading, refresh } = useHealthDashboard();
  const { insights, refresh: refreshInsights } = useHealthInsights();
  const hk = useHealthKitSync();
  const hc = useHealthConnectSync();
  const syncIncremental = Platform.OS === 'ios' ? hk.syncIncremental : hc.syncIncremental;
  const isSyncing = Platform.OS === 'ios' ? hk.isLoading : hc.isLoading;
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Strava roda em paralelo + silencioso (falha não bloqueia HealthKit).
      const stravaSync = (async () => {
        try {
          if (await isStravaConnected(supabase)) {
            await syncStravaIncremental(supabase, 7);
          }
        } catch { /* silencioso */ }
      })();
      const [res] = await Promise.all([syncIncremental(), stravaSync]);
      if (!res.ok) {
        toast.error('Não foi possível atualizar agora', 'Tente novamente em alguns instantes.');
      }
      await Promise.all([refresh(), refreshInsights()]);
    } catch {
      toast.error('Não foi possível atualizar agora', 'Tente novamente em alguns instantes.');
    } finally {
      setRefreshing(false);
    }
  }, [syncIncremental, refresh, refreshInsights]);

  // Fix discrepância #4: sincroniza ao focar a aba pra reduzir a defasagem vs
  // o background sync de 12h. Silencioso — sem toast de erro. Debounce curto
  // (90s, era 5min — fix C12): reabrir a aba é a intenção mais clara de
  // "quero ver dado atual" que o aluno tem.
  const lastFocusSyncRef = useRef(0);
  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      if (now - lastFocusSyncRef.current < 90 * 1000) return;
      lastFocusSyncRef.current = now;
      void (async () => {
        try {
          // Strava em paralelo + silencioso — segue o mesmo debounce de 5min.
          const stravaSync = (async () => {
            try {
              if (await isStravaConnected(supabase)) {
                await syncStravaIncremental(supabase, 7);
              }
            } catch { /* silencioso */ }
          })();
          await Promise.all([syncIncremental(), stravaSync]);
          await Promise.all([refresh(), refreshInsights()]);
        } catch {
          // foco é best-effort; pull-to-refresh continua disponível
        }
      })();
    }, [syncIncremental, refresh, refreshInsights])
  );

  // Fix C3: Atualização em 2º plano desligada = zero sync com o app fechado,
  // silenciosamente. A aba avisa (o registro do task já detecta e desiste).
  const [bgRefreshOff, setBgRefreshOff] = useState(false);
  useEffect(() => {
    let mounted = true;
    BackgroundFetch.getStatusAsync()
      .then((s) => {
        if (!mounted) return;
        setBgRefreshOff(
          s === BackgroundFetch.BackgroundFetchStatus.Denied ||
          s === BackgroundFetch.BackgroundFetchStatus.Restricted,
        );
      })
      .catch(() => { /* melhor não avisar do que avisar errado */ });
    return () => { mounted = false; };
  }, []);

  const hasAnyConnection = (data?.connections.length ?? 0) > 0;
  const hasAnyData =
    !!data?.sleepLatest ||
    data?.hrRestingLatest != null ||
    data?.stepsLatest != null ||
    data?.hrvLatest != null;
  // Fix C5/C6 — frescor honesto: prioriza lastDataAt (quando DADO chegou de
  // fato) e, no fallback, só considera conexões ATIVAS (uma conexão em erro
  // com tentativa recente mascarava dado velho no max()).
  const lastActiveSyncAt: string | null = (() => {
    const syncs = (data?.connections ?? [])
      .filter((c) => c.status === 'active')
      .map((c) => c.last_sync_at)
      .filter((s): s is string => !!s);
    if (syncs.length === 0) return null;
    return syncs.sort((a, b) => (a < b ? 1 : -1))[0];
  })();
  const freshnessAt = data?.lastDataAt ?? lastActiveSyncAt;
  const anySyncAttempt = (data?.connections ?? []).some((c) => !!c.last_sync_at);
  const isFirstSyncPending = hasAnyConnection && !hasAnyData && !anySyncAttempt;

  // Banner de fonte com problema (fix C4/C8 — visibilidade): hoje esses estados
  // só aparecem em Perfil→Conexões, onde o aluno não vai. Prioridade:
  // erro (com CTA) > 2º plano desligado > dado velho (>24h).
  const problemConnections = (data?.connections ?? []).filter(
    (c) => c.status === 'error' || c.status === 'revoked',
  );
  const staleHours = freshnessAt
    ? Math.floor((Date.now() - new Date(freshnessAt).getTime()) / 3_600_000)
    : null;
  const showStaleBanner = hasAnyData && staleHours != null && staleHours >= 24;

  // Estado vazio: zero conexões
  if (!isLoading && !hasAnyConnection) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerDate}>{formatToday()}</Text>
          <Text style={styles.headerTitle}>Sua saúde</Text>
        </View>
        <View style={styles.emptyCard}>
          <Heart size={32} color={purpleAccent} strokeWidth={2.5} />
          <Text style={styles.emptyTitle}>Conecte sua fonte de saúde</Text>
          <Text style={styles.emptyBody}>
            Veja sono, frequência cardíaca, passos e recuperação direto no Kinevo.
          </Text>
          <Pressable
            onPress={() => router.push('/profile/connections')}
            style={[styles.emptyCta, { backgroundColor: brand.color }]}
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
          <ActivityIndicator size="small" color={purpleAccent} />
          <Text style={styles.loadingText}>Carregando sua saúde...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Loading da primeira sync (conectado mas sem dados E sem nenhuma sync feita)
  if (isFirstSyncPending) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color={purpleAccent} />
          <Text style={styles.loadingText}>Importando últimos 30 dias...</Text>
        </View>
      </SafeAreaView>
    );
  }
  // Quando sync já rodou mas Apple Saúde está vazio (comum em simulator ou
  // alunos sem histórico): cai pro dashboard normal abaixo — HealthMetricCard
  // renderiza "–" graciosamente quando value é null.

  // Estado normal — registros mais recentes + rótulo temporal (fix C7).
  const sleepDur = data?.sleepLatest?.duration_minutes;
  const sleepEff = data?.sleepLatest?.efficiency_pct;
  const hrToday = data?.hrRestingLatest?.bpm ?? null;
  const hrBaseline = data?.hrBaseline30d ?? null;
  const steps = data?.stepsLatest?.steps ?? null;
  const hrv = data?.hrvLatest != null ? Math.round(Number(data.hrvLatest.value_ms)) : null;
  const hrvBase = data?.hrvBaseline30d ?? null;
  // Sono: registrado sob a data da noite — hoje OU ontem significam "última
  // noite"; mais velho que isso ganha a data explícita.
  const sleepDay = (() => {
    const l = dayLabel(data?.sleepLatest?.date);
    return l === null ? 'ontem' : l;
  })();
  const hrDay = dayLabel(data?.hrRestingLatest?.date);
  const stepsDay = dayLabel(data?.stepsLatest?.date);
  const hrvDay = dayLabel(data?.hrvLatest?.date);
  // Rótulo da métrica (SDNN no iOS / RMSSD no Android) — não são comparáveis.
  const hrvLabelSuffix = data?.hrvMetric ? ` ${hrvMetricLabel(data.hrvMetric)}` : '';

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
        refreshControl={<RefreshControl refreshing={refreshing || isSyncing} onRefresh={onRefresh} tintColor={purpleAccent} />}
      >
        <View style={styles.header}>
          <Text style={styles.headerDate}>{formatToday()}</Text>
          <Text style={styles.headerTitle}>Sua saúde</Text>
          {(refreshing || isSyncing) ? (
            <Text style={styles.headerSync}>Atualizando…</Text>
          ) : freshnessAt ? (
            <Text style={styles.headerSync}>Dados de {formatRelativeTime(freshnessAt)}</Text>
          ) : null}
        </View>

        {/* Estado das fontes (fix C3/C4): erro com CTA > 2º plano off > dado velho */}
        {problemConnections.length > 0 ? (
          <Pressable
            onPress={() => router.push('/profile/connections')}
            accessibilityRole="button"
            accessibilityLabel="Fonte de saúde com problema — abrir conexões"
            style={styles.alertCard}
          >
            <AlertTriangle size={16} color="#B45309" strokeWidth={2.2} />
            <View style={{ flex: 1 }}>
              <Text style={styles.alertTitle}>
                {problemConnections
                  .map((c) => SOURCE_LABEL[c.source] ?? c.source)
                  .join(' e ')}{' '}
                com problema na sincronização
              </Text>
              <Text style={styles.alertBody}>Toque para verificar e reconectar.</Text>
            </View>
          </Pressable>
        ) : bgRefreshOff ? (
          <View style={styles.alertCard}>
            <AlertTriangle size={16} color="#B45309" strokeWidth={2.2} />
            <View style={{ flex: 1 }}>
              <Text style={styles.alertTitle}>Atualização em 2º plano desativada</Text>
              <Text style={styles.alertBody}>
                Seus dados só atualizam com o app aberto. Ative em Ajustes → Geral → Atualização em 2º Plano.
              </Text>
            </View>
          </View>
        ) : showStaleBanner ? (
          <View style={styles.alertCard}>
            <AlertTriangle size={16} color="#B45309" strokeWidth={2.2} />
            <View style={{ flex: 1 }}>
              <Text style={styles.alertTitle}>Sem dados novos {formatRelativeTime(freshnessAt)}</Text>
              <Text style={styles.alertBody}>Puxe para atualizar. Se persistir, verifique as permissões em Conexões.</Text>
            </View>
          </View>
        ) : null}

        {/* Fase 14d — Insights heurísticos no topo (até 3 por sessão) */}
        <InsightsCard insights={insights} />

        <View style={styles.grid}>
          <View style={styles.gridRow}>
            <HealthMetricCard
              icon={Moon}
              label={`Sono · ${sleepDay}`}
              value={formatDurationHM(sleepDur ?? null) ?? null}
              sub={sleepEff != null ? `${sleepEff}% eficiência` : null}
              color="#6366F1"
              cardWidth={cardWidth}
              onPress={() => router.push('/health/sleep')}
            />
            <HealthMetricCard
              icon={Heart}
              label={`HR repouso${hrDay ? ` · ${hrDay}` : ''}`}
              value={hrToday}
              unit="bpm"
              sub={hrBaseline != null ? `Média 30d: ${hrBaseline}` : null}
              color="#EF4444"
              trend={hrTrend}
              cardWidth={cardWidth}
              onPress={() => router.push('/health/hr_resting')}
            />
          </View>
          <View style={styles.gridRow}>
            <HealthMetricCard
              icon={Footprints}
              label={stepsDay ? `Passos · ${stepsDay}` : 'Passos hoje'}
              value={steps != null ? steps.toLocaleString('pt-BR') : null}
              sub={stepsProgress != null ? `${stepsProgress}% da meta 8k` : null}
              color="#22C55E"
              cardWidth={cardWidth}
              onPress={() => router.push('/health/steps')}
            />
            <HealthMetricCard
              icon={Zap}
              label={`HRV${hrvLabelSuffix}${hrvDay ? ` · ${hrvDay}` : ''}`}
              value={hrv}
              unit="ms"
              sub={hrvBase != null ? `Baseline: ${hrvBase}` : 'Sem Apple Watch'}
              color="#06B6D4"
              cardWidth={cardWidth}
              onPress={() => router.push('/health/hrv')}
            />
          </View>
        </View>

        {/* Fase 16 · Strava Activity Week (renderiza só se conectado + atividade na semana) */}
        <ActivityWeekCard />

        <SleepWeekChart data={data?.sleepWeek ?? []} />

        <View style={styles.sourcesCard}>
          <Text style={styles.sourcesLabel}>FONTES CONECTADAS</Text>
          <View style={styles.chips}>
            {(data?.connections ?? [])
              // Fontes conhecidas com rótulo próprio. iOS mostra Apple Saúde;
              // Android mostra Health Connect; Oura aparece em ambas.
              .filter((c) =>
                c.source === 'oura' ||
                (Platform.OS === 'ios' ? c.source === 'healthkit' : c.source === 'health_connect'))
              .map((c) => (
              <View key={c.source} style={[styles.chip, c.status === 'active' ? styles.chipActive : styles.chipInactive]}>
                <Activity size={11} color={c.status === 'active' ? '#22C55E' : colors.text.tertiary} strokeWidth={2.5} />
                <Text style={styles.chipText}>
                  {c.source === 'healthkit' ? 'Apple Saúde' : c.source === 'oura' ? 'Oura Ring' : 'Google Health Connect'}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={styles.partialNote}>
          Passos, calorias e frequência de hoje são parciais e se completam ao
          longo do dia. Os totais batem com seu app de saúde após a sincronização.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(c: V2Palette) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.surface.canvas,
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
    color: c.text.tertiary,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: c.text.primary,
    letterSpacing: -0.6,
    marginTop: 2,
  },
  headerSync: {
    fontSize: 12,
    color: c.text.tertiary,
    marginTop: 6,
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  alertTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: c.text.primary,
  },
  alertBody: {
    fontSize: 12,
    lineHeight: 17,
    color: c.text.secondary,
    marginTop: 2,
  },
  partialNote: {
    fontSize: 11,
    lineHeight: 16,
    color: c.text.tertiary,
    marginTop: 16,
    paddingHorizontal: 4,
  },
  grid: {
    gap: 12,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 12,
  },
  sourcesCard: {
    backgroundColor: c.surface.card,
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
  },
  sourcesLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: c.text.tertiary,
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
    backgroundColor: c.border.subtle,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: c.text.primary,
  },
  emptyCard: {
    margin: 16,
    backgroundColor: c.surface.card,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: c.text.primary,
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 14,
    color: c.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyCta: {
    marginTop: 8,
    backgroundColor: c.purple[600],
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
    color: c.text.tertiary,
  },
  });
}
