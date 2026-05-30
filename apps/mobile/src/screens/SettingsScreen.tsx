import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native';

import { useScanStore } from '@/store/scanStore';
import { logout, apiClient } from '@/services/api';
import { API_BASE_URL } from '@/utils/constants';
import type { MainTabParamList } from '../navigation/MainTabs';

type Props = { navigation: any; stackNavigation?: any };

type ConnStatus = 'checking' | 'ok' | 'fail';

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, mono && styles.rowValueMono]}>{value}</Text>
    </View>
  );
}

export function SettingsScreen({ navigation, stackNavigation }: Props) {
  const store = useScanStore();
  const [connStatus, setConnStatus] = useState<ConnStatus>('checking');
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    setConnStatus('checking');
    const t0 = Date.now();
    try {
      await apiClient.get('/health');
      setLatencyMs(Date.now() - t0);
      setConnStatus('ok');
    } catch {
      setConnStatus('fail');
      setLatencyMs(null);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      store.pendingSyncs.length > 0
        ? `You have ${store.pendingSyncs.length} unsynced scan(s). Logging out will lose them.`
        : 'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
            store.clearAuth();
            store.clearSession();
            (stackNavigation ?? navigation.getParent())?.replace('PinAuth');
          },
        },
      ]
    );
  };

  const handleClearSession = () => {
    if (!store.sessionId) return;
    Alert.alert(
      'Clear Session Data',
      `This removes local session data. The session stays active on the server. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => store.clearSession(),
        },
      ]
    );
  };

  const connColor = connStatus === 'ok' ? '#22c55e' : connStatus === 'fail' ? '#ef4444' : '#f59e0b';
  const connLabel = connStatus === 'ok'
    ? `Connected · ${latencyMs}ms`
    : connStatus === 'fail' ? 'Unreachable' : 'Checking…';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Settings</Text>

        {/* Employee */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>EMPLOYEE</Text>
          <View style={styles.card}>
            <Row label="Name" value={store.userName ?? '—'} />
            <Row label="Employee ID" value={store.employeeId ?? '—'} mono />
            <Row label="Role" value={store.role ?? '—'} />
            <Row label="Store" value={store.storeName ?? '—'} />
          </View>
        </View>

        {/* Connection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>CONNECTION</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>API Server</Text>
              <View style={styles.connRow}>
                <View style={[styles.connDot, { backgroundColor: connColor }]} />
                <Text style={[styles.rowValue, { color: connColor }]}>{connLabel}</Text>
              </View>
            </View>
            <View style={[styles.row, { borderBottomWidth: 0 }]}>
              <Text style={styles.rowLabel}>Endpoint</Text>
              <Text style={[styles.rowValue, styles.rowValueMono, { fontSize: 10 }]} numberOfLines={1}>
                {API_BASE_URL.replace('https://', '').replace('http://', '')}
              </Text>
            </View>
          </View>
          <TouchableOpacity style={styles.checkBtn} onPress={checkConnection}>
            {connStatus === 'checking'
              ? <ActivityIndicator color="#3b82f6" size="small" />
              : <Text style={styles.checkBtnText}>↻ Check Connection</Text>
            }
          </TouchableOpacity>
        </View>

        {/* Session */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ACTIVE SESSION</Text>
          <View style={styles.card}>
            <Row label="Session ID" value={store.sessionCode ?? 'None'} mono />
            <Row label="Bottles scanned" value={String(store.bottleCount)} />
            <View style={[styles.row, { borderBottomWidth: 0 }]}>
              <Text style={styles.rowLabel}>Pending syncs</Text>
              <Text style={[styles.rowValue, { color: store.pendingSyncs.length > 0 ? '#f59e0b' : '#22c55e' }]}>
                {store.pendingSyncs.length}
              </Text>
            </View>
          </View>
          {store.sessionId && (
            <TouchableOpacity style={styles.dangerBtn} onPress={handleClearSession}>
              <Text style={styles.dangerBtnText}>Clear Local Session Data</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* App */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>APP</Text>
          <View style={styles.card}>
            <Row label="Version" value="1.0.0" />
            <View style={[styles.row, { borderBottomWidth: 0 }]}>
              <Text style={styles.rowLabel}>Build</Text>
              <Text style={styles.rowValue}>LiquorSafe Scanner Terminal</Text>
            </View>
          </View>
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutBtnText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0f172a' },
  scroll: { padding: 20, paddingBottom: 48 },
  title: { fontSize: 24, fontWeight: '800', color: '#f1f5f9', marginBottom: 28 },

  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: '#475569',
    letterSpacing: 1.5, marginBottom: 8,
  },

  card: {
    backgroundColor: '#1e293b',
    borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: '#334155',
  },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: '#0f172a',
  },
  rowLabel: { fontSize: 14, color: '#64748b' },
  rowValue: { fontSize: 14, color: '#f1f5f9', fontWeight: '500', maxWidth: '55%', textAlign: 'right' },
  rowValueMono: { fontFamily: 'Menlo', fontSize: 12 },

  connRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  connDot: { width: 8, height: 8, borderRadius: 4 },

  checkBtn: {
    marginTop: 8, alignItems: 'center', paddingVertical: 10,
  },
  checkBtnText: { color: '#3b82f6', fontSize: 14, fontWeight: '600' },

  dangerBtn: {
    marginTop: 8, alignItems: 'center', paddingVertical: 10,
  },
  dangerBtnText: { color: '#ef4444', fontSize: 14, fontWeight: '600' },

  logoutBtn: {
    backgroundColor: '#7f1d1d', borderRadius: 16,
    paddingVertical: 18, alignItems: 'center',
    marginTop: 8,
    borderWidth: 1, borderColor: '#991b1b',
  },
  logoutBtnText: { color: '#fca5a5', fontSize: 16, fontWeight: '700' },
});
