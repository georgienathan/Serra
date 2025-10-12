// src/integrations/healthkit.ts
// HealthKit integration for iOS
// Syncs steps, sleep, workouts from Apple Health

import { Platform } from 'react-native';
import AppleHealthKit, {
  HealthValue,
  HealthKitPermissions,
} from 'react-native-health';
import { supabase } from '../lib/supabase';

const PERMISSIONS: HealthKitPermissions = {
  permissions: {
    read: [
      AppleHealthKit.Constants.Permissions.Steps,
      AppleHealthKit.Constants.Permissions.SleepAnalysis,
      AppleHealthKit.Constants.Permissions.ActiveEnergyBurned,
      AppleHealthKit.Constants.Permissions.DistanceWalkingRunning,
      AppleHealthKit.Constants.Permissions.HeartRate,
    ],
    write: [],
  },
};

/**
 * Initialize HealthKit and request permissions
 */
export async function initHealthKit(): Promise<boolean> {
  if (Platform.OS !== 'ios') {
    throw new Error('HealthKit is only available on iOS');
  }

  return new Promise((resolve, reject) => {
    AppleHealthKit.initHealthKit(PERMISSIONS, (error: string) => {
      if (error) {
        console.error('HealthKit init error:', error);
        reject(new Error(error));
      } else {
        resolve(true);
      }
    });
  });
}

/**
 * Check if HealthKit is available on this device
 */
export function isHealthKitAvailable(): boolean {
  if (Platform.OS !== 'ios') return false;
  // HealthKit is always available on iOS devices (but may require permissions)
  return true;
}

/**
 * Sync HealthKit data to metrics table
 */
export async function syncHealthKit(): Promise<{
  success: boolean;
  metrics_inserted: number;
  metrics_updated: number;
  error?: string;
}> {
  try {
    if (!isHealthKitAvailable()) {
      throw new Error('HealthKit not available');
    }

    // Initialize if needed
    await initHealthKit();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    // Get last sync cursor
    const { data: cursor } = await supabase
      .from('sync_cursors')
      .select('last_cursor')
      .eq('user_id', user.id)
      .eq('provider', 'apple_health')
      .single();

    const lastSync = cursor?.last_cursor || getDefaultStartDate();
    const now = new Date();

    let metricsInserted = 0;

    // Sync Steps
    const steps = await getSteps(new Date(lastSync), now);
    for (const step of steps) {
      const metrics = normalizeSteps(step, user.id);
      const { error } = await upsertMetrics(metrics);
      if (!error) metricsInserted++;
    }

    // Sync Sleep
    const sleepSamples = await getSleep(new Date(lastSync), now);
    for (const sleep of sleepSamples) {
      const metrics = normalizeSleep(sleep, user.id);
      const { error } = await upsertMetrics(metrics);
      if (!error) metricsInserted++;
    }

    // Sync Active Energy
    const energy = await getActiveEnergy(new Date(lastSync), now);
    for (const e of energy) {
      const metrics = normalizeActiveEnergy(e, user.id);
      const { error } = await upsertMetrics(metrics);
      if (!error) metricsInserted++;
    }

    // Update sync cursor
    await supabase
      .from('sync_cursors')
      .upsert({
        user_id: user.id,
        provider: 'apple_health',
        last_cursor: now.toISOString().split('T')[0],
        updated_at: now.toISOString(),
      }, {
        onConflict: 'user_id,provider',
      });

    // Update source_account
    await supabase
      .from('source_accounts')
      .upsert({
        user_id: user.id,
        provider: 'apple_health',
        status: 'connected_local',
        last_sync_at: now.toISOString(),
        updated_at: now.toISOString(),
      }, {
        onConflict: 'user_id,provider',
      });

    return {
      success: true,
      metrics_inserted: metricsInserted,
      metrics_updated: 0,
    };

  } catch (error: any) {
    console.error('HealthKit sync error:', error);
    return {
      success: false,
      metrics_inserted: 0,
      metrics_updated: 0,
      error: error.message || 'HealthKit sync failed',
    };
  }
}

/**
 * Get steps data from HealthKit
 */
function getSteps(startDate: Date, endDate: Date): Promise<HealthValue[]> {
  return new Promise((resolve, reject) => {
    const options = {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      includeManuallyAdded: false,
    };

    AppleHealthKit.getDailyStepCountSamples(options, (err: Object, results: HealthValue[]) => {
      if (err) {
        reject(err);
      } else {
        resolve(results || []);
      }
    });
  });
}

/**
 * Get sleep data from HealthKit
 */
function getSleep(startDate: Date, endDate: Date): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const options = {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    };

    AppleHealthKit.getSleepSamples(options, (err: Object, results: any[]) => {
      if (err) {
        reject(err);
      } else {
        resolve(results || []);
      }
    });
  });
}

/**
 * Get active energy burned from HealthKit
 */
function getActiveEnergy(startDate: Date, endDate: Date): Promise<HealthValue[]> {
  return new Promise((resolve, reject) => {
    const options = {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    };

    AppleHealthKit.getActiveEnergyBurned(options, (err: Object, results: HealthValue[]) => {
      if (err) {
        reject(err);
      } else {
        resolve(results || []);
      }
    });
  });
}

/**
 * Normalize steps data to metrics format
 */
function normalizeSteps(step: HealthValue, userId: string) {
  const day = step.startDate.split('T')[0];
  const timestamp = step.startDate;

  return [{
    user_id: userId,
    provider: 'apple_health',
    metric_type: 'steps',
    value: step.value,
    unit: 'count',
    timestamp,
    day,
    metadata: { source: (step as any).sourceName || 'HealthKit' },
  }];
}

/**
 * Normalize sleep data to metrics format
 */
function normalizeSleep(sleep: any, userId: string) {
  const day = sleep.startDate.split('T')[0];
  const timestamp = sleep.startDate;
  
  // Calculate duration in minutes
  const start = new Date(sleep.startDate);
  const end = new Date(sleep.endDate);
  const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);

  return [{
    user_id: userId,
    provider: 'apple_health',
    metric_type: 'sleep_duration',
    value: durationMinutes,
    unit: 'minutes',
    timestamp,
    day,
    metadata: { 
      value: sleep.value, // 'ASLEEP', 'INBED', etc.
      source: sleep.sourceName 
    },
  }];
}

/**
 * Normalize active energy to metrics format
 */
function normalizeActiveEnergy(energy: HealthValue, userId: string) {
  const day = energy.startDate.split('T')[0];
  const timestamp = energy.startDate;

  return [{
    user_id: userId,
    provider: 'apple_health',
    metric_type: 'calories_active',
    value: energy.value,
    unit: 'kcal',
    timestamp,
    day,
    metadata: { source: (energy as any).sourceName || 'HealthKit' },
  }];
}

/**
 * Upsert metrics to database
 */
async function upsertMetrics(metrics: any[]) {
  return await supabase
    .from('metrics')
    .upsert(metrics, {
      onConflict: 'user_id,provider,metric_type,timestamp',
    });
}

/**
 * Get default start date (7 days ago)
 */
function getDefaultStartDate(): string {
  const date = new Date();
  date.setDate(date.getDate() - 7);
  return date.toISOString().split('T')[0];
}
