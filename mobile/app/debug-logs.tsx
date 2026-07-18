import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Platform,
} from 'react-native';
import { Stack, Redirect } from 'expo-router';

let getDebugLogs: (() => Promise<string[]>) | undefined;
let clearDebugLogs: (() => void) | undefined;

if (Platform.OS === 'ios') {
  try {
    const mod = require('@/modules/watch-connectivity');
    getDebugLogs = mod.getDebugLogs;
    clearDebugLogs = mod.clearDebugLogs;
  } catch {
    // Module not available
  }
}

export default function DebugLogsScreen() {
  // Rota de diagnóstico — indisponível em produção (evita exposição via deep link).
  if (!__DEV__) return <Redirect href="/" />;

  const [logs, setLogs] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadLogs = async () => {
    try {
      const debugLogs = (await getDebugLogs?.()) ?? [];
      setLogs([...debugLogs].reverse()); // Most recent first
    } catch (e) {
      setLogs([`Error loading logs: ${e}`]);
    }
  };

  useEffect(() => {
    loadLogs();
    // Auto-refresh every 2 seconds
    const interval = setInterval(loadLogs, 2000);
    return () => clearInterval(interval);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadLogs();
    setRefreshing(false);
  };

  const onClear = () => {
    clearDebugLogs?.();
    setLogs([]);
  };

  const getLogColor = (log: string) => {
    if (log.includes('❌') || log.includes('ERROR') || log.includes('LOST')) return '#ff4444';
    if (log.includes('⚠️') || log.includes('WARNING') || log.includes('NIL')) return '#ffaa00';
    if (log.includes('✅')) return '#44ff44';
    if (log.includes('📩') || log.includes('📥')) return '#44aaff';
    if (log.includes('📦')) return '#cc88ff';
    return '#8A8681';
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Debug Logs',
          headerStyle: { backgroundColor: '#111113' },
          headerTintColor: '#E7E5E4',
        }}
      />

      <View style={styles.header}>
        <Text style={styles.title}>
          Watch → iPhone ({logs.length})
        </Text>
        <View style={styles.buttons}>
          <TouchableOpacity onPress={loadLogs} style={styles.button}>
            <Text style={styles.buttonText}>🔄</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClear} style={[styles.button, styles.clearButton]}>
            <Text style={styles.buttonText}>🗑️</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.logList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6D28D9" />
        }
      >
        {logs.length === 0 ? (
          <Text style={styles.emptyText}>
            Nenhum log ainda.{'\n'}Execute um treino no Watch para gerar logs.
          </Text>
        ) : (
          logs.map((log, index) => (
            <Text key={index} style={[styles.logEntry, { color: getLogColor(log) }]}>
              {log}
            </Text>
          ))
        )}
        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111113',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#18181B',
  },
  title: {
    color: '#E7E5E4',
    fontSize: 16,
    fontWeight: '600',
  },
  buttons: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    backgroundColor: '#18181B',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  clearButton: {
    backgroundColor: '#3b1a1a',
  },
  buttonText: {
    color: '#E7E5E4',
    fontSize: 16,
  },
  logList: {
    flex: 1,
    padding: 12,
  },
  logEntry: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 10.5,
    marginBottom: 3,
    lineHeight: 15,
  },
  emptyText: {
    color: '#57534E',
    textAlign: 'center',
    marginTop: 60,
    fontSize: 14,
    lineHeight: 22,
  },
});
