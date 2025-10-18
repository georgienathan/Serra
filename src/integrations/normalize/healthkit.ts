// src/integrations/normalize/healthkit.ts
// Normalize Apple HealthKit data to unified Metric format
// TODO: Implement in PR3 when react-native-health is installed

import { Metric } from '../../types/integrations';

export function normalizeHealthKitSleep(sample: any, userId: string): Metric[] {
  // Placeholder - implement when HealthKit integration is added
  return [];
}

export function normalizeHealthKitSteps(sample: any, userId: string): Metric[] {
  // Placeholder - implement when HealthKit integration is added
  return [];
}

export function normalizeHealthKitWorkout(sample: any, userId: string): Metric[] {
  // Placeholder - implement when HealthKit integration is added
  return [];
}
