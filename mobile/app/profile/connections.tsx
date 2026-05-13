import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Switch, Pressable, StyleSheet, Alert, ActivityIndicator, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Apple, Smartphone, RefreshCw, Lock } from 'lucide-react-native';
import { useHealthKitSync, HealthCategory } from '../../hooks/useHealthKitSync';
import { supabase } from '../../lib/supabase';

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

export default function ConnectionsScreen() {
  const { requestAuthorization, syncHistorical, syncIncremental, isLoading } = useHealthKitSync();
  const [connection, setConnection] = useState<{
    status: string;
    granted_categories: string[];
    last_sync_at: string | null;
  } | null>(null);
  // Local opt-out: aluno pode desligar uma categoria mesmo que HealthKit autorize.
  // Persistido em wearable_connections.granted_categories (re-aplicado a cada sync).
  const [localToggles, setLocalToggles] = useState<Record<HealthCategory, boolean>>({
    sleep: true,
    hr_resting: true,
    steps: true,
    hrv: true,
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
        .eq('source', 'healthkit')
        .maybeSingle();
      if (conn) {
        const c = conn as any;
        setConnection({
          status: c.status,
          granted_categories: c.granted_categories ?? [],
          last_sync_at: c.last_sync_at,
        });
        // Reflete granted_categories nos toggles
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

  const handleConnect = useCallback(async () => {
    const ok = await requestAuthorization();
    if (!ok) {
      Alert.alert('Não foi possível conectar', 'Verifique as permissões em Ajustes do iPhone → Saúde → Kinevo.');
      return;
    }
    await syncHistorical(30);
    await loadConnection();
  }, [requestAuthorization, syncHistorical, loadConnection]);

  const handleSyncNow = useCallback(async () => {
    await syncIncremental();
    await loadConnection();
  }, [syncIncremental, loadConnection]);

  const toggleCategory = useCallback(async (cat: HealthCategory, next: boolean) => {
    setLocalToggles((prev) => ({ ...prev, [cat]: next }));
    // Atualiza granted_categories no Supabase. Próxima sync respeitará — quando
    // o aluno re-conectar uma categoria, o re-sync popula. Quando desliga, a
    // categoria fica vazia no dashboard até religar.
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: student } = await supabase
        .from('students' as any).select('id').eq('auth_user_id', user.id).maybeSingle();
      const studentId = (student as any)?.id;
      if (!studentId) return;
      const updated = ALL_CATEGORIES.filter((c) => (c === cat ? next : localToggles[c]));
      await supabase.from('wearable_connections' as any).upsert(
        { student_id: studentId, source: 'healthkit', granted_categories: updated },
        { onConflict: 'student_id,source' }
      );
    } catch (e) {
      // Reverter local em caso de erro
      setLocalToggles((prev) => ({ ...prev, [cat]: !next }));
    }
  }, [localToggles]);

  const isConnected = connection?.status === 'active';

  return (
    <>
      <Stack.Screen options={{ title: 'Conexões' }} />
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* ─── Fontes nativas ─── */}
          <Text style={styles.sectionLabel}>FONTES NATIVAS</Text>

          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Apple size={22} color="#F1F5F9" strokeWidth={2} />
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Apple Saúde</Text>
                <Text style={styles.rowSub}>
                  {isConnected
                    ? `Conectado · ${connection?.granted_categories.length ?? 0} categorias`
                    : 'Não conectado'}
                </Text>
              </View>
            </View>
            {isConnected ? (
              <View style={styles.connectedPill}>
                <Text style={styles.connectedPillText}>Ativo</Text>
              </View>
            ) : (
              <Pressable onPress={handleConnect} style={styles.connectBtn} disabled={isLoading}>
                {isLoading ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.connectBtnText}>Conectar</Text>}
              </Pressable>
            )}
          </View>

          <View style={[styles.row, styles.rowDisabled]}>
            <View style={styles.rowLeft}>
              <Smartphone size={22} color="rgba(255,255,255,0.35)" strokeWidth={2} />
              <View style={styles.rowText}>
                <Text style={[styles.rowTitle, styles.rowTitleDisabled]}>Google Health Connect</Text>
                <Text style={styles.rowSub}>Disponível em breve no Android</Text>
              </View>
            </View>
          </View>

          {/* ─── O que importar ─── */}
          <Text style={[styles.sectionLabel, { marginTop: 24 }]}>O QUE IMPORTAR</Text>

          {ALL_CATEGORIES.map((cat) => (
            <View key={cat} style={styles.row}>
              <View style={styles.rowLeft}>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>{CATEGORY_LABELS[cat]}</Text>
                  <Text style={styles.rowSub}>
                    {connection?.granted_categories.includes(cat)
                      ? `Última sync: ${relativeTime(connection.last_sync_at)}`
                      : 'Não autorizado'}
                  </Text>
                </View>
              </View>
              <Switch
                value={localToggles[cat]}
                onValueChange={(next) => toggleCategory(cat, next)}
                disabled={!isConnected}
                trackColor={{ false: '#3F3F46', true: '#7c3aed' }}
                thumbColor="#FFFFFF"
                ios_backgroundColor="#3F3F46"
              />
            </View>
          ))}

          {/* ─── Sync manual ─── */}
          {isConnected && (
            <Pressable onPress={handleSyncNow} style={styles.syncBtn} disabled={isLoading}>
              <RefreshCw size={16} color="#A78BFA" strokeWidth={2.5} />
              <Text style={styles.syncBtnText}>Sync agora</Text>
            </Pressable>
          )}

          {/* ─── Privacidade ─── */}
          <Text style={[styles.sectionLabel, { marginTop: 24 }]}>PRIVACIDADE</Text>
          <View style={styles.privacyCard}>
            <Lock size={18} color="#A78BFA" strokeWidth={2.5} />
            <Text style={styles.privacyText}>
              Seus dados são privados. Seu coach NÃO vê seus dados de saúde sem você ativar o compartilhamento (em breve).
            </Text>
          </View>
          <Pressable onPress={() => Linking.openURL('https://www.kinevoapp.com/privacy')}>
            <Text style={styles.privacyLink}>Ver Política de Privacidade →</Text>
          </Pressable>

          {loadingConn && <ActivityIndicator color="#A78BFA" style={{ marginTop: 24 }} />}
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D17' },
  scroll: { paddingHorizontal: 16, paddingBottom: 40 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    color: 'rgba(255,255,255,0.45)',
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1A1A2E',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 8,
  },
  rowDisabled: { opacity: 0.6 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 14, fontWeight: '600', color: '#F1F5F9' },
  rowTitleDisabled: { color: 'rgba(255,255,255,0.55)' },
  rowSub: { fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 2 },
  connectBtn: {
    backgroundColor: '#7c3aed',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  connectBtnText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  connectedPill: {
    backgroundColor: 'rgba(34,197,94,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  connectedPillText: { color: '#22C55E', fontWeight: '700', fontSize: 11 },
  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1A1A2E',
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.3)',
  },
  syncBtnText: { color: '#A78BFA', fontWeight: '700', fontSize: 14 },
  privacyCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#1A1A2E',
    borderRadius: 14,
    padding: 14,
  },
  privacyText: {
    flex: 1,
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 18,
  },
  privacyLink: {
    fontSize: 13,
    color: '#A78BFA',
    fontWeight: '600',
    marginTop: 10,
    paddingHorizontal: 4,
  },
});
