// src/screens/Connections.tsx
// Wearables connection management screen

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { palette } from '../../lib/tw';
import { supabase } from '../lib/supabase';
import {
  getConnectedAccounts,
  disconnectProvider,
  syncProvider,
} from '../lib/integrations';
import { Provider, SourceAccount } from '../types/integrations';
import { initHealthKit, syncHealthKit, isHealthKitAvailable } from '../integrations/healthkit';

interface ProviderConfig {
  id: Provider;
  name: string;
  color: string;
  icon: string;
  description: string;
  local?: boolean; // true for HealthKit/Health Connect
}

const PROVIDERS: ProviderConfig[] = [
  {
    id: 'oura',
    name: 'Oura Ring',
    color: palette.accent,
    icon: '💍',
    description: 'Sleep, readiness, activity',
  },
  {
    id: 'strava',
    name: 'Strava',
    color: '#FC4C02',
    icon: '🏃',
    description: 'Workouts, runs, rides',
  },
  {
    id: 'fitbit',
    name: 'Fitbit',
    color: '#00B0B9',
    icon: '⌚',
    description: 'Activity, sleep, heart rate',
  },
  {
    id: 'whoop',
    name: 'WHOOP',
    color: '#000',
    icon: '💪',
    description: 'Recovery, strain, sleep',
  },
  {
    id: 'apple_health',
    name: 'Apple Health',
    color: '#FF2D55',
    icon: '❤️',
    description: 'Steps, sleep, workouts',
    local: true,
  },
  {
    id: 'health_connect',
    name: 'Health Connect',
    color: palette.green,
    icon: '🏥',
    description: 'Steps, sleep, heart rate',
    local: true,
  },
];

export default function Connections() {
  const [accounts, setAccounts] = useState<SourceAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<Provider | null>(null);

  useEffect(() => {
    loadAccounts();
  }, []);

  async function loadAccounts() {
    try {
      setLoading(true);
      const data = await getConnectedAccounts();
      setAccounts(data);
    } catch (error: any) {
      console.error('Failed to load accounts:', error);
      Alert.alert('Error', 'Failed to load connections');
    } finally {
      setLoading(false);
    }
  }

  async function handleConnect(provider: Provider, isLocal: boolean) {
    if (isLocal) {
      // Local providers (HealthKit/Health Connect)
      if (provider === 'apple_health') {
        await handleConnectHealthKit();
      } else if (provider === 'health_connect') {
        Alert.alert(
          'Coming Soon',
          'Health Connect integration will be available in the next update.'
        );
      }
      return;
    }

    try {
      // Get Supabase project URL from environment
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'Please sign in first');
        return;
      }

      // Get Supabase URL from Constants
      const supabaseUrl = await getSupabaseUrl();
      
      // Create redirect URI (app deep link)
      const redirectUri = 'serraactive://oauth-callback';
      
      // Initiate OAuth flow
      const authUrl = `${supabaseUrl}/functions/v1/oauth-init/${provider}?user_id=${user.id}&redirect_uri=${encodeURIComponent(redirectUri)}`;

      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

      if (result.type === 'success') {
        Alert.alert('Success', `Connected to ${provider}!`);
        await loadAccounts();
      } else if (result.type === 'cancel') {
        // User cancelled
      }
    } catch (error: any) {
      console.error('OAuth error:', error);
      Alert.alert('Error', error.message || 'Failed to connect');
    }
  }

  async function handleDisconnect(provider: Provider) {
    Alert.alert(
      'Disconnect',
      `Are you sure you want to disconnect ${provider}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            try {
              await disconnectProvider(provider);
              Alert.alert('Success', 'Disconnected successfully');
              await loadAccounts();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to disconnect');
            }
          },
        },
      ]
    );
  }

  async function handleConnectHealthKit() {
    try {
      if (!isHealthKitAvailable()) {
        Alert.alert('Not Available', 'HealthKit is not available on this device');
        return;
      }

      // Initialize and request permissions
      await initHealthKit();
      
      // Perform initial sync
      const result = await syncHealthKit();
      
      if (result.success) {
        Alert.alert('Connected!', `Synced ${result.metrics_inserted} metrics from Apple Health`);
        await loadAccounts();
      } else {
        Alert.alert('Sync Failed', result.error || 'Unknown error');
      }
    } catch (error: any) {
      console.error('HealthKit connection error:', error);
      Alert.alert('Error', error.message || 'Failed to connect to HealthKit');
    }
  }

  async function handleSync(provider: Provider) {
    try {
      setSyncing(provider);
      
      // Local providers use different sync logic
      if (provider === 'apple_health') {
        const result = await syncHealthKit();
        if (result.success) {
          Alert.alert(
            'Sync Complete',
            `Synced ${result.metrics_inserted} metrics from Apple Health`
          );
          await loadAccounts();
        } else {
          Alert.alert('Sync Failed', result.error || 'Unknown error');
        }
      } else {
        // Cloud providers
        const result = await syncProvider(provider);
        
        if (result.success) {
          Alert.alert(
            'Sync Complete',
            `Synced ${result.metrics_inserted + result.metrics_updated} metrics`
          );
          await loadAccounts();
        } else {
          Alert.alert('Sync Failed', result.error || 'Unknown error');
        }
      }
    } catch (error: any) {
      console.error('Sync error:', error);
      Alert.alert('Error', error.message || 'Failed to sync');
    } finally {
      setSyncing(null);
    }
  }

  async function getSupabaseUrl(): Promise<string> {
    // Get from Constants.expoConfig.extra
    const Constants = await import('expo-constants');
    const extra = Constants.default.expoConfig?.extra as any;
    return extra?.supabaseUrl || '';
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={palette.accent} />
        <Text style={styles.loadingText}>Loading connections...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Connected Devices</Text>
      <Text style={styles.subtitle}>
        Connect your wearables to automatically sync health data
      </Text>

      {PROVIDERS.map((provider) => {
        const account = accounts.find((a) => a.provider === provider.id);
        const isConnected = account?.status === 'connected' || account?.status === 'connected_local';
        const isSyncing = syncing === provider.id;

        return (
          <ProviderCard
            key={provider.id}
            provider={provider}
            account={account}
            isConnected={isConnected}
            isSyncing={isSyncing}
            onConnect={() => handleConnect(provider.id, provider.local || false)}
            onDisconnect={() => handleDisconnect(provider.id)}
            onSync={() => handleSync(provider.id)}
          />
        );
      })}

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Your data is encrypted and only accessible by you.
        </Text>
      </View>
    </ScrollView>
  );
}

interface ProviderCardProps {
  provider: ProviderConfig;
  account?: SourceAccount;
  isConnected: boolean;
  isSyncing: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onSync: () => void;
}

function ProviderCard({
  provider,
  account,
  isConnected,
  isSyncing,
  onConnect,
  onDisconnect,
  onSync,
}: ProviderCardProps) {
  const lastSync = account?.last_sync_at
    ? new Date(account.last_sync_at).toLocaleString()
    : 'Never';

  return (
    <View style={[styles.card, { borderLeftColor: provider.color, borderLeftWidth: 4 }]}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardIcon}>{provider.icon}</Text>
          <View style={styles.cardTitleContainer}>
            <Text style={styles.cardTitle}>{provider.name}</Text>
            <Text style={styles.cardDescription}>{provider.description}</Text>
          </View>
        </View>
        {isConnected && (
          <View style={[styles.statusBadge, { backgroundColor: palette.green }]}>
            <Text style={styles.statusText}>Connected</Text>
          </View>
        )}
      </View>

      {isConnected && account && (
        <View style={styles.cardInfo}>
          <Text style={styles.infoText}>Last synced: {lastSync}</Text>
        </View>
      )}

      <View style={styles.cardActions}>
        {!isConnected ? (
          <Pressable
            style={[styles.button, styles.connectButton, { backgroundColor: provider.color }]}
            onPress={onConnect}
          >
            <FontAwesome5 name="link" size={14} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.buttonText}>Connect</Text>
          </Pressable>
        ) : (
          <>
            <Pressable
              style={[styles.button, styles.syncButton]}
              onPress={onSync}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <ActivityIndicator size="small" color={palette.text} />
              ) : (
                <>
                  <FontAwesome5 name="sync-alt" size={14} color={palette.text} style={{ marginRight: 8 }} />
                  <Text style={[styles.buttonText, { color: palette.text }]}>Sync Now</Text>
                </>
              )}
            </Pressable>
            <Pressable
              style={[styles.button, styles.disconnectButton]}
              onPress={onDisconnect}
            >
              <FontAwesome5 name="unlink" size={14} color="#ef4444" style={{ marginRight: 8 }} />
              <Text style={[styles.buttonText, { color: '#ef4444' }]}>Disconnect</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  content: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: palette.background,
  },
  loadingText: {
    color: palette.text,
    marginTop: 12,
    fontSize: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: palette.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: palette.text,
    opacity: 0.7,
    marginBottom: 24,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cardIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  cardTitleContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: palette.text,
  },
  cardDescription: {
    fontSize: 13,
    color: palette.text,
    opacity: 0.6,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  cardInfo: {
    marginBottom: 12,
  },
  infoText: {
    fontSize: 13,
    color: palette.text,
    opacity: 0.7,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  connectButton: {
    // backgroundColor set dynamically
  },
  syncButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  disconnectButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    marginTop: 24,
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
  },
  footerText: {
    fontSize: 13,
    color: palette.text,
    opacity: 0.6,
    textAlign: 'center',
  },
});
