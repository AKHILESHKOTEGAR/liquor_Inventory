import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { HomeScreen } from '../screens/HomeScreen';
import { ScannerScreen } from '../screens/ScannerScreen';
import { SettingsScreen } from '../screens/SettingsScreen';

export type TabName = 'Home' | 'Scan' | 'Settings';

export type MainTabParamList = {
  Home: undefined;
  Scan: undefined;
  Settings: undefined;
};

const TABS: { name: TabName; icon: string; label: string }[] = [
  { name: 'Home', icon: '🏠', label: 'Home' },
  { name: 'Scan', icon: '⬛', label: 'Scan' },
  { name: 'Settings', icon: '⚙️', label: 'Settings' },
];

// Minimal navigation-like prop passed to each screen
function makeNavigation(activeTab: TabName, setTab: (t: TabName) => void) {
  return {
    navigate: (screen: string) => setTab(screen as TabName),
    getParent: () => ({ navigate: (screen: string) => setTab(screen as TabName) }),
  } as any;
}

export function MainTabs({ navigation: stackNav }: { navigation: any }) {
  const [activeTab, setActiveTab] = useState<TabName>('Home');

  const nav = makeNavigation(activeTab, setActiveTab);

  return (
    <View style={styles.root}>
      {/* Screen area */}
      <View style={styles.screen}>
        {activeTab === 'Home' && <HomeScreen navigation={nav} />}
        {activeTab === 'Scan' && <ScannerScreen navigation={nav} />}
        {activeTab === 'Settings' && <SettingsScreen navigation={nav} stackNavigation={stackNav} />}
      </View>

      {/* Bottom tab bar */}
      <View style={styles.tabBar}>
        {TABS.map((tab) => {
          const focused = activeTab === tab.name;
          return (
            <TouchableOpacity
              key={tab.name}
              style={styles.tabItem}
              onPress={() => setActiveTab(tab.name)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabIcon, focused && styles.tabIconActive]}>
                {tab.icon}
              </Text>
              <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>
                {tab.label}
              </Text>
              {focused && <View style={styles.tabIndicator} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f172a' },
  screen: { flex: 1 },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#0a1628',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    paddingBottom: Platform.OS === 'ios' ? 20 : 8,
    paddingTop: 10,
    height: Platform.OS === 'ios' ? 78 : 62,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    gap: 3,
  },
  tabIcon: { fontSize: 22, opacity: 0.35 },
  tabIconActive: { opacity: 1 },
  tabLabel: { fontSize: 10, fontWeight: '600', color: '#475569', letterSpacing: 0.3 },
  tabLabelActive: { color: '#3b82f6' },
  tabIndicator: {
    position: 'absolute',
    top: -10,
    width: 28,
    height: 3,
    backgroundColor: '#3b82f6',
    borderRadius: 2,
  },
});
