import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { PinAuthScreen } from './src/screens/PinAuthScreen';
import { MainTabs } from './src/navigation/MainTabs';
import { loadSounds, unloadSounds } from './src/utils/audio';

export type RootStackParamList = {
  PinAuth: undefined;
  Main: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

const NAV_THEME = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#0f172a',
    card: '#0f172a',
    text: '#f1f5f9',
    border: '#1e293b',
    primary: '#3b82f6',
  },
};

export default function App() {
  useEffect(() => {
    loadSounds();
    return () => { unloadSounds(); };
  }, []);

  return (
    <NavigationContainer theme={NAV_THEME}>
      <StatusBar style="light" backgroundColor="#0f172a" />
      <Stack.Navigator
        initialRouteName="PinAuth"
        screenOptions={{ headerShown: false, cardStyle: { backgroundColor: '#0f172a' } }}
      >
        <Stack.Screen name="PinAuth" component={PinAuthScreen} />
        <Stack.Screen name="Main" component={MainTabs} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
