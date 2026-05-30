import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  ScrollView, RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { useScanStore } from '@/store/scanStore';
import { getSessions, createSession, SessionSummary } from '@/services/api';
import type { MainTabParamList } from '../navigation/MainTabs';

type Props = { navigation: any };

function timeSince(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function StatusBadge({ status }: { status: string }) {
  const active = status === 'ACTIVE';
  return (
    <View style={[styles.badge, active ? styles.badgeActive : styles.badgeClosed]}>
      <View style={[styles.badgeDot, active ? styles.badgeDotActive : styles.badgeDotClosed]} />
      <Text style={[styles.badgeText, active ? styles.badgeTextActive : styles.badgeTextClosed]}>
        {active ? 'ACTIVE' : 'CLOSED'}
      </Text>
    </View>
  );
}

export function HomeScreen({ navigation }: Props) {
  const store = useScanStore();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [starting, setStarting] = useState(false);

  const activeSession = sessions.find((s) => s.status === 'ACTIVE');
  const closedSessions = sessions.filter((s) => s.status === 'CLOSED').slice(0, 5);

  const fetchSessions = useCallback(async () => {
    try {
      const data = await getSessions(store.storeId ?? undefined);
      setSessions(data);
    } catch {
      // silently fail — offline
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [store.storeId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchSessions();
    }, [fetchSessions])
  );

  const handleStartNewSession = async () => {
    if (activeSession) {
      Alert.alert(
        'Active Session Exists',
        `Session ${activeSession.sessionCode} is still active. Continue it instead of starting a new one?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Continue Existing', onPress: () => handleContinueSession(activeSession) },
          {
            text: 'Start New Anyway',
            style: 'destructive',
            onPress: () => doStartSession(),
          },
        ]
      );
      return;
    }
    await doStartSession();
  };

  const doStartSession = async () => {
    setStarting(true);
    try {
      const session = await createSession();
      store.setSession(session.id, session.sessionCode);
      store.setStep('BOX');
      store.setActiveBox(null);
      navigation.navigate('Scan');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error ?? 'Could not start session. Check network.');
    } finally {
      setStarting(false);
    }
  };

  const handleContinueSession = (session: SessionSummary) => {
    if (store.sessionId !== session.id) {
      store.setSession(session.id, session.sessionCode);
      store.setStep('BOX');
      store.setActiveBox(null);
    }
    navigation.navigate('Scan');
  };

  const todayBottles = store.sessionId ? store.bottleCount : 0;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchSessions(); }} tintColor="#3b82f6" />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoRow}>
            <View style={styles.logoIcon}>
              <Text style={styles.logoEmoji}>🔒</Text>
            </View>
            <View>
              <Text style={styles.appName}>LiquorSafe</Text>
              <Text style={styles.appSub}>Inventory Scanner</Text>
            </View>
          </View>
        </View>

        {/* Employee card */}
        <View style={styles.employeeCard}>
          <View style={styles.employeeLeft}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(store.userName ?? 'U').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View>
              <Text style={styles.employeeName}>{store.userName ?? '—'}</Text>
              <Text style={styles.employeeSub}>{store.employeeId} · {store.storeName ?? 'Unknown Store'}</Text>
            </View>
          </View>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{store.role ?? 'STAFF'}</Text>
          </View>
        </View>

        {/* Active session card */}
        {activeSession && (
          <View style={styles.activeCard}>
            <View style={styles.activeCardHeader}>
              <StatusBadge status="ACTIVE" />
              <Text style={styles.activeCardTime}>{timeSince(activeSession.startedAt)}</Text>
            </View>
            <Text style={styles.activeCardCode}>{activeSession.sessionCode}</Text>
            <Text style={styles.activeCardSub}>
              {activeSession._count?.scanLogs ?? 0} bottles scanned
              {store.sessionId === activeSession.id && store.bottleCount > 0
                ? ` · ${store.bottleCount} this device`
                : ''}
            </Text>
            <TouchableOpacity
              style={styles.continueBtn}
              onPress={() => handleContinueSession(activeSession)}
            >
              <Text style={styles.continueBtnText}>Continue Scanning →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{sessions.length}</Text>
            <Text style={styles.statLabel}>Sessions{'\n'}Total</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>
              {sessions.reduce((acc, s) => acc + (s._count?.scanLogs ?? 0), 0)}
            </Text>
            <Text style={styles.statLabel}>Bottles{'\n'}Logged</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNum, { color: activeSession ? '#22c55e' : '#475569' }]}>
              {activeSession ? '1' : '0'}
            </Text>
            <Text style={styles.statLabel}>Active{'\n'}Session</Text>
          </View>
        </View>

        {/* New session button */}
        <TouchableOpacity
          style={[styles.newSessionBtn, starting && { opacity: 0.6 }]}
          onPress={handleStartNewSession}
          disabled={starting}
        >
          {starting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.newSessionBtnText}>+ Start New Audit Session</Text>
          )}
        </TouchableOpacity>

        {/* Recent sessions */}
        {loading ? (
          <ActivityIndicator color="#3b82f6" style={{ marginTop: 24 }} />
        ) : closedSessions.length > 0 ? (
          <View style={styles.recentSection}>
            <Text style={styles.sectionTitle}>Recent Sessions</Text>
            {closedSessions.map((s) => (
              <View key={s.id} style={styles.sessionRow}>
                <View style={styles.sessionRowLeft}>
                  <Text style={styles.sessionCode}>{s.sessionCode}</Text>
                  <Text style={styles.sessionMeta}>
                    {timeSince(s.startedAt)} · {s._count?.scanLogs ?? 0} bottles
                  </Text>
                </View>
                <StatusBadge status={s.status} />
              </View>
            ))}
          </View>
        ) : !activeSession ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📦</Text>
            <Text style={styles.emptyText}>No sessions yet today</Text>
            <Text style={styles.emptySub}>Tap "Start New Audit Session" to begin</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0f172a' },
  scroll: { padding: 20, paddingBottom: 40 },

  header: { marginBottom: 20 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoIcon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: '#1e3a8a', alignItems: 'center', justifyContent: 'center',
  },
  logoEmoji: { fontSize: 22 },
  appName: { fontSize: 20, fontWeight: '800', color: '#f1f5f9' },
  appSub: { fontSize: 12, color: '#475569', marginTop: 1 },

  employeeCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16, padding: 16,
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    borderWidth: 1, borderColor: '#334155',
  },
  employeeLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#1d4ed8', alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: '#fff' },
  employeeName: { fontSize: 15, fontWeight: '700', color: '#f1f5f9' },
  employeeSub: { fontSize: 12, color: '#64748b', marginTop: 2 },
  roleBadge: {
    backgroundColor: '#172554', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  roleText: { fontSize: 11, fontWeight: '700', color: '#60a5fa', letterSpacing: 1 },

  activeCard: {
    backgroundColor: '#0c1a2e',
    borderRadius: 16, padding: 16,
    marginBottom: 16,
    borderWidth: 1.5, borderColor: '#1d4ed8',
  },
  activeCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  activeCardTime: { fontSize: 12, color: '#475569' },
  activeCardCode: { fontSize: 18, fontWeight: '800', color: '#f1f5f9', letterSpacing: 1, marginBottom: 4 },
  activeCardSub: { fontSize: 13, color: '#64748b', marginBottom: 14 },
  continueBtn: {
    backgroundColor: '#16a34a', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  continueBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: {
    flex: 1, backgroundColor: '#1e293b',
    borderRadius: 14, padding: 14, alignItems: 'center',
    borderWidth: 1, borderColor: '#334155',
  },
  statNum: { fontSize: 28, fontWeight: '800', color: '#3b82f6' },
  statLabel: { fontSize: 11, color: '#64748b', textAlign: 'center', marginTop: 2, lineHeight: 16 },

  newSessionBtn: {
    backgroundColor: '#3b82f6', borderRadius: 16,
    paddingVertical: 18, alignItems: 'center', marginBottom: 28,
  },
  newSessionBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  recentSection: { marginTop: 4 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#475569', letterSpacing: 1, marginBottom: 12 },
  sessionRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1e293b',
  },
  sessionRowLeft: { flex: 1, marginRight: 12 },
  sessionCode: { fontSize: 14, fontWeight: '600', color: '#cbd5e1' },
  sessionMeta: { fontSize: 12, color: '#475569', marginTop: 2 },

  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
  },
  badgeActive: { backgroundColor: '#052e16' },
  badgeClosed: { backgroundColor: '#1e293b' },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeDotActive: { backgroundColor: '#22c55e' },
  badgeDotClosed: { backgroundColor: '#475569' },
  badgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  badgeTextActive: { color: '#22c55e' },
  badgeTextClosed: { color: '#475569' },

  emptyState: { alignItems: 'center', paddingTop: 40 },
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#475569' },
  emptySub: { fontSize: 13, color: '#334155', marginTop: 6, textAlign: 'center' },
});
