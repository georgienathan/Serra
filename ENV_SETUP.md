# Environment Variables Setup

## Files Created/Modified

1. **`.env`** - Create this file in your project root with your actual environment variables:
```env
# Supabase Configuration
# Get these from your Supabase project settings -> API
SUPABASE_URL=https://[YOUR_PROJECT_ID].supabase.co
SUPABASE_ANON_KEY=[YOUR_ANON_KEY]
```

2. **`app.config.ts`** - Updated to load environment variables and expose them under `extra`

3. **`dotenv`** - Installed as a dependency to load `.env` files

## How to Access Environment Variables in Your Code

Use `Constants.expoConfig?.extra` to access your environment variables:

```typescript
import Constants from 'expo-constants';

// Access environment variables with proper typing and error handling
type Extra = { supabaseUrl?: string; supabaseAnonKey?: string };
const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

if (!extra.supabaseUrl || !extra.supabaseAnonKey) {
  throw new Error('Missing Supabase env: set SUPABASE_URL and SUPABASE_ANON_KEY in .env');
}

// Create Supabase client
import { createClient } from '@supabase/supabase-js';
export const supabase = createClient(extra.supabaseUrl, extra.supabaseAnonKey);
```

## Important Notes

- Make sure to add `.env` to your `.gitignore` file to avoid committing sensitive data
- Environment variables are loaded via `dotenv/config` in the app config
- The `extra` object in your app config makes these variables available via `Constants.expoConfig?.extra`
