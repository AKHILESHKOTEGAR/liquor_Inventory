import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Vibration } from 'react-native';

interface Props {
  onDigit: (d: string) => void;
  onDelete: () => void;
  onClear: () => void;
}

const KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['CLR', '0', '⌫'],
];

export function NumericKeypad({ onDigit, onDelete, onClear }: Props) {
  const handlePress = (key: string) => {
    Vibration.vibrate(10);
    if (key === '⌫') onDelete();
    else if (key === 'CLR') onClear();
    else onDigit(key);
  };

  return (
    <View style={styles.grid}>
      {KEYS.map((row, ri) => (
        <View key={ri} style={styles.row}>
          {row.map((key) => (
            <TouchableOpacity
              key={key}
              style={[
                styles.key,
                key === 'CLR' && styles.keyDanger,
                key === '⌫' && styles.keyMuted,
              ]}
              onPress={() => handlePress(key)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.keyText,
                  key === 'CLR' && styles.keyTextDanger,
                ]}
              >
                {key}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: 12 },
  row: { flexDirection: 'row', gap: 12 },
  key: {
    flex: 1,
    height: 68,
    backgroundColor: '#1e293b',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  keyDanger: { backgroundColor: '#450a0a', borderColor: '#7f1d1d' },
  keyMuted: { backgroundColor: '#0f172a', borderColor: '#1e293b' },
  keyText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#f1f5f9',
    fontVariant: ['tabular-nums'],
  },
  keyTextDanger: { color: '#f87171', fontSize: 16 },
});
