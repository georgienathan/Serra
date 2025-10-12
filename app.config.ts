import 'dotenv/config';
import type { ExpoConfig } from '@expo/config';

export default ({ config }: { config: ExpoConfig }): ExpoConfig => ({
  ...config,
  name: config.name ?? 'SerraActive',
  slug: config.slug ?? 'serraactive',
  extra: {
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
    storageBucket: 'uploads',
  },
  plugins: [
    [
      'expo-image-picker',
      {
        photosPermission: 'The app accesses your photos to upload nutrition and exercise data.',
        cameraPermission: 'The app accesses your camera to capture nutrition and exercise data.',
      },
    ],
    [
      'expo-av',
      {
        microphonePermission: 'The app accesses your microphone to record voice notes for nutrition and exercise data.',
      },
    ],
    [
      'expo-build-properties',
      {
        ios: {
          deploymentTarget: '15.1',
        },
      },
    ],
  ],
  ios: {
    bundleIdentifier: 'com.serraactive.app',
    infoPlist: {
      NSHealthShareUsageDescription: 'Serra needs access to your health data to sync workouts, sleep, and activity metrics.',
      NSHealthUpdateUsageDescription: 'Serra needs permission to write workout data to Apple Health.',
    },
    entitlements: {
      'com.apple.developer.healthkit': true,
      'com.apple.developer.healthkit.access': [],
    },
  },
  android: {
    package: 'com.serraactive.app',
    permissions: [
      'android.permission.health.READ_STEPS',
      'android.permission.health.READ_SLEEP',
      'android.permission.health.READ_HEART_RATE',
      'android.permission.health.READ_DISTANCE',
      'android.permission.health.READ_ACTIVE_CALORIES_BURNED',
    ],
  },
});
