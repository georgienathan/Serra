// src/integrations/normalize/whoop.ts
// Normalize WHOOP data to unified Metric format

import { Metric, WHOOPSleep, WHOOPRecovery } from '../../types/integrations';

/**
 * Normalize WHOOP sleep to metrics
 */
export function normalizeWhoopSleep(sleep: WHOOPSleep, userId: string): Metric[] {
  const metrics: Metric[] = [];
  const timestamp = sleep.start;
  const day = timestamp.split('T')[0];

  // Total sleep (in bed time - awake time)
  if (sleep.stage_summary) {
    const totalSleepMs = 
      (sleep.stage_summary.total_light_sleep_time_milli || 0) +
      (sleep.stage_summary.total_slow_wave_sleep_time_milli || 0) +
      (sleep.stage_summary.total_rem_sleep_time_milli || 0);
    
    const totalSleepMin = Math.round(totalSleepMs / 60000);

    metrics.push({
      user_id: userId,
      provider: 'whoop',
      type: 'sleep',
      timestamp,
      day,
      value: totalSleepMin,
      unit: 'min',
      source_key: `whoop_sleep_${sleep.id}`,
      payload: {
        in_bed_min: Math.round(sleep.stage_summary.total_in_bed_time_milli / 60000),
        awake_min: Math.round(sleep.stage_summary.total_awake_time_milli / 60000),
        light_min: Math.round(sleep.stage_summary.total_light_sleep_time_milli / 60000),
        deep_min: Math.round(sleep.stage_summary.total_slow_wave_sleep_time_milli / 60000),
        rem_min: Math.round(sleep.stage_summary.total_rem_sleep_time_milli / 60000),
        score: sleep.score?.total,
        start: sleep.start,
        end: sleep.end,
        timezone_offset: sleep.timezone_offset
      }
    });
  }

  return metrics;
}

/**
 * Normalize WHOOP recovery to metrics
 */
export function normalizeWhoopRecovery(recovery: WHOOPRecovery, userId: string, day: string): Metric[] {
  const metrics: Metric[] = [];
  const timestamp = `${day}T12:00:00Z`; // noon UTC for daily metrics

  // Recovery score
  if (recovery.score?.recovery_score !== undefined) {
    metrics.push({
      user_id: userId,
      provider: 'whoop',
      type: 'readiness_score',
      timestamp,
      day,
      value: recovery.score.recovery_score,
      unit: 'score',
      source_key: `whoop_recovery_${recovery.cycle_id}`,
      payload: {
        sleep_id: recovery.sleep_id
      }
    });
  }

  // Resting heart rate
  if (recovery.score?.resting_heart_rate) {
    metrics.push({
      user_id: userId,
      provider: 'whoop',
      type: 'resting_hr',
      timestamp,
      day,
      value: recovery.score.resting_heart_rate,
      unit: 'bpm',
      source_key: `whoop_rhr_${recovery.cycle_id}`
    });
  }

  // HRV
  if (recovery.score?.hrv_rmssd_milli) {
    metrics.push({
      user_id: userId,
      provider: 'whoop',
      type: 'hrv_rmssd',
      timestamp,
      day,
      value: recovery.score.hrv_rmssd_milli,
      unit: 'ms',
      source_key: `whoop_hrv_${recovery.cycle_id}`
    });
  }

  return metrics;
}
