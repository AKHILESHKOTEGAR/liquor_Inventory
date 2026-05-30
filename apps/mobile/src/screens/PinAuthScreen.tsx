import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { NumericKeypad } from '@/components/NumericKeypad';
import { loginWithPin, getStoredUser } from '@/services/api';
import { useScanStore } from '@/store/scanStore';
const EMPLOYEE_REGEX = /^EMP-\d{4,6}$/;

interface Props {
  navigation: any;
}

export function PinAuthScreen({ navigation }: Props) {
  const [employeeId, setEmployeeId] = useState('');
  const [pin, setPin] = useState('');
  const [step, setStep] = useState<'ID' | 'PIN'>('ID');
  const [loading, setLoading] = useState(false);
  const setAuth = useScanStore((s) => s.setAuth);

  useEffect(() => {
    getStoredUser().then((user) => {
      if (user) {
        const store1 = user.ownedStores?.[0];
        setAuth(user.id, user.employeeId, user.name, user.role, user.storeId ?? store1?.id, store1?.name ?? user.storeId);
        navigation.replace('Main');
      }
    });
  }, []);

  const handleIdSubmit = () => {
    const id = employeeId.trim().toUpperCase();
    if (!EMPLOYEE_REGEX.test(id)) {
      Alert.alert('Invalid ID', 'Format must be EMP-XXXX (e.g. EMP-0001)');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEmployeeId(id);
    setStep('PIN');
  };

  const handlePinDigit = (d: string) => {
    if (pin.length >= 6) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 6) handleLogin(next);  // auto-submit at max length
  };

  const handlePinSubmit = () => {
    if (pin.length >= 4) handleLogin(pin);
  };

  const handlePinDelete = () => setPin((p) => p.slice(0, -1));
  const handlePinClear = () => setPin('');

  const handleLogin = async (finalPin: string) => {
    setLoading(true);
    try {
      const { user } = await loginWithPin(employeeId, finalPin);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const store1 = user.ownedStores?.[0];
      setAuth(user.id, user.employeeId, user.name, user.role, user.storeId ?? store1?.id, store1?.name ?? user.storeId ?? undefined);
      navigation.replace('Main');
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const msg = err.response?.data?.error ?? err.message ?? 'Unknown error';
      Alert.alert('Login Failed', msg);
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToId = () => {
    setStep('ID');
    setPin('');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Logo */}
        <View style={styles.logoBlock}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoEmoji}>🔒</Text>
          </View>
          <Text style={styles.appName}>LiquorSafe</Text>
          <Text style={styles.appSubtitle}>Scanner Terminal</Text>
        </View>

        {step === 'ID' ? (
          /* Employee ID entry */
          <View style={styles.idBlock}>
            <Text style={styles.label}>EMPLOYEE ID</Text>
            <TextInput
              style={styles.idInput}
              value={employeeId}
              onChangeText={(t) => setEmployeeId(t.toUpperCase())}
              placeholder="EMP-0001"
              placeholderTextColor="#334155"
              autoCapitalize="characters"
              keyboardType="default"
              maxLength={8}
              returnKeyType="next"
              onSubmitEditing={handleIdSubmit}
              autoFocus
            />
            <TouchableOpacity style={styles.continueBtn} onPress={handleIdSubmit}>
              <Text style={styles.continueBtnText}>Continue →</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* PIN entry */
          <View style={styles.pinBlock}>
            <TouchableOpacity style={styles.idChip} onPress={handleBackToId}>
              <Text style={styles.idChipText}>‹ {employeeId}</Text>
            </TouchableOpacity>

            <Text style={styles.label}>PIN (4–6 DIGITS)</Text>
            <View style={styles.pinDots}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <View
                  key={i}
                  style={[styles.dot, i < pin.length && styles.dotFilled]}
                />
              ))}
            </View>

            {loading ? (
              <ActivityIndicator color="#3b82f6" size="large" style={{ marginTop: 32 }} />
            ) : (
              <>
                <NumericKeypad
                  onDigit={handlePinDigit}
                  onDelete={handlePinDelete}
                  onClear={handlePinClear}
                />
                {pin.length >= 4 && pin.length < 6 && (
                  <TouchableOpacity style={styles.continueBtn} onPress={handlePinSubmit}>
                    <Text style={styles.continueBtnText}>Login →</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0f172a' },
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 20, gap: 32 },

  logoBlock: { alignItems: 'center', paddingTop: 20 },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: '#1e3a8a',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  logoEmoji: { fontSize: 36 },
  appName: { fontSize: 26, fontWeight: '800', color: '#f1f5f9', letterSpacing: 1 },
  appSubtitle: { fontSize: 13, color: '#475569', marginTop: 2 },

  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    letterSpacing: 2,
    marginBottom: 12,
    textAlign: 'center',
  },

  idBlock: { gap: 12 },
  idInput: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    color: '#f1f5f9',
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 18,
    letterSpacing: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  continueBtn: {
    backgroundColor: '#3b82f6',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 4,
  },
  continueBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },

  pinBlock: { gap: 20 },
  idChip: {
    alignSelf: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  idChipText: { color: '#60a5fa', fontSize: 14, fontWeight: '600' },
  pinDots: { flexDirection: 'row', justifyContent: 'center', gap: 16 },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#1e293b',
    borderWidth: 2,
    borderColor: '#334155',
  },
  dotFilled: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
});
