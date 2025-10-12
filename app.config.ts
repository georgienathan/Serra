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
  ],
});
