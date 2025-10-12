// supabase/functions/sync-provider/index.ts
// Sync data from a connected wearable provider
// URL: https://<project>.supabase.co/functions/v1/sync-provider

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { provider, user_id } = await req.json();

    if (!provider || !user_id) {
      throw new Error('Missing provider or user_id');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get source account
    const { data: account, error: accountError } = await supabase
      .from('source_accounts')
      .select('*')
      .eq('user_id', user_id)
      .eq('provider', provider)
      .single();

    if (accountError || !account) {
      throw new Error(`No connected account found for ${provider}`);
    }

    if (account.status !== 'connected') {
      throw new Error(`Account is ${account.status}, cannot sync`);
    }

    // Check if token needs refresh
    let accessToken = account.access_token;
    if (account.token_expires_at) {
      const expiresAt = new Date(account.token_expires_at);
      const now = new Date();
      const fiveMinutes = 5 * 60 * 1000;

      if (expiresAt.getTime() - now.getTime() < fiveMinutes) {
        // Token expired or expiring soon - refresh it
        accessToken = await refreshToken(supabase, account);
      }
    }

    // Route to provider-specific sync
    let result;
    switch (provider) {
      case 'oura':
        result = await syncOura(supabase, user_id, accessToken);
        break;
      case 'strava':
        result = await syncStrava(supabase, user_id, accessToken);
        break;
      case 'fitbit':
        result = await syncFitbit(supabase, user_id, accessToken);
        break;
      case 'whoop':
        result = await syncWhoop(supabase, user_id, accessToken);
        break;
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }

    // Update last_sync_at
    await supabase
      .from('source_accounts')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', account.id);

    return new Response(JSON.stringify({
      success: true,
      provider,
      ...result,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Sync error:', error);
    
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message || 'Sync failed' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// ============================================================================
// TOKEN REFRESH
// ============================================================================

async function refreshToken(supabase: any, account: any): Promise<string> {
  if (!account.refresh_token) {
    throw new Error('No refresh token available');
  }

  const configs: Record<string, any> = {
    oura: {
      url: 'https://api.ouraring.com/oauth/token',
      clientId: Deno.env.get('OURA_CLIENT_ID'),
      clientSecret: Deno.env.get('OURA_CLIENT_SECRET'),
    },
    strava: {
      url: 'https://www.strava.com/oauth/token',
      clientId: Deno.env.get('STRAVA_CLIENT_ID'),
      clientSecret: Deno.env.get('STRAVA_CLIENT_SECRET'),
    },
    fitbit: {
      url: 'https://api.fitbit.com/oauth2/token',
      clientId: Deno.env.get('FITBIT_CLIENT_ID'),
      clientSecret: Deno.env.get('FITBIT_CLIENT_SECRET'),
    },
    whoop: {
      url: 'https://api.prod.whoop.com/oauth/token',
      clientId: Deno.env.get('WHOOP_CLIENT_ID'),
      clientSecret: Deno.env.get('WHOOP_CLIENT_SECRET'),
    },
  };

  const config = configs[account.provider];
  if (!config) {
    throw new Error(`No refresh config for ${account.provider}`);
  }

  const response = await fetch(config.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: account.refresh_token,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }),
  });

  if (!response.ok) {
    throw new Error(`Token refresh failed: ${await response.text()}`);
  }

  const tokens = await response.json();
  const expiresAt = tokens.expires_in 
    ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    : null;

  // Update tokens in DB
  await supabase
    .from('source_accounts')
    .update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || account.refresh_token,
      token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', account.id);

  return tokens.access_token;
}

// ============================================================================
// OURA SYNC
// ============================================================================

async function syncOura(supabase: any, userId: string, accessToken: string) {
  // Get last sync cursor
  const { data: cursor } = await supabase
    .from('sync_cursors')
    .select('last_cursor')
    .eq('user_id', userId)
    .eq('provider', 'oura')
    .single();

  const lastSync = cursor?.last_cursor || getDefaultStartDate();

  let metricsInserted = 0;
  let metricsUpdated = 0;

  // Sync Sleep data
  const sleepData = await fetchOuraSleep(accessToken, lastSync);
  for (const sleep of sleepData) {
    const normalized = normalizeOuraSleep(sleep, userId);
    const { error } = await upsertMetrics(supabase, normalized);
    if (!error) metricsInserted++;
  }

  // Sync Daily Activity
  const dailyData = await fetchOuraDaily(accessToken, lastSync);
  for (const daily of dailyData) {
    const normalized = normalizeOuraDaily(daily, userId);
    const { error } = await upsertMetrics(supabase, normalized);
    if (!error) metricsInserted++;
  }

  // Sync Readiness
  const readinessData = await fetchOuraReadiness(accessToken, lastSync);
  for (const readiness of readinessData) {
    const normalized = normalizeOuraReadiness(readiness, userId);
    const { error } = await upsertMetrics(supabase, normalized);
    if (!error) metricsInserted++;
  }

  // Update sync cursor
  await supabase
    .from('sync_cursors')
    .upsert({
      user_id: userId,
      provider: 'oura',
      last_cursor: new Date().toISOString().split('T')[0],
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,provider',
    });

  return { metrics_inserted: metricsInserted, metrics_updated: metricsUpdated };
}

async function fetchOuraSleep(accessToken: string, startDate: string) {
  const url = `https://api.ouraring.com/v2/usercollection/sleep?start_date=${startDate}`;
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Oura API error: ${response.status}`);
  }

  const data = await response.json();
  return data.data || [];
}

async function fetchOuraDaily(accessToken: string, startDate: string) {
  const url = `https://api.ouraring.com/v2/usercollection/daily_activity?start_date=${startDate}`;
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Oura API error: ${response.status}`);
  }

  const data = await response.json();
  return data.data || [];
}

async function fetchOuraReadiness(accessToken: string, startDate: string) {
  const url = `https://api.ouraring.com/v2/usercollection/daily_readiness?start_date=${startDate}`;
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Oura API error: ${response.status}`);
  }

  const data = await response.json();
  return data.data || [];
}

function normalizeOuraSleep(sleep: any, userId: string) {
  const day = sleep.day;
  const timestamp = sleep.bedtime_start;

  return [
    {
      user_id: userId,
      provider: 'oura',
      metric_type: 'sleep_duration',
      value: sleep.total_sleep_duration / 60, // Convert seconds to minutes
      unit: 'minutes',
      timestamp,
      day,
      metadata: { sleep_id: sleep.id },
    },
    {
      user_id: userId,
      provider: 'oura',
      metric_type: 'sleep_score',
      value: sleep.score,
      unit: 'score',
      timestamp,
      day,
      metadata: { sleep_id: sleep.id },
    },
    sleep.deep_sleep_duration && {
      user_id: userId,
      provider: 'oura',
      metric_type: 'sleep_deep',
      value: sleep.deep_sleep_duration / 60,
      unit: 'minutes',
      timestamp,
      day,
      metadata: { sleep_id: sleep.id },
    },
    sleep.rem_sleep_duration && {
      user_id: userId,
      provider: 'oura',
      metric_type: 'sleep_rem',
      value: sleep.rem_sleep_duration / 60,
      unit: 'minutes',
      timestamp,
      day,
      metadata: { sleep_id: sleep.id },
    },
  ].filter(Boolean);
}

function normalizeOuraDaily(daily: any, userId: string) {
  const day = daily.day;
  const timestamp = `${day}T12:00:00Z`;

  return [
    daily.steps && {
      user_id: userId,
      provider: 'oura',
      metric_type: 'steps',
      value: daily.steps,
      unit: 'count',
      timestamp,
      day,
      metadata: { daily_id: daily.id },
    },
    daily.active_calories && {
      user_id: userId,
      provider: 'oura',
      metric_type: 'calories_active',
      value: daily.active_calories,
      unit: 'kcal',
      timestamp,
      day,
      metadata: { daily_id: daily.id },
    },
    daily.score && {
      user_id: userId,
      provider: 'oura',
      metric_type: 'activity_score',
      value: daily.score,
      unit: 'score',
      timestamp,
      day,
      metadata: { daily_id: daily.id },
    },
  ].filter(Boolean);
}

function normalizeOuraReadiness(readiness: any, userId: string) {
  const day = readiness.day;
  const timestamp = `${day}T06:00:00Z`;

  return [
    {
      user_id: userId,
      provider: 'oura',
      metric_type: 'readiness_score',
      value: readiness.score,
      unit: 'score',
      timestamp,
      day,
      metadata: { readiness_id: readiness.id },
    },
    readiness.temperature_deviation && {
      user_id: userId,
      provider: 'oura',
      metric_type: 'temperature_deviation',
      value: readiness.temperature_deviation,
      unit: 'celsius',
      timestamp,
      day,
      metadata: { readiness_id: readiness.id },
    },
  ].filter(Boolean);
}

async function upsertMetrics(supabase: any, metrics: any[]) {
  return await supabase
    .from('metrics')
    .upsert(metrics, {
      onConflict: 'user_id,provider,metric_type,timestamp',
    });
}

// ============================================================================
// STRAVA SYNC
// ============================================================================

async function syncStrava(supabase: any, userId: string, accessToken: string) {
  // Get last sync cursor
  const { data: cursor } = await supabase
    .from('sync_cursors')
    .select('last_cursor')
    .eq('user_id', userId)
    .eq('provider', 'strava')
    .single();

  const lastSync = cursor?.last_cursor ? new Date(cursor.last_cursor).getTime() / 1000 : Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60);

  let metricsInserted = 0;

  // Sync Activities
  const activities = await fetchStravaActivities(accessToken, lastSync);
  for (const activity of activities) {
    const normalized = normalizeStravaActivity(activity, userId);
    const { error } = await upsertMetrics(supabase, normalized);
    if (!error) metricsInserted++;
  }

  // Update sync cursor
  await supabase
    .from('sync_cursors')
    .upsert({
      user_id: userId,
      provider: 'strava',
      last_cursor: new Date().toISOString().split('T')[0],
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,provider',
    });

  return { metrics_inserted: metricsInserted, metrics_updated: 0 };
}

async function fetchStravaActivities(accessToken: string, after: number) {
  const url = `https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=100`;
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Strava API error: ${response.status}`);
  }

  return await response.json();
}

function normalizeStravaActivity(activity: any, userId: string) {
  const day = activity.start_date.split('T')[0];
  const timestamp = activity.start_date;

  return [
    {
      user_id: userId,
      provider: 'strava',
      metric_type: 'workout_duration',
      value: activity.moving_time / 60, // Convert seconds to minutes
      unit: 'minutes',
      timestamp,
      day,
      metadata: { 
        activity_id: activity.id,
        name: activity.name,
        type: activity.type,
      },
    },
    activity.distance && {
      user_id: userId,
      provider: 'strava',
      metric_type: 'distance',
      value: activity.distance / 1000, // Convert meters to km
      unit: 'km',
      timestamp,
      day,
      metadata: { activity_id: activity.id },
    },
    activity.calories && {
      user_id: userId,
      provider: 'strava',
      metric_type: 'calories_active',
      value: activity.calories,
      unit: 'kcal',
      timestamp,
      day,
      metadata: { activity_id: activity.id },
    },
    activity.average_heartrate && {
      user_id: userId,
      provider: 'strava',
      metric_type: 'heart_rate_avg',
      value: activity.average_heartrate,
      unit: 'bpm',
      timestamp,
      day,
      metadata: { activity_id: activity.id },
    },
  ].filter(Boolean);
}

// ============================================================================
// FITBIT SYNC
// ============================================================================

async function syncFitbit(supabase: any, userId: string, accessToken: string) {
  // Get last sync cursor
  const { data: cursor } = await supabase
    .from('sync_cursors')
    .select('last_cursor')
    .eq('user_id', userId)
    .eq('provider', 'fitbit')
    .single();

  const lastSync = cursor?.last_cursor || getDefaultStartDate();
  const today = new Date().toISOString().split('T')[0];

  let metricsInserted = 0;

  // Sync Activity (steps, calories)
  const activityData = await fetchFitbitActivity(accessToken, lastSync, today);
  if (activityData) {
    const normalized = normalizeFitbitActivity(activityData, userId);
    const { error } = await upsertMetrics(supabase, normalized);
    if (!error) metricsInserted++;
  }

  // Sync Sleep
  const sleepData = await fetchFitbitSleep(accessToken, lastSync, today);
  for (const sleep of sleepData) {
    const normalized = normalizeFitbitSleep(sleep, userId);
    const { error } = await upsertMetrics(supabase, normalized);
    if (!error) metricsInserted++;
  }

  // Sync Heart Rate
  const heartRateData = await fetchFitbitHeartRate(accessToken, lastSync, today);
  if (heartRateData) {
    const normalized = normalizeFitbitHeartRate(heartRateData, userId);
    const { error } = await upsertMetrics(supabase, normalized);
    if (!error) metricsInserted++;
  }

  // Update sync cursor
  await supabase
    .from('sync_cursors')
    .upsert({
      user_id: userId,
      provider: 'fitbit',
      last_cursor: today,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,provider',
    });

  return { metrics_inserted: metricsInserted, metrics_updated: 0 };
}

async function fetchFitbitActivity(accessToken: string, startDate: string, endDate: string) {
  const url = `https://api.fitbit.com/1/user/-/activities/date/${startDate}/${endDate}.json`;
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Fitbit API error: ${response.status}`);
  }

  const data = await response.json();
  return data.summary;
}

async function fetchFitbitSleep(accessToken: string, startDate: string, endDate: string) {
  const url = `https://api.fitbit.com/1.2/user/-/sleep/date/${startDate}/${endDate}.json`;
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Fitbit API error: ${response.status}`);
  }

  const data = await response.json();
  return data.sleep || [];
}

async function fetchFitbitHeartRate(accessToken: string, startDate: string, endDate: string) {
  const url = `https://api.fitbit.com/1/user/-/activities/heart/date/${startDate}/${endDate}.json`;
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Fitbit API error: ${response.status}`);
  }

  const data = await response.json();
  return data['activities-heart'];
}

function normalizeFitbitActivity(activity: any, userId: string) {
  const day = new Date().toISOString().split('T')[0];
  const timestamp = `${day}T12:00:00Z`;

  return [
    activity.steps && {
      user_id: userId,
      provider: 'fitbit',
      metric_type: 'steps',
      value: activity.steps,
      unit: 'count',
      timestamp,
      day,
      metadata: {},
    },
    activity.caloriesOut && {
      user_id: userId,
      provider: 'fitbit',
      metric_type: 'calories_total',
      value: activity.caloriesOut,
      unit: 'kcal',
      timestamp,
      day,
      metadata: {},
    },
    activity.activityCalories && {
      user_id: userId,
      provider: 'fitbit',
      metric_type: 'calories_active',
      value: activity.activityCalories,
      unit: 'kcal',
      timestamp,
      day,
      metadata: {},
    },
  ].filter(Boolean);
}

function normalizeFitbitSleep(sleep: any, userId: string) {
  const day = sleep.dateOfSleep;
  const timestamp = sleep.startTime;

  return [
    {
      user_id: userId,
      provider: 'fitbit',
      metric_type: 'sleep_duration',
      value: sleep.duration / 60000, // Convert ms to minutes
      unit: 'minutes',
      timestamp,
      day,
      metadata: { 
        sleep_id: sleep.logId,
        efficiency: sleep.efficiency,
      },
    },
    sleep.levels?.summary?.deep?.minutes && {
      user_id: userId,
      provider: 'fitbit',
      metric_type: 'sleep_deep',
      value: sleep.levels.summary.deep.minutes,
      unit: 'minutes',
      timestamp,
      day,
      metadata: { sleep_id: sleep.logId },
    },
    sleep.levels?.summary?.rem?.minutes && {
      user_id: userId,
      provider: 'fitbit',
      metric_type: 'sleep_rem',
      value: sleep.levels.summary.rem.minutes,
      unit: 'minutes',
      timestamp,
      day,
      metadata: { sleep_id: sleep.logId },
    },
  ].filter(Boolean);
}

function normalizeFitbitHeartRate(heartRate: any, userId: string) {
  const metrics: any[] = [];

  for (const day of heartRate) {
    const dayStr = day.dateTime;
    const timestamp = `${dayStr}T12:00:00Z`;

    if (day.value?.restingHeartRate) {
      metrics.push({
        user_id: userId,
        provider: 'fitbit',
        metric_type: 'heart_rate_resting',
        value: day.value.restingHeartRate,
        unit: 'bpm',
        timestamp,
        day: dayStr,
        metadata: {},
      });
    }
  }

  return metrics;
}

// ============================================================================
// WHOOP SYNC
// ============================================================================

async function syncWhoop(supabase: any, userId: string, accessToken: string) {
  // Get last sync cursor
  const { data: cursor } = await supabase
    .from('sync_cursors')
    .select('last_cursor')
    .eq('user_id', userId)
    .eq('provider', 'whoop')
    .single();

  const lastSync = cursor?.last_cursor || getDefaultStartDate();
  const today = new Date().toISOString();

  let metricsInserted = 0;

  // Sync Sleep
  const sleepData = await fetchWhoopSleep(accessToken, lastSync, today);
  for (const sleep of sleepData) {
    const normalized = normalizeWhoopSleep(sleep, userId);
    const { error } = await upsertMetrics(supabase, normalized);
    if (!error) metricsInserted++;
  }

  // Sync Recovery
  const recoveryData = await fetchWhoopRecovery(accessToken, lastSync, today);
  for (const recovery of recoveryData) {
    const normalized = normalizeWhoopRecovery(recovery, userId);
    const { error } = await upsertMetrics(supabase, normalized);
    if (!error) metricsInserted++;
  }

  // Sync Workouts
  const workoutData = await fetchWhoopWorkouts(accessToken, lastSync, today);
  for (const workout of workoutData) {
    const normalized = normalizeWhoopWorkout(workout, userId);
    const { error } = await upsertMetrics(supabase, normalized);
    if (!error) metricsInserted++;
  }

  // Update sync cursor
  await supabase
    .from('sync_cursors')
    .upsert({
      user_id: userId,
      provider: 'whoop',
      last_cursor: new Date().toISOString().split('T')[0],
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,provider',
    });

  return { metrics_inserted: metricsInserted, metrics_updated: 0 };
}

async function fetchWhoopSleep(accessToken: string, start: string, end: string) {
  const url = `https://api.prod.whoop.com/developer/v1/activity/sleep?start=${start}&end=${end}`;
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`WHOOP API error: ${response.status}`);
  }

  const data = await response.json();
  return data.records || [];
}

async function fetchWhoopRecovery(accessToken: string, start: string, end: string) {
  const url = `https://api.prod.whoop.com/developer/v1/recovery?start=${start}&end=${end}`;
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`WHOOP API error: ${response.status}`);
  }

  const data = await response.json();
  return data.records || [];
}

async function fetchWhoopWorkouts(accessToken: string, start: string, end: string) {
  const url = `https://api.prod.whoop.com/developer/v1/activity/workout?start=${start}&end=${end}`;
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`WHOOP API error: ${response.status}`);
  }

  const data = await response.json();
  return data.records || [];
}

function normalizeWhoopSleep(sleep: any, userId: string) {
  const day = sleep.start.split('T')[0];
  const timestamp = sleep.start;

  return [
    {
      user_id: userId,
      provider: 'whoop',
      metric_type: 'sleep_duration',
      value: sleep.score?.total_in_bed_time_milli / 60000, // Convert ms to minutes
      unit: 'minutes',
      timestamp,
      day,
      metadata: { 
        sleep_id: sleep.id,
        sleep_performance_percentage: sleep.score?.sleep_performance_percentage,
      },
    },
    sleep.score?.stage_summary?.total_slow_wave_sleep_time_milli && {
      user_id: userId,
      provider: 'whoop',
      metric_type: 'sleep_deep',
      value: sleep.score.stage_summary.total_slow_wave_sleep_time_milli / 60000,
      unit: 'minutes',
      timestamp,
      day,
      metadata: { sleep_id: sleep.id },
    },
    sleep.score?.stage_summary?.total_rem_sleep_time_milli && {
      user_id: userId,
      provider: 'whoop',
      metric_type: 'sleep_rem',
      value: sleep.score.stage_summary.total_rem_sleep_time_milli / 60000,
      unit: 'minutes',
      timestamp,
      day,
      metadata: { sleep_id: sleep.id },
    },
  ].filter(Boolean);
}

function normalizeWhoopRecovery(recovery: any, userId: string) {
  const day = recovery.created_at.split('T')[0];
  const timestamp = recovery.created_at;

  return [
    {
      user_id: userId,
      provider: 'whoop',
      metric_type: 'recovery_score',
      value: recovery.score?.recovery_score,
      unit: 'score',
      timestamp,
      day,
      metadata: { 
        recovery_id: recovery.id,
        hrv: recovery.score?.hrv_rmssd_milli,
        resting_hr: recovery.score?.resting_heart_rate,
      },
    },
    recovery.score?.hrv_rmssd_milli && {
      user_id: userId,
      provider: 'whoop',
      metric_type: 'hrv',
      value: recovery.score.hrv_rmssd_milli,
      unit: 'ms',
      timestamp,
      day,
      metadata: { recovery_id: recovery.id },
    },
    recovery.score?.resting_heart_rate && {
      user_id: userId,
      provider: 'whoop',
      metric_type: 'heart_rate_resting',
      value: recovery.score.resting_heart_rate,
      unit: 'bpm',
      timestamp,
      day,
      metadata: { recovery_id: recovery.id },
    },
  ].filter(Boolean);
}

function normalizeWhoopWorkout(workout: any, userId: string) {
  const day = workout.start.split('T')[0];
  const timestamp = workout.start;

  return [
    {
      user_id: userId,
      provider: 'whoop',
      metric_type: 'workout_strain',
      value: workout.score?.strain,
      unit: 'score',
      timestamp,
      day,
      metadata: { 
        workout_id: workout.id,
        sport: workout.sport_id,
      },
    },
    workout.score?.kilojoule && {
      user_id: userId,
      provider: 'whoop',
      metric_type: 'calories_active',
      value: workout.score.kilojoule * 0.239006, // Convert kJ to kcal
      unit: 'kcal',
      timestamp,
      day,
      metadata: { workout_id: workout.id },
    },
  ].filter(Boolean);
}

// ============================================================================
// HELPERS
// ============================================================================

function getDefaultStartDate(): string {
  // Default to 30 days ago
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return date.toISOString().split('T')[0];
}
