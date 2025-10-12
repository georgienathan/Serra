// src/integrations/normalize/healthconnect.ts
// Normalize Android Health Connect data to unified Metric format
// TODO: Implement in PR4 when react-native-health-connect is installed

import { Metric } from '../../types/integrations';

export function normalizeHealthConnectSleep(record: any, userId: string): Metric[] {
  // Placeholder - implement when Health Connect integration is added
  return [];
}

export function normalizeHealthConnectSteps(record: any, userId: string): Metric[] {
  // Placeholder - implement when Health Connect integration is added
  return [];
}
