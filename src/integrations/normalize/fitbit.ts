// src/integrations/normalize/fitbit.ts
// Normalize Fitbit data to unified Metric format

import { Metric, FitbitSleepLog, FitbitActivity } from '../../types/integrations';

/**
 * Normalize Fitbit sleep log to metrics
 */
export function normalizeFitbitSleep(sleep: FitbitSleepLog, userId: string): Metric[] {
  const metrics: Metric[] = [];
  const day = sleep.dateOfSleep;
  const timestamp = sleep.startTime;

  // Total sleep
  if (sleep.minutesAsleep) {
    metrics.push({
      user_id: userId,
      provider: 'fitbit',
      type: 'sleep',
      timestamp,
      day,
      value: sleep.minutesAsleep,
      unit: 'min',
      source_key: `fitbit_sleep_${day}`,
      payload: {
        efficiency: sleep.efficiency,
        deep_min: sleep.levels?.summary?.deep?.minutes,
        light_min: sleep.levels?.summary?.light?.minutes,
        rem_min: sleep.levels?.summary?.rem?.minutes,
        wake_min: sleep.levels?.summary?.wake?.minutes,
        start_time: sleep.startTime,
        end_time: sleep.endTime
      }
    });
  }

  return metrics;
}

/**
 * Normalize Fitbit activity to metrics
 */
export function normalizeFitbitActivity(activity: FitbitActivity, userId: string): Metric[] {
  const metrics: Metric[] = [];
  const timestamp = activity.startTime;
  const day = timestamp.split('T')[0];

  // Workout entry
  metrics.push({
    user_id: userId,
    provider: 'fitbit',
    type: 'workout',
    timestamp,
    day,
    value: Math.round(activity.duration / 60000), // milliseconds to minutes
    unit: 'min',
    source_key: `fitbit_activity_${activity.activityId}`,
    payload: {
      name: activity.activityName,
      distance: activity.distance,
      distance_unit: activity.distanceUnit,
      calories: activity.calories,
      steps: activity.steps,
      avg_hr: activity.averageHeartRate
    }
  });

  // Distance (if available and in km)
  if (activity.distance && activity.distanceUnit === 'Kilometer') {
    metrics.push({
      user_id: userId,
      provider: 'fitbit',
      type: 'distance_km',
      timestamp,
      day,
      value: activity.distance,
      unit: 'km',
      source_key: `fitbit_distance_${activity.activityId}`
    });
  }

  // Active minutes
  metrics.push({
    user_id: userId,
    provider: 'fitbit',
    type: 'active_minutes',
    timestamp,
    day,
    value: Math.round(activity.duration / 60000),
    unit: 'min',
    source_key: `fitbit_active_${activity.activityId}`
  });

  // Calories
  if (activity.calories) {
    metrics.push({
      user_id: userId,
      provider: 'fitbit',
      type: 'calories_active',
      timestamp,
      day,
      value: activity.calories,
      unit: 'kcal',
      source_key: `fitbit_calories_${activity.activityId}`
    });
  }

  return metrics;
}
