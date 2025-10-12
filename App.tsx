import 'react-native-gesture-handler';

import * as React from 'react';
import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Text, Pressable, ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DefaultTheme } from '@react-navigation/native';

import { supabase } from './src/lib/supabase';
import AuthScreen from './src/screens/Auth';
import Onboarding from './src/screens/onboarding/Onboarding';

import Dashboard from './src/screens/Dashboard';
import About from './src/screens/About';
import Cycle from './src/screens/Cycle';
import Nutrition from './src/screens/Nutrition';
import Exercise from './src/screens/Exercise';
import Connections from './src/screens/Connections';

import { FontAwesome5 } from '@expo/vector-icons';
import { palette } from './lib/tw'; 

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
const qc = new QueryClient();

const Tab = createBottomTabNavigator();

const iconFor = (routeName: string) => {
  switch (routeName) {
    case 'Dashboard':
      return 'home';
    case 'About':
      return 'info-circle';
    case 'Cycle':
      return 'circle-notch';
    case 'Nutrition':
      return 'utensils';
    case 'Exercise':
    default:
      return 'dumbbell';
  }
};

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [checkingProfile, setCheckingProfile] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const userId = session?.user.id ?? null;

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
    };
    init();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!userId) {
        setNeedsOnboarding(false);
        return;
      }
      setCheckingProfile(true);
      const { data } = await supabase
        .from('profiles')
        .select('onboarded')
        .eq('id', userId)
        .maybeSingle();

      if (!cancelled) {
        setNeedsOnboarding(!data || data.onboarded !== true);
        setCheckingProfile(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

const AppTabs = (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      headerTitleAlign: 'center',
      headerStyle: { backgroundColor: palette.background },
      headerTitleStyle: { color: palette.text },
      headerRight: () => (
        <Pressable onPress={() => supabase.auth.signOut()} style={{ paddingRight: 12 }}>
          <Text style={{ color: palette.text }}>Sign out</Text>
        </Pressable>
      ),
      tabBarStyle: { backgroundColor: palette.background, borderTopColor: 'transparent' },
      tabBarActiveTintColor: palette.accent,
      tabBarInactiveTintColor: palette.accent,
      tabBarLabelStyle: { color: palette.accent },
      tabBarIcon: ({ color, size }) => (
        <FontAwesome5 name={iconFor(route.name) as any} size={size ?? 18} color={color} />
      ),
    })}
  >
    <Tab.Screen name="Dashboard" component={Dashboard} />
    <Tab.Screen name="About" component={About} />
    <Tab.Screen name="Cycle" component={Cycle} />
    <Tab.Screen name="Nutrition" component={Nutrition} />
    <Tab.Screen name="Exercise" component={Exercise} />
    <Tab.Screen 
      name="Connections" 
      component={Connections}
      options={{ tabBarButton: () => null }} // Hidden from tab bar, accessed via About screen
    />
  </Tab.Navigator>
);

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: palette.background,
    card: palette.background,
    text: palette.text,
    border: 'transparent',
  },
};

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: palette.background }}>
      <SafeAreaProvider>
        <NavigationContainer theme={navTheme}>
          {/* ... */}
          {!session ? (
            <AuthScreen />
          ) : checkingProfile ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator />
              <Text style={{ marginTop: 8, color: palette.text }}>Loading profile…</Text>
            </View>
          ) : needsOnboarding ? (
            <Onboarding userId={userId!} onDone={() => setNeedsOnboarding(false)} />
          ) : (
            AppTabs
          )}
        </NavigationContainer>
        <QueryClientProvider client={qc}>
          {/* existing NavigationContainer / tabs */}
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
