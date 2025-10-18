// src/lib/wearable-helpers.ts
// Helper functions to merge wearable data with manual entries

import { supabase } from './supabase';

/**
 * Get wearable metrics for a specific day and metric types
 */
export async function getWearableMetricsForDay(
  day: string,
  metricTypes: string[]
): Promise<Record<string, number>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return {};

  const { data: metrics } = await supabase
    .from('metrics')
    .select('metric_type, value')
    .eq('user_id', user.id)
    .eq('day', day)
    .in('metric_type', metricTypes);

  if (!metrics || metrics.length === 0) return {};

  // Aggregate by metric_type (sum for same types, or take latest)
  const result: Record<string, number> = {};
  for (const metric of metrics) {
    if (!result[metric.metric_type]) {
      result[metric.metric_type] = metric.value;
    } else {
      // For metrics like steps, calories - sum them
      // For metrics like heart_rate - average them
      if (['steps', 'calories_active', 'calories_total', 'distance'].includes(metric.metric_type)) {
        result[metric.metric_type] += metric.value;
      } else {
        // Average for heart rate, scores, etc
        result[metric.metric_type] = (result[metric.metric_type] + metric.value) / 2;
      }
    }
  }

  return result;
}

/**
 * Get sleep metrics from wearables for a specific day
 */
export async function getSleepMetricsForDay(day: string) {
  const metrics = await getWearableMetricsForDay(day, [
    'sleep_duration',
    'sleep_deep',
    'sleep_rem',
    'sleep_score',
    'sleep_efficiency',
    'heart_rate_resting',
    'heart_rate_avg',
    'hrv',
  ]);

  return {
    duration_min: metrics.sleep_duration || 0,
    deep_min: metrics.sleep_deep || 0,
    rem_min: metrics.sleep_rem || 0,
    sleep_score: metrics.sleep_score || 0,
    efficiency: metrics.sleep_efficiency || 0,
    resting_hr: metrics.heart_rate_resting || 0,
    avg_hr: metrics.heart_rate_avg || 0,
    hrv: metrics.hrv || 0,
  };
}

/**
 * Get exercise metrics from wearables for a specific day
 */
export async function getExerciseMetricsForDay(day: string) {
  const metrics = await getWearableMetricsForDay(day, [
    'workout_duration',
    'distance',
    'calories_active',
    'heart_rate_avg',
    'heart_rate_max',
    'workout_strain',
  ]);

  return {
    duration_min: metrics.workout_duration || 0,
    distance_km: metrics.distance || 0,
    calories: metrics.calories_active || 0,
    avg_hr: metrics.heart_rate_avg || 0,
    max_hr: metrics.heart_rate_max || 0,
    strain: metrics.workout_strain || 0,
  };
}

/**
 * Get activity/steps metrics from wearables for a specific day
 */
export async function getActivityMetricsForDay(day: string) {
  const metrics = await getWearableMetricsForDay(day, [
    'steps',
    'calories_active',
    'calories_total',
    'distance',
    'activity_score',
  ]);

  return {
    steps: metrics.steps || 0,
    calories_active: metrics.calories_active || 0,
    calories_total: metrics.calories_total || 0,
    distance_km: metrics.distance || 0,
    activity_score: metrics.activity_score || 0,
  };
}

/**
 * Get recovery metrics from wearables for a specific day
 */
export async function getRecoveryMetricsForDay(day: string) {
  const metrics = await getWearableMetricsForDay(day, [
    'recovery_score',
    'readiness_score',
    'hrv',
    'heart_rate_resting',
    'temperature_deviation',
  ]);

  return {
    recovery_score: metrics.recovery_score || 0,
    readiness_score: metrics.readiness_score || 0,
    hrv: metrics.hrv || 0,
    resting_hr: metrics.heart_rate_resting || 0,
    temp_deviation: metrics.temperature_deviation || 0,
  };
}

