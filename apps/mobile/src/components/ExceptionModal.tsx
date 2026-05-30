import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Platform,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { NumericKeypad } from './NumericKeypad';

interface Props {
  visible: boolean;
  onClose: () => void;
  onManualSerial: (serial: string) => void;
  onPhotoTaken: (photoUri: string) => void;
}

type ExceptionMode = 'CHOOSE' | 'MANUAL' | 'PHOTO';

export function ExceptionModal({ visible, onClose, onManualSerial, onPhotoTaken }: Props) {
  const [mode, setMode] = useState<ExceptionMode>('CHOOSE');
  const [serial, setSerial] = useState('');

  const handleSerialDigit = (d: string) => {
    if (serial.length < 20) setSerial((prev) => prev + d);
  };

  const handleSerialDelete = () => setSerial((prev) => prev.slice(0, -1));
  const handleSerialClear = () => setSerial('');

  const handleSerialSubmit = () => {
    if (serial.trim().length < 3) {
      Alert.alert('Invalid serial', 'Enter at least 3 digits.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onManualSerial(serial.trim());
    setSerial('');
    setMode('CHOOSE');
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Camera access needed to photograph the cap.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets[0]) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onPhotoTaken(result.assets[0].uri);
      setMode('CHOOSE');
    }
  };

  const handleClose = () => {
    setMode('CHOOSE');
    setSerial('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.pill} />
          <View style={styles.headerRow}>
            <Text style={styles.title}>
              {mode === 'CHOOSE' ? '⚠️  Cannot Scan QR?' : mode === 'MANUAL' ? '🔢  Enter Serial' : '📷  Take Photo'}
            </Text>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.subtitle}>
            {mode === 'CHOOSE'
              ? 'QR code is unreadable or damaged. Choose a fallback method:'
              : mode === 'MANUAL'
              ? 'Enter the printed serial number on the cap.'
              : 'Photograph the cap to log it as a placeholder.'}
          </Text>
        </View>

        {/* CHOOSE mode */}
        {mode === 'CHOOSE' && (
          <View style={styles.choiceContainer}>
            <TouchableOpacity
              style={styles.choiceBtn}
              onPress={() => setMode('MANUAL')}
              activeOpacity={0.8}
            >
              <Text style={styles.choiceIcon}>🔢</Text>
              <View style={styles.choiceText}>
                <Text style={styles.choiceTitle}>Enter Serial Number</Text>
                <Text style={styles.choiceDesc}>Type the printed number on the bottle cap</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.choiceBtn, styles.choiceBtnSecondary]}
              onPress={handleTakePhoto}
              activeOpacity={0.8}
            >
              <Text style={styles.choiceIcon}>📷</Text>
              <View style={styles.choiceText}>
                <Text style={styles.choiceTitle}>Take Cap Photo</Text>
                <Text style={styles.choiceDesc}>Label torn/missing — log with photo evidence</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* MANUAL mode */}
        {mode === 'MANUAL' && (
          <View style={styles.manualContainer}>
            {/* Display */}
            <View style={styles.serialDisplay}>
              <Text style={styles.serialText}>{serial || '—'}</Text>
              <Text style={styles.serialHint}>
                {serial.length > 0 ? `${serial.length} digits entered` : 'Tap keys below'}
              </Text>
            </View>

            <NumericKeypad
              onDigit={handleSerialDigit}
              onDelete={handleSerialDelete}
              onClear={handleSerialClear}
            />

            <TouchableOpacity
              style={[styles.submitBtn, serial.length < 3 && styles.submitBtnDisabled]}
              onPress={handleSerialSubmit}
              disabled={serial.length < 3}
              activeOpacity={0.8}
            >
              <Text style={styles.submitText}>Log Serial Number</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.backBtn} onPress={() => setMode('CHOOSE')}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  pill: {
    width: 40,
    height: 4,
    backgroundColor: '#334155',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { fontSize: 20, fontWeight: '700', color: '#f1f5f9' },
  closeBtn: { fontSize: 18, color: '#64748b', fontWeight: '600' },
  subtitle: { fontSize: 14, color: '#64748b', marginTop: 6, lineHeight: 20 },

  choiceContainer: { padding: 20, gap: 12 },
  choiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    gap: 16,
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  choiceBtnSecondary: { borderColor: '#334155' },
  choiceIcon: { fontSize: 32 },
  choiceText: { flex: 1 },
  choiceTitle: { fontSize: 16, fontWeight: '700', color: '#f1f5f9' },
  choiceDesc: { fontSize: 13, color: '#64748b', marginTop: 3 },

  manualContainer: { flex: 1, padding: 20, gap: 16 },
  serialDisplay: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  serialText: {
    fontSize: 40,
    fontWeight: '800',
    color: '#60a5fa',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 4,
    minHeight: 56,
  },
  serialHint: { fontSize: 12, color: '#475569', marginTop: 6 },

  submitBtn: {
    backgroundColor: '#3b82f6',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
  },
  submitBtnDisabled: { backgroundColor: '#1e293b', opacity: 0.5 },
  submitText: { color: '#fff', fontSize: 17, fontWeight: '700' },

  backBtn: { alignItems: 'center', paddingVertical: 12 },
  backText: { color: '#64748b', fontSize: 15 },
});
