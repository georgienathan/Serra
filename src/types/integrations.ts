// src/types/integrations.ts
// TypeScript types for wearables integration

export type Provider = 
  | 'oura' 
  | 'fitbit' 
  | 'strava' 
  | 'whoop' 
  | 'apple_health' 
  | 'health_connect' 
  | 'google_fit';

export type MetricType = 
  // Activity
  | 'steps'
  | 'distance_km'
  | 'active_minutes'
  | 'workout'
  // Sleep
  | 'sleep'
  | 'resting_hr'
  | 'hrv_rmssd'
  | 'hr_series'
  // Energy
  | 'calories_active'
  | 'calories_basal'
  // Readiness
  | 'readiness_score'
  | 'strain'
  // Cycle
  | 'period_flow'
  | 'ovulation'
  // Body
  | 'weight_kg'
  | 'body_fat_pct'
  // Nutrition
  | 'nutrition_calories'
  | 'nutrition_protein'
  | 'nutrition_carbs'
  | 'nutrition_fat';

export type AccountStatus = 
  | 'pending' 
  | 'connected' 
  | 'connected_local' 
  | 'error' 
  | 'revoked';

export interface SourceAccount {
  id: string;
  user_id: string;
  provider: Provider;
  status: AccountStatus;
  provider_user_id?: string;
  scopes?: string[];
  metadata?: {
    enabled_metrics?: MetricType[];
    sync_frequency?: number; // hours
    [key: string]: any;
  };
  last_sync_at?: string; // ISO timestamp
  created_at: string;
  updated_at: string;
}

export interface Metric {
  id?: string;
  user_id: string;
  provider: Provider;
  type: MetricType;
  timestamp: string; // ISO UTC timestamp
  day: string; // YYYY-MM-DD
  value: number;
  unit: string; // min, km, kcal, bpm, ms, count, score, kg, pct, g
  source_key: string; // unique ID from provider for deduplication
  payload?: any; // extended data (sleep stages, HR zones, etc.)
  timezone?: string; // original timezone
  created_at?: string;
}

export interface SyncCursor {
  id: string;
  user_id: string;
  provider: Provider;
  cursor_type: 'timestamp' | 'token' | 'page';
  cursor_value: string; // ISO timestamp or pagination token
  updated_at: string;
}

export interface DailyAggregate {
  user_id: string;
  day: string; // YYYY-MM-DD
  // Activity
  total_steps: number;
  total_distance_km: number;
  total_active_min: number;
  workout_count: number;
  // Sleep
  total_sleep_min: number;
  avg_resting_hr?: number;
  avg_hrv?: number;
  // Energy
  total_calories_active: number;
  total_calories_basal: number;
  // Readiness
  avg_readiness?: number;
  avg_strain?: number;
  // Cycle
  has_period: boolean;
  has_ovulation: boolean;
  // Body
  avg_weight_kg?: number;
  avg_body_fat_pct?: number;
  // Nutrition
  total_nutrition_calories: number;
  total_nutrition_protein: number;
}

// Provider-specific types for normalization

export interface OuraSleepData {
  id: string;
  day: string;
  bedtime_start: string;
  bedtime_end: string;
  total_sleep_duration: number; // seconds
  deep_sleep_duration?: number;
  light_sleep_duration?: number;
  rem_sleep_duration?: number;
  awake_time?: number;
  sleep_phase_5_min?: number[];
  score?: number;
  hrv?: {
    rmssd?: number;
  };
  heart_rate?: {
    bpm?: number;
  };
  timezone?: string;
}

export interface OuraDailyData {
  id: string;
  day: string;
  score: number;
  steps: number;
  active_calories: number;
  total_calories: number;
  contributors?: any;
}

export interface StravaActivity {
  id: number;
  name: string;
  type: string; // Run, Ride, Swim, etc.
  start_date: string;
  elapsed_time: number; // seconds
  moving_time: number; // seconds
  distance: number; // meters
  total_elevation_gain?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  calories?: number;
}

export interface FitbitSleepLog {
  dateOfSleep: string;
  duration: number; // milliseconds
  efficiency: number;
  startTime: string;
  endTime: string;
  minutesAsleep: number;
  minutesAwake: number;
  levels?: {
    summary?: {
      deep?: { minutes: number };
      light?: { minutes: number };
      rem?: { minutes: number };
      wake?: { minutes: number };
    };
  };
}

export interface FitbitActivity {
  activityId: number;
  activityName: string;
  startTime: string;
  duration: number; // milliseconds
  distance?: number;
  distanceUnit?: string;
  calories?: number;
  steps?: number;
  averageHeartRate?: number;
}

export interface WHOOPSleep {
  id: number;
  created_at: string;
  start: string;
  end: string;
  timezone_offset: string;
  score?: {
    total?: number;
  };
  stage_summary?: {
    total_in_bed_time_milli: number;
    total_awake_time_milli: number;
    total_light_sleep_time_milli: number;
    total_slow_wave_sleep_time_milli: number;
    total_rem_sleep_time_milli: number;
  };
}

export interface WHOOPRecovery {
  cycle_id: number;
  sleep_id: number;
  score?: {
    recovery_score?: number;
    resting_heart_rate?: number;
    hrv_rmssd_milli?: number;
  };
}

// Normalization function signature
export type NormalizerFunction<T> = (data: T, userId: string) => Metric[];

// Sync result
export interface SyncResult {
  success: boolean;
  provider: Provider;
  metrics_inserted: number;
  metrics_updated: number;
  last_sync: string;
  error?: string;
}
