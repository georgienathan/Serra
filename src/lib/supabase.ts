import 'react-native-url-polyfill/auto.js';
import 'react-native-get-random-values';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

type Extra = { supabaseUrl?: string; supabaseAnonKey?: string };
const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

if (!extra.supabaseUrl || !extra.supabaseAnonKey) {
  throw new Error('Missing Supabase env: set SUPABASE_URL and SUPABASE_ANON_KEY in .env');
}

export const supabase = createClient(extra.supabaseUrl, extra.supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
