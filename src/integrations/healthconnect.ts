// src/integrations/healthconnect.ts
// Health Connect integration for Android
// Syncs steps, sleep, heart rate from Google Fit / Samsung Health

import { Platform } from 'react-native';
import {
  initialize,
  requestPermission,
  readRecords,
  SdkAvailabilityStatus,
  getSdkStatus,
} from 'react-native-health-connect';
import { supabase } from '../lib/supabase';

const PERMISSIONS = [
  { accessType: 'read', recordType: 'Steps' },
  { accessType: 'read', recordType: 'SleepSession' },
  { accessType: 'read', recordType: 'HeartRate' },
  { accessType: 'read', recordType: 'Distance' },
  { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
] as const;

/**
 * Initialize Health Connect and request permissions
 */
export async function initHealthConnect(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    throw new Error('Health Connect is only available on Android');
  }

  try {
    // Check if Health Connect is available
    const status = await getSdkStatus();
    if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) {
      throw new Error('Health Connect is not available on this device');
    }

    // Initialize
    const isInitialized = await initialize();
    if (!isInitialized) {
      throw new Error('Failed to initialize Health Connect');
    }

    // Request permissions
    const granted = await requestPermission(PERMISSIONS as any);
    return !!granted;
  } catch (error: any) {
    console.error('Health Connect init error:', error);
    throw error;
  }
}

/**
 * Check if Health Connect is available on this device
 */
export async function isHealthConnectAvailable(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  
  try {
    const status = await getSdkStatus();
    return status === SdkAvailabilityStatus.SDK_AVAILABLE;
  } catch {
    return false;
  }
}

/**
 * Sync Health Connect data to metrics table
 */
export async function syncHealthConnect(): Promise<{
  success: boolean;
  metrics_inserted: number;
  metrics_updated: number;
  error?: string;
}> {
  try {
    if (Platform.OS !== 'android') {
      throw new Error('Health Connect only available on Android');
    }

    // Check availability
    const available = await isHealthConnectAvailable();
    if (!available) {
      throw new Error('Health Connect not available');
    }

    // Initialize if needed
    await initHealthConnect();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    // Get last sync cursor
    const { data: cursor } = await supabase
      .from('sync_cursors')
      .select('last_cursor')
      .eq('user_id', user.id)
      .eq('provider', 'health_connect')
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
    const sleepSessions = await getSleep(new Date(lastSync), now);
    for (const sleep of sleepSessions) {
      const metrics = normalizeSleep(sleep, user.id);
      const { error } = await upsertMetrics(metrics);
      if (!error) metricsInserted++;
    }

    // Sync Active Calories
    const calories = await getActiveCalories(new Date(lastSync), now);
    for (const cal of calories) {
      const metrics = normalizeActiveCalories(cal, user.id);
      const { error } = await upsertMetrics(metrics);
      if (!error) metricsInserted++;
    }

    // Sync Heart Rate
    const heartRates = await getHeartRate(new Date(lastSync), now);
    for (const hr of heartRates) {
      const metrics = normalizeHeartRate(hr, user.id);
      const { error } = await upsertMetrics(metrics);
      if (!error) metricsInserted++;
    }

    // Update sync cursor
    await supabase
      .from('sync_cursors')
      .upsert({
        user_id: user.id,
        provider: 'health_connect',
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
        provider: 'health_connect',
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
    console.error('Health Connect sync error:', error);
    return {
      success: false,
      metrics_inserted: 0,
      metrics_updated: 0,
      error: error.message || 'Health Connect sync failed',
    };
  }
}

/**
 * Get steps data from Health Connect
 */
async function getSteps(startDate: Date, endDate: Date): Promise<any[]> {
  try {
    const result = await readRecords('Steps', {
      timeRangeFilter: {
        operator: 'between',
        startTime: startDate.toISOString(),
        endTime: endDate.toISOString(),
      },
    });
    return result.records || [];
  } catch (error) {
    console.error('Error reading steps:', error);
    return [];
  }
}

/**
 * Get sleep data from Health Connect
 */
async function getSleep(startDate: Date, endDate: Date): Promise<any[]> {
  try {
    const result = await readRecords('SleepSession', {
      timeRangeFilter: {
        operator: 'between',
        startTime: startDate.toISOString(),
        endTime: endDate.toISOString(),
      },
    });
    return result.records || [];
  } catch (error) {
    console.error('Error reading sleep:', error);
    return [];
  }
}

/**
 * Get active calories from Health Connect
 */
async function getActiveCalories(startDate: Date, endDate: Date): Promise<any[]> {
  try {
    const result = await readRecords('ActiveCaloriesBurned', {
      timeRangeFilter: {
        operator: 'between',
        startTime: startDate.toISOString(),
        endTime: endDate.toISOString(),
      },
    });
    return result.records || [];
  } catch (error) {
    console.error('Error reading calories:', error);
    return [];
  }
}

/**
 * Get heart rate from Health Connect
 */
async function getHeartRate(startDate: Date, endDate: Date): Promise<any[]> {
  try {
    const result = await readRecords('HeartRate', {
      timeRangeFilter: {
        operator: 'between',
        startTime: startDate.toISOString(),
        endTime: endDate.toISOString(),
      },
    });
    return result.records || [];
  } catch (error) {
    console.error('Error reading heart rate:', error);
    return [];
  }
}

/**
 * Normalize steps data to metrics format
 */
function normalizeSteps(step: any, userId: string) {
  const day = step.startTime.split('T')[0];
  const timestamp = step.startTime;

  return [{
    user_id: userId,
    provider: 'health_connect',
    metric_type: 'steps',
    value: step.count,
    unit: 'count',
    timestamp,
    day,
    metadata: { 
      source: step.metadata?.dataOrigin?.packageName || 'Health Connect'
    },
  }];
}

/**
 * Normalize sleep data to metrics format
 */
function normalizeSleep(sleep: any, userId: string) {
  const day = sleep.startTime.split('T')[0];
  const timestamp = sleep.startTime;
  
  // Calculate duration in minutes
  const start = new Date(sleep.startTime);
  const end = new Date(sleep.endTime);
  const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);

  return [{
    user_id: userId,
    provider: 'health_connect',
    metric_type: 'sleep_duration',
    value: durationMinutes,
    unit: 'minutes',
    timestamp,
    day,
    metadata: { 
      title: sleep.title,
      notes: sleep.notes,
      source: sleep.metadata?.dataOrigin?.packageName || 'Health Connect'
    },
  }];
}

/**
 * Normalize active calories to metrics format
 */
function normalizeActiveCalories(cal: any, userId: string) {
  const day = cal.startTime.split('T')[0];
  const timestamp = cal.startTime;

  return [{
    user_id: userId,
    provider: 'health_connect',
    metric_type: 'calories_active',
    value: cal.energy?.inKilocalories || 0,
    unit: 'kcal',
    timestamp,
    day,
    metadata: { 
      source: cal.metadata?.dataOrigin?.packageName || 'Health Connect'
    },
  }];
}

/**
 * Normalize heart rate to metrics format
 */
function normalizeHeartRate(hr: any, userId: string) {
  const day = hr.time.split('T')[0];
  const timestamp = hr.time;

  return [{
    user_id: userId,
    provider: 'health_connect',
    metric_type: 'heart_rate',
    value: hr.beatsPerMinute,
    unit: 'bpm',
    timestamp,
    day,
    metadata: { 
      source: hr.metadata?.dataOrigin?.packageName || 'Health Connect'
    },
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
