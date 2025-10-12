// src/integrations/normalize/strava.ts
// Normalize Strava activity data to unified Metric format

import { Metric, StravaActivity } from '../../types/integrations';

/**
 * Map Strava activity types to our workout categories
 */
function mapActivityType(stravaType: string): string {
  const typeMap: Record<string, string> = {
    'Run': 'run',
    'Ride': 'cycle',
    'Swim': 'swim',
    'Walk': 'walk',
    'Hike': 'walk',
    'WeightTraining': 'strength',
    'Workout': 'strength',
    'Yoga': 'yoga',
    'Crossfit': 'crossfit'
  };
  return typeMap[stravaType] || 'other';
}

/**
 * Normalize Strava activity to metrics
 */
export function normalizeStravaActivity(activity: StravaActivity, userId: string): Metric[] {
  const metrics: Metric[] = [];
  const day = activity.start_date.split('T')[0]; // YYYY-MM-DD
  const timestamp = activity.start_date;

  // Workout entry
  metrics.push({
    user_id: userId,
    provider: 'strava',
    type: 'workout',
    timestamp,
    day,
    value: Math.round(activity.moving_time / 60), // seconds to minutes
    unit: 'min',
    source_key: `strava_activity_${activity.id}`,
    payload: {
      name: activity.name,
      activity_type: mapActivityType(activity.type),
      strava_type: activity.type,
      elapsed_time_min: Math.round(activity.elapsed_time / 60),
      distance_km: activity.distance ? activity.distance / 1000 : undefined,
      elevation_gain_m: activity.total_elevation_gain,
      avg_hr: activity.average_heartrate,
      max_hr: activity.max_heartrate,
      calories: activity.calories
    }
  });

  // Distance (for runs, rides, swims)
  if (activity.distance) {
    metrics.push({
      user_id: userId,
      provider: 'strava',
      type: 'distance_km',
      timestamp,
      day,
      value: parseFloat((activity.distance / 1000).toFixed(2)), // meters to km
      unit: 'km',
      source_key: `strava_distance_${activity.id}`
    });
  }

  // Active minutes
  if (activity.moving_time) {
    metrics.push({
      user_id: userId,
      provider: 'strava',
      type: 'active_minutes',
      timestamp,
      day,
      value: Math.round(activity.moving_time / 60),
      unit: 'min',
      source_key: `strava_active_${activity.id}`
    });
  }

  // Calories (if available)
  if (activity.calories) {
    metrics.push({
      user_id: userId,
      provider: 'strava',
      type: 'calories_active',
      timestamp,
      day,
      value: activity.calories,
      unit: 'kcal',
      source_key: `strava_calories_${activity.id}`
    });
  }

  return metrics;
}
