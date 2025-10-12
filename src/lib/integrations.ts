// src/lib/integrations.ts
// Client-side API helpers for wearables integration

import { supabase } from './supabase';
import { 
  Provider, 
  SourceAccount, 
  Metric, 
  MetricType, 
  DailyAggregate,
  SyncResult 
} from '../types/integrations';

/**
 * Get all connected source accounts for the current user
 */
export async function getConnectedAccounts(): Promise<SourceAccount[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('source_accounts')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Get a specific source account by provider
 */
export async function getSourceAccount(provider: Provider): Promise<SourceAccount | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('source_accounts')
    .select('*')
    .eq('user_id', user.id)
    .eq('provider', provider)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }

  return data;
}

/**
 * Disconnect a provider (mark as revoked)
 */
export async function disconnectProvider(provider: Provider): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('source_accounts')
    .update({ status: 'revoked', updated_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('provider', provider);

  if (error) throw error;
}

/**
 * Trigger a sync for a specific provider
 */
export async function syncProvider(provider: Provider): Promise<SyncResult> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase.functions.invoke('sync-provider', {
    body: { provider, user_id: user.id }
  });

  if (error) {
    throw new Error(`Sync failed: ${error.message}`);
  }

  return data as SyncResult;
}

/**
 * Get metrics for a specific day
 */
export async function getMetricsForDay(
  day: string, 
  types?: MetricType[]
): Promise<Metric[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  let query = supabase
    .from('metrics')
    .select('*')
    .eq('user_id', user.id)
    .eq('day', day)
    .order('timestamp', { ascending: false });

  if (types && types.length > 0) {
    query = query.in('type', types);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

/**
 * Get metrics for a date range
 */
export async function getMetricsRange(
  startDate: string,
  endDate: string,
  types?: MetricType[]
): Promise<Metric[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  let query = supabase
    .from('metrics')
    .select('*')
    .eq('user_id', user.id)
    .gte('day', startDate)
    .lte('day', endDate)
    .order('day', { ascending: false })
    .order('timestamp', { ascending: false });

  if (types && types.length > 0) {
    query = query.in('type', types);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

/**
 * Get daily aggregates for a date range
 */
export async function getDailyAggregates(
  startDate: string,
  endDate: string
): Promise<DailyAggregate[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('daily_aggregates')
    .select('*')
    .eq('user_id', user.id)
    .gte('day', startDate)
    .lte('day', endDate)
    .order('day', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Get latest value for a specific metric type
 */
export async function getLatestMetric(
  type: MetricType,
  provider?: Provider
): Promise<Metric | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  let query = supabase
    .from('metrics')
    .select('*')
    .eq('user_id', user.id)
    .eq('type', type)
    .order('timestamp', { ascending: false })
    .limit(1);

  if (provider) {
    query = query.eq('provider', provider);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data && data.length > 0 ? data[0] : null;
}

/**
 * Update source account metadata (e.g., enabled metrics)
 */
export async function updateSourceAccountMetadata(
  provider: Provider,
  metadata: any
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('source_accounts')
    .update({ 
      metadata, 
      updated_at: new Date().toISOString() 
    })
    .eq('user_id', user.id)
    .eq('provider', provider);

  if (error) throw error;
}

/**
 * Check if any metrics exist for a given day (for calendar dots)
 */
export async function hasMetricsForDay(day: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data, error } = await supabase
    .from('metrics')
    .select('id')
    .eq('user_id', user.id)
    .eq('day', day)
    .limit(1);

  if (error) return false;
  return (data || []).length > 0;
}

/**
 * Get metric types available for a specific day (for calendar dots)
 */
export async function getMetricTypesForDay(day: string): Promise<MetricType[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('metrics')
    .select('type')
    .eq('user_id', user.id)
    .eq('day', day);

  if (error) return [];
  
  // Return unique types
  const types = new Set<MetricType>();
  (data || []).forEach(m => types.add(m.type as MetricType));
  return Array.from(types);
}
