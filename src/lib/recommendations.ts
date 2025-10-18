// src/lib/recommendations.ts
import { supabase } from './supabase';

export interface RecommendationScores {
  readiness: number; // 1-5
}

export interface AggregatedData {
  sleep: {
    totalHours: number;
    avgQuality: string;
    entries: number;
  };
  nutrition: {
    totalCalories: number;
    avgProtein: number;
    avgCarbs: number;
    avgFat: number;
    entries: number;
  };
  exercise: {
    totalMinutes: number;
    totalDistance: number;
    types: string[];
    entries: number;
  };
  period: {
    hasPeriod: boolean;
    bleedDays: number;
    lastBleed: string | null;
  };
}

export interface RecommendationResponse {
  markdown: string;
  scores: RecommendationScores;
  aggregated: AggregatedData;
}

/**
 * Fetch AI-powered recommendations for a user
 */
export async function getRecommendations(day: string = new Date().toISOString().split('T')[0]): Promise<RecommendationResponse> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase.functions.invoke('recommendations', {
    body: {
      user_id: user.id,
      day
    }
  });

  if (error) {
    throw new Error(`Failed to get recommendations: ${error.message}`);
  }

  return data as RecommendationResponse;
}

/**
 * Get readiness score color based on value
 */
export function getReadinessColor(score: number): string {
  if (score >= 4) return '#7ccf9c'; // green
  if (score >= 3) return '#3ccbc5'; // teal
  if (score >= 2) return '#f2a1b5'; // accent
  return '#ef4444'; // red
}

/**
 * Get readiness emoji based on score
 */
export function getReadinessEmoji(score: number): string {
  if (score >= 4) return '🚀';
  if (score >= 3) return '👍';
  if (score >= 2) return '😐';
  return '😴';
}
