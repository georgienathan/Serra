// src/lib/mood-icons.ts
// Map mood types to FontAwesome icon names

export type MoodType = 'happy' | 'neutral' | 'sad';

export const MOOD_ICONS: Record<MoodType, string> = {
  happy: 'smile',
  neutral: 'meh',
  sad: 'frown',
};

export const MOOD_LABELS: Record<MoodType, string> = {
  happy: 'HAPPY',
  neutral: 'NEUTRAL',
  sad: 'SAD',
};

