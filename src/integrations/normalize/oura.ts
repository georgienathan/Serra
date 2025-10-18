// src/integrations/normalize/oura.ts
// Normalize Oura Ring data to unified Metric format

import { Metric, OuraSleepData, OuraDailyData } from '../../types/integrations';

/**
 * Normalize Oura sleep data to metrics
 */
export function normalizeOuraSleep(sleep: OuraSleepData, userId: string): Metric[] {
  const metrics: Metric[] = [];
  const day = sleep.day;

  // Total sleep duration
  if (sleep.total_sleep_duration) {
    metrics.push({
      user_id: userId,
      provider: 'oura',
      type: 'sleep',
      timestamp: sleep.bedtime_start,
      day,
      value: Math.round(sleep.total_sleep_duration / 60), // seconds to minutes
      unit: 'min',
      source_key: `oura_sleep_${sleep.id}`,
      payload: {
        deep_min: sleep.deep_sleep_duration ? Math.round(sleep.deep_sleep_duration / 60) : undefined,
        light_min: sleep.light_sleep_duration ? Math.round(sleep.light_sleep_duration / 60) : undefined,
        rem_min: sleep.rem_sleep_duration ? Math.round(sleep.rem_sleep_duration / 60) : undefined,
        awake_min: sleep.awake_time ? Math.round(sleep.awake_time / 60) : undefined,
        stages: sleep.sleep_phase_5_min,
        score: sleep.score,
        bedtime_start: sleep.bedtime_start,
        bedtime_end: sleep.bedtime_end
      },
      timezone: sleep.timezone
    });
  }

  // HRV (RMSSD)
  if (sleep.hrv?.rmssd) {
    metrics.push({
      user_id: userId,
      provider: 'oura',
      type: 'hrv_rmssd',
      timestamp: sleep.bedtime_start,
      day,
      value: sleep.hrv.rmssd,
      unit: 'ms',
      source_key: `oura_hrv_${sleep.id}`,
      timezone: sleep.timezone
    });
  }

  // Resting heart rate
  if (sleep.heart_rate?.bpm) {
    metrics.push({
      user_id: userId,
      provider: 'oura',
      type: 'resting_hr',
      timestamp: sleep.bedtime_start,
      day,
      value: sleep.heart_rate.bpm,
      unit: 'bpm',
      source_key: `oura_rhr_${sleep.id}`,
      timezone: sleep.timezone
    });
  }

  return metrics;
}

/**
 * Normalize Oura daily activity/readiness data to metrics
 */
export function normalizeOuraDaily(daily: OuraDailyData, userId: string): Metric[] {
  const metrics: Metric[] = [];
  const day = daily.day;
  const timestamp = `${day}T12:00:00Z`; // noon UTC for daily metrics

  // Steps
  if (daily.steps) {
    metrics.push({
      user_id: userId,
      provider: 'oura',
      type: 'steps',
      timestamp,
      day,
      value: daily.steps,
      unit: 'count',
      source_key: `oura_steps_${day}`
    });
  }

  // Active calories
  if (daily.active_calories) {
    metrics.push({
      user_id: userId,
      provider: 'oura',
      type: 'calories_active',
      timestamp,
      day,
      value: daily.active_calories,
      unit: 'kcal',
      source_key: `oura_active_cal_${day}`
    });
  }

  // Total calories (basal + active)
  if (daily.total_calories && daily.active_calories) {
    const basal = daily.total_calories - daily.active_calories;
    metrics.push({
      user_id: userId,
      provider: 'oura',
      type: 'calories_basal',
      timestamp,
      day,
      value: basal,
      unit: 'kcal',
      source_key: `oura_basal_cal_${day}`
    });
  }

  // Readiness score
  if (daily.score) {
    metrics.push({
      user_id: userId,
      provider: 'oura',
      type: 'readiness_score',
      timestamp,
      day,
      value: daily.score,
      unit: 'score',
      source_key: `oura_readiness_${day}`,
      payload: {
        contributors: daily.contributors
      }
    });
  }

  return metrics;
}
