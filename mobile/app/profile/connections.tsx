// Fase 14b — Settings cross-platform.
// iOS: Apple Saúde ativável, Google Health Connect "disponível só no Android".
// Android: Apple Saúde "disponível só no iOS", Google Health Connect ativável (com 3 SDK states).
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useV2Colors, type V2Palette } from '../../hooks/useV2Colors';
import { View, Text, ScrollView, Switch, Pressable, StyleSheet, Alert, ActivityIndicator, Linking, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Apple, Smartphone, RefreshCw, Lock, ExternalLink } from 'lucide-react-native';
import { useHealthKitSync } from '../../hooks/useHealthKitSync';
import { useHealthConnectSync } from '../../hooks/useHealthConnectSync';
import type { HealthCategory } from '../../lib/healthSync/shared';
import { supabase } from '../../lib/supabase';
import { ConnectionRowStrava } from '../../components/strava/ConnectionRowStrava';
import { ConnectionRowOura } from '../../components/oura/ConnectionRowOura';

const PLAY_STORE_HEALTH_CONNECT = 'https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata';

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return 'nunca';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}

const CATEGORY_LABELS: Record<HealthCategory, string> = {
  sleep: 'Sono',
  steps: 'Passos',
  hr_resting: 'Frequência cardíaca de repouso',
  hrv: 'Variabilidade da FC (HRV)',
};

const ALL_CATEGORIES: HealthCategory[] = ['sleep', 'hr_resting', 'steps', 'hrv'];

const isIOS = Platform.OS === 'ios';
const isAndroid = Platform.OS === 'android';

const PRIMARY_SOURCE: 'healthkit' | 'health_connect' = isIOS ? 'healthkit' : 'health_connect';

export default function ConnectionsScreen() {
  const colors = useV2Colors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const hk = useHealthKitSync();
  const hc = useHealthConnectSync();

  const requestAuthorization = isIOS ? hk.requestAuthorization : hc.requestAuthorization;
  const syncHistorical = isIOS ? hk.syncHistorical : hc.syncHistorical;
  const syncIncremental = isIOS ? hk.syncIncremental : hc.syncIncremental;
  const isLoading = isIOS ? hk.isLoading : hc.isLoading;
  const sdkStatus = hc.sdkStatus;

  const [connection, setConnection] = useState<{
    status: string;
    granted_categories: string[];
    last_sync_at: string | null;
  } | null>(null);
  const [localToggles, setLocalToggles] = useState<Record<HealthCategory, boolean>>({
    sleep: true, hr_resting: true, steps: true, hrv: true,
  });
  const [loadingConn, setLoadingConn] = useState(true);

  const loadConnection = useCallback(async () => {
    setLoadingConn(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: student } = await supabase
        .from('students' as any).select('id').eq('auth_user_id', user.id).maybeSingle();
      const studentId = (student as any)?.id;
      if (!studentId) return;
      const { data: conn } = await supabase
        .from('wearable_connections' as any)
        .select('status, granted_categories, last_sync_at')
        .eq('student_id', studentId)
        .eq('source', PRIMARY_SOURCE)
        .maybeSingle();
      if (conn) {
        const c = conn as any;
        setConnection({
          status: c.status,
          granted_categories: c.granted_categories ?? [],
          last_sync_at: c.last_sync_at,
        });
        const granted = new Set<string>(c.granted_categories ?? []);
        setLocalToggles({
          sleep: granted.has('sleep'),
          hr_resting: granted.has('hr_resting'),
          steps: granted.has('steps'),
          hrv: granted.has('hrv'),
        });
      }
    } finally {
      setLoadingConn(false);
    }
  }, []);

  useEffect(() => { void loadConnection(); }, [loadConnection]);

  const handleConnectPrimary = useCallback(async () => {
    // Android: tratar SDK_UNAVAILABLE / UPDATE_REQUIRED ANTES de abrir intent
    if (isAndroid) {
      const currentStatus = await hc.refreshSdkStatus();
      if (currentStatus === 'unavailable') {
        Alert.alert(
          'Health Connect não encontrado',
          'Pra ver seus dados de saúde, instale o app Health Connect do Google na Play Store.',
          [
            { text: 'Mais tarde', style: 'cancel' },
            { text: 'Abrir Play Store', onPress: () => Linking.openURL(PLAY_STORE_HEALTH_CONNECT) },
          ],
        );
        return;
      }
      if (currentStatus === 'update_required') {
        Alert.alert(
          'Atualize o Health Connect',
          'Pra continuar, atualize o app Health Connect na Play Store.',
          [
            { text: 'Mais tarde', style: 'cancel' },
            { text: 'Abrir Play Store', onPress: () => Linking.openURL(PLAY_STORE_HEALTH_CONNECT) },
          ],
        );
        return;
      }
    }
    const ok = await requestAuthorization();
    if (!ok) {
      Alert.alert(
        'Não foi possível conectar',
        isIOS
          ? 'Verifique as permissões em Ajustes do iPhone → Saúde → Kinevo.'
          : 'Verifique as permissões no app Health Connect.',
      );
      return;
    }
    await syncHistorical(30);
    await loadConnection();
  }, [requestAuthorization, syncHistorical, loadConnection, hc]);

  const handleSyncNow = useCallback(async () => {
    await syncIncremental();
    await loadConnection();
  }, [syncIncremental, loadConnection]);

  const toggleCategory = useCallback(async (cat: HealthCategory, next: boolean) => {
    setLocalToggles((prev) => ({ ...prev, [cat]: next }));
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: student } = await supabase
        .from('students' as any).select('id').eq('auth_user_id', user.id).maybeSingle();
      const studentId = (student as any)?.id;
      if (!studentId) return;
      const updated = ALL_CATEGORIES.filter((c) => (c === cat ? next : localToggles[c]));
      await supabase.from('wearable_connections' as any).upsert(
        { student_id: studentId, source: PRIMARY_SOURCE, granted_categories: updated },
        { onConflict: 'student_id,source' }
      );
    } catch {
      setLocalToggles((prev) => ({ ...prev, [cat]: !next }));
    }
  }, [localToggles]);

  const isConnected = connection?.status === 'active';
  const isRevoked = connection?.status === 'revoked';
  const hasError = connection?.status === 'error';
  // Quantidade dinâmica de categorias ON (reflete toggles em tempo real).
  const activeCategoriesCount = ALL_CATEGORIES.filter((c) => localToggles[c]).length;

  const healthConnectUnavailableMsg = useMemo(() => {
    if (!isAndroid) return 'Disponível só no Android';
    if (sdkStatus === 'unavailable') return 'Instale o Health Connect na Play Store';
    if (sdkStatus === 'update_required') return 'Atualize o Health Connect na Play Store';
    return undefined;
  }, [sdkStatus]);

  return (
    <>
      <Stack.Screen options={{ title: 'Conexões' }} />
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.sectionLabel}>FONTES NATIVAS</Text>

          {/* Apple Saúde — ativável só em iOS */}
          <View style={[styles.row, !isIOS && styles.rowDisabled]}>
            <View style={styles.rowLeft}>
              <Apple size={22} color={isIOS ? colors.text.primary : colors.text.quaternary} strokeWidth={2} />
              <View style={styles.rowText}>
                <Text style={[styles.rowTitle, !isIOS && styles.rowTitleDisabled]}>Apple Saúde</Text>
                <Text style={[styles.rowSub, isIOS && isRevoked && styles.rowSubError]}>
                  {!isIOS
                    ? 'Disponível só no iOS'
                    : isRevoked
                      ? 'Revogado pelo sistema · Reconectar'
                      : hasError
                        ? 'Erro na última sync · Tentar novamente'
                        : isConnected
                          ? `Conectado · ${activeCategoriesCount} categoria${activeCategoriesCount === 1 ? '' : 's'}`
                          : 'Não conectado'}
                </Text>
              </View>
            </View>
            {isIOS && (
              isConnected ? (
                <View style={styles.connectedPill}>
                  <Text style={styles.connectedPillText}>Ativo</Text>
                </View>
              ) : (
                <Pressable onPress={handleConnectPrimary} style={styles.connectBtn} disabled={isLoading}>
                  {isLoading ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.connectBtnText}>Conectar</Text>}
                </Pressable>
              )
            )}
          </View>

          {/* Google Health Connect — ativável só em Android com SDK_AVAILABLE */}
          <View style={[styles.row, !isAndroid && styles.rowDisabled]}>
            <View style={styles.rowLeft}>
              <Smartphone size={22} color={isAndroid ? colors.text.primary : colors.text.quaternary} strokeWidth={2} />
              <View style={styles.rowText}>
                <Text style={[styles.rowTitle, !isAndroid && styles.rowTitleDisabled]}>Google Health Connect</Text>
                <Text style={[styles.rowSub, isAndroid && isRevoked && styles.rowSubError]}>
                  {!isAndroid
                    ? 'Disponível só no Android'
                    : sdkStatus !== 'available'
                      ? healthConnectUnavailableMsg
                      : isRevoked
                        ? 'Revogado pelo sistema · Reconectar'
                        : hasError
                          ? 'Erro na última sync · Tentar novamente'
                          : isConnected
                            ? `Conectado · ${activeCategoriesCount} categoria${activeCategoriesCount === 1 ? '' : 's'}`
                            : 'Não conectado'}
                </Text>
              </View>
            </View>
            {isAndroid && (
              sdkStatus !== 'available' ? (
                <Pressable
                  onPress={() => Linking.openURL(PLAY_STORE_HEALTH_CONNECT)}
                  style={styles.connectBtn}
                >
                  <ExternalLink size={14} color="#FFF" strokeWidth={2.5} />
                  <Text style={styles.connectBtnText}>Play Store</Text>
                </Pressable>
              ) : isConnected ? (
                <View style={styles.connectedPill}>
                  <Text style={styles.connectedPillText}>Ativo</Text>
                </View>
              ) : (
                <Pressable onPress={handleConnectPrimary} style={styles.connectBtn} disabled={isLoading}>
                  {isLoading ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.connectBtnText}>Conectar</Text>}
                </Pressable>
              )
            )}
          </View>

          {/* ─── Wearables dedicados (Oura) ─── */}
          <Text style={[styles.sectionLabel, { marginTop: 24 }]}>WEARABLES DEDICADOS</Text>
          <ConnectionRowOura />

          {/* ─── Apps de atividade (Strava) ─── */}
          <Text style={[styles.sectionLabel, { marginTop: 24 }]}>APPS DE ATIVIDADE</Text>
          <ConnectionRowStrava />

          {/* ─── O que importar (granular) ─── */}
          <Text style={[styles.sectionLabel, { marginTop: 24 }]}>O QUE IMPORTAR</Text>

          {ALL_CATEGORIES.map((cat) => (
            <View key={cat} style={styles.row}>
              <View style={styles.rowLeft}>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>{CATEGORY_LABELS[cat]}</Text>
                  <Text style={styles.rowSub}>
                    {localToggles[cat]
                      ? connection?.last_sync_at
                        ? `Sincronizando · última ${relativeTime(connection.last_sync_at)}`
                        : 'Sincronizando'
                      : 'Inativo'}
                  </Text>
                </View>
              </View>
              <Switch
                value={localToggles[cat]}
                onValueChange={(next) => toggleCategory(cat, next)}
                disabled={!isConnected}
                trackColor={{ false: colors.neutral[700], true: colors.purple[600] }}
                thumbColor="#FFFFFF"
                ios_backgroundColor={colors.neutral[700]}
              />
            </View>
          ))}

          {/* ─── Sync manual ─── */}
          {isConnected && (
            <Pressable onPress={handleSyncNow} style={styles.syncBtn} disabled={isLoading}>
              <RefreshCw size={16} color={colors.purple[400]} strokeWidth={2.5} />
              <Text style={styles.syncBtnText}>Sync agora</Text>
            </Pressable>
          )}

          {/* ─── Privacidade ─── */}
          <Text style={[styles.sectionLabel, { marginTop: 24 }]}>PRIVACIDADE</Text>
          <View style={styles.privacyCard}>
            <Lock size={18} color={colors.purple[400]} strokeWidth={2.5} />
            <Text style={styles.privacyText}>
              Seus dados são privados. Seu coach NÃO vê seus dados de saúde sem você ativar o compartilhamento (em breve).
            </Text>
          </View>
          <Pressable onPress={() => Linking.openURL('https://www.kinevoapp.com/privacy')}>
            <Text style={styles.privacyLink}>Ver Política de Privacidade →</Text>
          </Pressable>

          {loadingConn && <ActivityIndicator color={colors.purple[400]} style={{ marginTop: 24 }} />}
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

function createStyles(c: V2Palette) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: c.surface.canvas },
  scroll: { paddingHorizontal: 16, paddingBottom: 40 },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', letterSpacing: 2,
    color: c.text.tertiary, marginTop: 16, marginBottom: 8, paddingHorizontal: 4,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: c.surface.card, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14, marginBottom: 8,
  },
  rowDisabled: { opacity: 0.6 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 14, fontWeight: '600', color: c.text.primary },
  rowTitleDisabled: { color: c.text.tertiary },
  rowSub: { fontSize: 12, color: c.text.tertiary, marginTop: 2 },
  rowSubError: { color: '#EF4444', fontWeight: '600' },
  connectBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: c.purple[600], paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10,
  },
  connectBtnText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  connectedPill: {
    backgroundColor: 'rgba(34,197,94,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
  },
  connectedPillText: { color: '#22C55E', fontWeight: '700', fontSize: 11 },
  syncBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: c.surface.card, paddingVertical: 14, borderRadius: 14, marginTop: 12,
    borderWidth: 1, borderColor: 'rgba(167,139,250,0.3)',
  },
  syncBtnText: { color: c.purple[400], fontWeight: '700', fontSize: 14 },
  privacyCard: {
    flexDirection: 'row', gap: 12, backgroundColor: c.surface.card, borderRadius: 14, padding: 14,
  },
  privacyText: { flex: 1, fontSize: 13, color: c.text.secondary, lineHeight: 18 },
  privacyLink: {
    fontSize: 13, color: c.purple[400], fontWeight: '600', marginTop: 10, paddingHorizontal: 4,
  },
  });
}
