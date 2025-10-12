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
// STUB IMPLEMENTATIONS (for PR3+)
// ============================================================================

async function syncStrava(supabase: any, userId: string, accessToken: string) {
  // TODO: Implement in PR3
  return { metrics_inserted: 0, metrics_updated: 0 };
}

async function syncFitbit(supabase: any, userId: string, accessToken: string) {
  // TODO: Implement in PR3
  return { metrics_inserted: 0, metrics_updated: 0 };
}

async function syncWhoop(supabase: any, userId: string, accessToken: string) {
  // TODO: Implement in PR3
  return { metrics_inserted: 0, metrics_updated: 0 };
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
