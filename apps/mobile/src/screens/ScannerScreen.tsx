import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  ScrollView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';

import { useScanStore } from '@/store/scanStore';
import { resolveBox, batchSync } from '@/services/api';

type Props = { navigation: any };
type Step = 'BOX' | 'QR';

interface CurrentBox {
  barcode: string;
  boxId: string;
  brand: string;
  size: string;
}

export function ScannerScreen({ navigation }: Props) {
  const store = useScanStore();
  const [permission, requestPermission] = useCameraPermissions();
  const [step, setStep] = useState<Step>('BOX');
  const [currentBox, setCurrentBox] = useState<CurrentBox | null>(null);
  const [resolving, setResolving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const cooldown = useRef(false);

  // QRs scanned for the CURRENT box (for display only — truth is in store.scannedItems)
  const currentBoxQRs = store.scannedItems.filter(
    (e) => e.boxId === currentBox?.boxId
  );

  // No active session — tell user to go to Home
  if (!store.sessionId) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.noSession}>
          <Text style={s.noSessionIcon}>📋</Text>
          <Text style={s.noSessionTitle}>No Active Session</Text>
          <Text style={s.noSessionSub}>Start an audit session from the Home tab first.</Text>
          <TouchableOpacity style={s.goHomeBtn} onPress={() => navigation.navigate('Home')}>
            <Text style={s.goHomeBtnText}>Go to Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!permission) return <View style={s.dark} />;

  if (!permission.granted) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.noSession}>
          <Text style={s.noSessionIcon}>📷</Text>
          <Text style={s.noSessionTitle}>Camera Permission Required</Text>
          <TouchableOpacity style={s.goHomeBtn} onPress={requestPermission}>
            <Text style={s.goHomeBtnText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const handleScan = useCallback(async ({ data }: BarcodeScanningResult) => {
    if (cooldown.current || resolving || syncing) return;
    cooldown.current = true;
    setTimeout(() => { cooldown.current = false; }, 1200);

    if (step === 'BOX') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setResolving(true);
      try {
        const res = await resolveBox(store.sessionId!, data);
        const box = res.boxes?.[0];
        if (!box) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Alert.alert('Box Not Found', `Barcode "${data}" is not registered in the system.`);
          return;
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setCurrentBox({
          barcode: data,
          boxId: box.id,
          brand: box.brand.name,
          size: box.brand.size,
        });
        setStep('QR');
      } catch (err: any) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        const msg = err.response?.data?.error ?? err.message ?? 'Network error';
        Alert.alert('Scan Error', msg);
      } finally {
        setResolving(false);
      }
      return;
    }

    // QR step
    const duplicate = store.scannedQrSet.has(data);
    if (duplicate) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Duplicate QR', `Already scanned in this session.\n\n${data}`);
      return;
    }

    const event = {
      localId: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      rawValue: data,
      scanType: 'QR_CODE' as const,
      scannedAt: new Date().toISOString(),
      boxId: currentBox!.boxId,
    };

    store.recordScan(event);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [step, resolving, syncing, currentBox, store]);

  const handleNextBox = () => {
    Alert.alert(
      'Done with this box?',
      `${currentBoxQRs.length} QR code(s) scanned for:\n${currentBox?.barcode}\n\nSync and move to next box?`,
      [
        { text: 'Stay', style: 'cancel' },
        { text: 'Sync & Next Box', onPress: doSyncAndNext },
      ]
    );
  };

  const doSyncAndNext = async () => {
    if (store.pendingSyncs.length === 0) {
      resetToBoxStep();
      return;
    }
    setSyncing(true);
    try {
      const res = await batchSync(
        store.sessionId!,
        store.employeeId ?? 'unknown',
        store.pendingSyncs,
      );
      store.clearPendingSyncs(res.results.localIds);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      const msg = err.response?.data?.error ?? err.message ?? 'Sync failed';
      Alert.alert('Sync Failed', `${msg}\n\nScans saved locally — will retry next sync.`);
    } finally {
      setSyncing(false);
      resetToBoxStep();
    }
  };

  const resetToBoxStep = () => {
    setStep('BOX');
    setCurrentBox(null);
  };

  const handleDeleteQR = (localId: string, value: string) => {
    Alert.alert('Remove scan?', value, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          store.deleteScan(localId);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        },
      },
    ]);
  };

  return (
    <View style={s.dark}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        active={!resolving && !syncing}
        onBarcodeScanned={handleScan}
        barcodeScannerSettings={{
          barcodeTypes: step === 'BOX'
            ? ['code128', 'code39', 'code93', 'ean13', 'ean8', 'upc_a', 'upc_e', 'itf14']
            : ['qr', 'datamatrix', 'pdf417'],
        }}
      />

      {/* Loading overlay for resolve/sync */}
      {(resolving || syncing) && (
        <View style={s.loadingOverlay}>
          <ActivityIndicator color="#3b82f6" size="large" />
          <Text style={s.loadingText}>{resolving ? 'Resolving box…' : 'Syncing scans…'}</Text>
        </View>
      )}

      <SafeAreaView style={s.overlay} pointerEvents="box-none">

        {/* Header */}
        <View style={s.header} pointerEvents="auto">
          {step === 'QR' && (
            <TouchableOpacity style={s.backPill} onPress={handleNextBox}>
              <Text style={s.backPillText}>‹ Next Box</Text>
            </TouchableOpacity>
          )}
          <View style={s.stepPills}>
            <View style={[s.pill, step === 'BOX' && s.pillActive]}>
              <Text style={[s.pillText, step === 'BOX' && s.pillTextActive]}>① BOX</Text>
            </View>
            <Text style={s.pillArrow}>›</Text>
            <View style={[s.pill, step === 'QR' && s.pillActive]}>
              <Text style={[s.pillText, step === 'QR' && s.pillTextActive]}>② QR CODES</Text>
            </View>
          </View>
        </View>

        {/* Session + pending syncs indicator */}
        <View style={s.sessionBar} pointerEvents="none">
          <Text style={s.sessionCode}>{store.sessionCode}</Text>
          {store.pendingSyncs.length > 0 && (
            <View style={s.pendingBubble}>
              <Text style={s.pendingText}>{store.pendingSyncs.length} pending</Text>
            </View>
          )}
        </View>

        {/* Box banner (QR step only) */}
        {step === 'QR' && currentBox && (
          <View style={s.boxBanner} pointerEvents="none">
            <View style={s.boxBannerLeft}>
              <Text style={s.boxBannerLabel}>SCANNING BOX</Text>
              <Text style={s.boxBannerValue} numberOfLines={1}>{currentBox.barcode}</Text>
              <Text style={s.boxBannerBrand}>{currentBox.brand} · {currentBox.size}</Text>
            </View>
            <View style={s.countBubble}>
              <Text style={s.countNum}>{currentBoxQRs.length}</Text>
              <Text style={s.countLabel}> scanned</Text>
            </View>
          </View>
        )}

        {/* Viewfinder */}
        <View style={s.finderArea} pointerEvents="none">
          <View style={s.finder}>
            <View style={[s.corner, s.tl]} />
            <View style={[s.corner, s.tr]} />
            <View style={[s.corner, s.bl]} />
            <View style={[s.corner, s.br]} />
          </View>
          <View style={s.hintBubble}>
            <Text style={s.hintText}>
              {step === 'BOX' ? 'Point at box barcode' : 'Point at bottle QR code'}
            </Text>
          </View>
        </View>

        {/* Bottom panel */}
        <View style={s.bottomPanel} pointerEvents="auto">
          {step === 'BOX' ? (
            <View style={s.waitingRow}>
              <Text style={s.waitingText}>Waiting for box barcode…</Text>
              <Text style={s.sessionHint}>Session: {store.sessionCode}</Text>
            </View>
          ) : (
            <>
              {currentBoxQRs.length === 0 ? (
                <Text style={s.emptyHint}>Scan bottle QR codes for this box</Text>
              ) : (
                <ScrollView style={s.qrScroll} showsVerticalScrollIndicator={false}>
                  {[...currentBoxQRs].reverse().map((item) => (
                    <View key={item.localId} style={s.qrRow}>
                      <View style={s.qrRowLeft}>
                        <Text style={s.qrVal} numberOfLines={1}>{item.rawValue}</Text>
                        <Text style={s.qrTime}>{new Date(item.scannedAt).toLocaleTimeString()}</Text>
                      </View>
                      <TouchableOpacity
                        style={s.deleteBtn}
                        onPress={() => handleDeleteQR(item.localId, item.rawValue)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={s.deleteBtnText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              )}

              <TouchableOpacity style={s.nextBoxBtn} onPress={handleNextBox} disabled={syncing}>
                <Text style={s.nextBoxBtnText}>
                  {syncing ? 'Syncing…' : `Done — Next Box (${currentBoxQRs.length} scanned)`}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const BLUE = '#3b82f6';
const DARK = '#0f172a';
const CARD = '#1e293b';
const BORDER = '#334155';

const s = StyleSheet.create({
  dark: { flex: 1, backgroundColor: '#000' },
  safe: { flex: 1, backgroundColor: DARK },
  overlay: { flex: 1 },

  // No session / permission
  noSession: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  noSessionIcon: { fontSize: 48 },
  noSessionTitle: { fontSize: 18, fontWeight: '700', color: '#f1f5f9', textAlign: 'center' },
  noSessionSub: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 20 },
  goHomeBtn: { backgroundColor: BLUE, borderRadius: 14, paddingHorizontal: 32, paddingVertical: 14, marginTop: 8 },
  goHomeBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Loading overlay
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center', justifyContent: 'center', gap: 12, zIndex: 10,
  },
  loadingText: { color: '#94a3b8', fontSize: 14, fontWeight: '600' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingTop: 8, paddingHorizontal: 16, gap: 10,
  },
  backPill: {
    backgroundColor: 'rgba(15,23,42,0.85)',
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
  },
  backPillText: { color: BLUE, fontSize: 14, fontWeight: '700' },
  stepPills: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pill: {
    backgroundColor: 'rgba(15,23,42,0.75)',
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
  },
  pillActive: { backgroundColor: BLUE },
  pillText: { fontSize: 11, fontWeight: '700', color: '#475569', letterSpacing: 0.8 },
  pillTextActive: { color: '#fff' },
  pillArrow: { color: '#334155', fontSize: 14 },

  // Session bar
  sessionBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginTop: 4,
  },
  sessionCode: { color: '#334155', fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  pendingBubble: {
    backgroundColor: '#78350f', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  pendingText: { color: '#fbbf24', fontSize: 10, fontWeight: '700' },

  // Box banner
  boxBanner: {
    marginHorizontal: 16, marginTop: 6,
    backgroundColor: 'rgba(15,23,42,0.9)',
    borderRadius: 14, padding: 12,
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: BLUE + '55',
    gap: 10,
  },
  boxBannerLeft: { flex: 1 },
  boxBannerLabel: { fontSize: 9, fontWeight: '700', color: '#475569', letterSpacing: 1 },
  boxBannerValue: {
    fontSize: 13, fontWeight: '700', color: '#e2e8f0',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  boxBannerBrand: { fontSize: 11, color: '#64748b', marginTop: 2 },
  countBubble: { flexDirection: 'row', alignItems: 'baseline' },
  countNum: { fontSize: 22, fontWeight: '800', color: BLUE },
  countLabel: { fontSize: 11, color: '#64748b', fontWeight: '600' },

  // Viewfinder
  finderArea: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  finder: { width: 240, height: 180, position: 'relative' },
  corner: { position: 'absolute', width: 28, height: 28, borderColor: BLUE, borderWidth: 3 },
  tl: { top: 0, left: 0, borderBottomWidth: 0, borderRightWidth: 0 },
  tr: { top: 0, right: 0, borderBottomWidth: 0, borderLeftWidth: 0 },
  bl: { bottom: 0, left: 0, borderTopWidth: 0, borderRightWidth: 0 },
  br: { bottom: 0, right: 0, borderTopWidth: 0, borderLeftWidth: 0 },
  hintBubble: {
    backgroundColor: 'rgba(15,23,42,0.7)',
    paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20,
  },
  hintText: { color: 'rgba(255,255,255,0.8)', fontSize: 13 },

  // Bottom panel
  bottomPanel: {
    margin: 12,
    backgroundColor: 'rgba(15,23,42,0.95)',
    borderRadius: 20, padding: 14,
    maxHeight: 260,
    borderWidth: 1, borderColor: BORDER,
  },
  waitingRow: { alignItems: 'center', paddingVertical: 10, gap: 6 },
  waitingText: { color: '#475569', fontSize: 14 },
  sessionHint: { color: '#334155', fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  emptyHint: { color: '#475569', fontSize: 13, textAlign: 'center', paddingVertical: 10 },

  qrScroll: { maxHeight: 160 },
  qrRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: CARD,
    gap: 8,
  },
  qrRowLeft: { flex: 1 },
  qrVal: {
    fontSize: 12, color: '#e2e8f0',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  qrTime: { fontSize: 10, color: '#475569', marginTop: 2 },
  deleteBtn: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: '#7f1d1d', alignItems: 'center', justifyContent: 'center',
  },
  deleteBtnText: { color: '#fca5a5', fontSize: 11, fontWeight: '800' },

  nextBoxBtn: {
    marginTop: 10, backgroundColor: '#16a34a',
    borderRadius: 14, paddingVertical: 13, alignItems: 'center',
  },
  nextBoxBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
