import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Vibration,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { playErrorChime } from '@/utils/audio';

interface Props {
  visible: boolean;
  value: string | null;
  onDismiss: () => void;
  autoDismissMs?: number;
}

export function DuplicateScanOverlay({ visible, value, onDismiss, autoDismissMs = 1500 }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Trigger feedback
      playErrorChime();
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Vibration.vibrate([0, 80, 60, 80]);
      }

      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 80, useNativeDriver: true }),
        Animated.delay(autoDismissMs - 80),
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(() => onDismiss());
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.overlay, { opacity }]}>
      <View style={styles.content}>
        <Text style={styles.icon}>⛔</Text>
        <Text style={styles.title}>ALREADY SCANNED</Text>
        <Text style={styles.subtitle} numberOfLines={2}>
          {value}
        </Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>DUPLICATE — NOT COUNTED</Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(185, 28, 28, 0.96)',
    zIndex: 1000,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { alignItems: 'center', paddingHorizontal: 32 },
  icon: { fontSize: 64, marginBottom: 16 },
  title: {
    fontSize: 36,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 3,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  subtitle: {
    fontSize: 13,
    color: '#fca5a5',
    marginTop: 12,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  badge: {
    backgroundColor: '#7f1d1d',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#991b1b',
  },
  badgeText: {
    color: '#fca5a5',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
});
