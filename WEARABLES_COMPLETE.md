# 🎉 Wearables Integration - COMPLETE

## Overview
Serra now has a **complete, production-ready wearables integration system** that syncs health data from 6 major providers across iOS and Android.

---

## ✅ Completed PRs

### PR0: Foundation (Database + Types)
**Branch:** `feature/wearables-foundation`
**Branch:** `feature/wearables-foundation`

**What was built:**
- Database schema with `source_accounts`, `metrics`, `sync_cursors` tables
- TypeScript types for all providers and metric types
- Normalization layer for converting provider-specific data to standard format
- Client API helpers for querying and managing connections
- RLS policies and performance indexes

**Key files:**
- `supabase/migrations/002_wearables.sql`
- `src/types/integrations.ts`
- `src/integrations/normalize/*.ts`
- `src/lib/integrations.ts`

---

### PR1: Connections UI + OAuth
**Branch:** `feature/connections-oauth`

**What was built:**
- Beautiful Connections screen with provider cards
- OAuth flow for cloud providers (Oura, Strava, Fitbit, WHOOP)
- Edge Functions for OAuth initialization and callback
- Deep linking back to app after OAuth
- Token storage and management

**Key files:**
- `src/screens/Connections.tsx`
- `supabase/functions/oauth-init/index.ts`
- `supabase/functions/oauth-callback/index.ts`

**How it works:**
1. User taps "Connect" on provider card
2. Opens OAuth page in browser
3. User authorizes access
4. Redirects back to app with tokens
5. Tokens stored securely in database

---

### PR2: Oura Sync
**Branch:** `feature/oura-sync`

**What was built:**
- Unified `sync-provider` Edge Function for all providers
- Complete Oura API integration (sleep, daily activity, readiness)
- Automatic token refresh logic
- Supabase cron job for background syncs (every 6 hours)
- Incremental sync with cursors

**Key files:**
- `supabase/functions/sync-provider/index.ts`
- `supabase/functions/_cron/sync-all-providers.ts`
- `supabase/migrations/003_cron_jobs.sql`

**Oura metrics synced:**
- Sleep duration, deep sleep, REM sleep, sleep score
- Steps, active calories, activity score
- Readiness score, temperature deviation

**How it works:**
1. User taps "Sync Now" or cron job triggers
2. Check if token needs refresh → refresh if needed
3. Fetch data since last sync (or last 30 days for first sync)
4. Normalize to standard metrics format
5. Upsert to `metrics` table
6. Update sync cursor

---

### PR3: HealthKit (iOS)
**Branch:** `feature/healthkit`

**What was built:**
- HealthKit client wrapper for iOS
- Native iOS permissions and entitlements
- Local sync (no OAuth needed)
- Steps, sleep, active energy from Apple Health

**Key files:**
- `src/integrations/healthkit.ts`
- `app.config.ts` (iOS entitlements)

**Permissions requested:**
- Steps (daily step count)
- Sleep Analysis (duration and quality)
- Active Energy Burned (calories)
- Distance Walking/Running
- Heart Rate

**How it works:**
1. User taps "Connect" on Apple Health card
2. iOS shows native permission dialog
3. User grants permissions
4. Fetch last 7 days of data
5. Store in `metrics` table with `provider='apple_health'`
6. Manual sync via "Sync Now" button

**Note:** Requires real iOS device (doesn't work in simulator)

---

### PR4: Health Connect (Android)
**Branch:** `feature/health-connect`

**What was built:**
- Health Connect client wrapper for Android
- Android permissions configuration
- Local sync (no OAuth needed)
- Steps, sleep, active calories, heart rate

**Key files:**
- `src/integrations/healthconnect.ts`
- `app.config.ts` (Android permissions)

**Permissions requested:**
- Steps
- Sleep Sessions
- Active Calories Burned
- Heart Rate
- Distance

**How it works:**
1. User taps "Connect" on Health Connect card
2. Check if Health Connect app is installed
3. Request permissions (Android native dialog)
4. Fetch last 7 days of data
5. Store in `metrics` table with `provider='health_connect'`
6. Manual sync via "Sync Now" button

**Note:** Requires Health Connect app from Play Store

---

### PR5: Cloud Providers Sync (Strava, Fitbit, WHOOP)
**Branch:** `feature/cloud-providers-sync`

**What was built:**
- Complete Strava API integration
- Complete Fitbit API integration
- Complete WHOOP API integration
- All cloud providers now fully functional

**Key files:**
- `supabase/functions/sync-provider/index.ts` (updated)

**Strava metrics synced:**
- Workout duration (moving time)
- Distance (runs, rides, swims)
- Active calories burned
- Average heart rate
- Activity type and name

**Fitbit metrics synced:**
- Steps (daily count)
- Total calories and active calories
- Sleep duration, deep sleep, REM sleep
- Resting heart rate
- Sleep efficiency

**WHOOP metrics synced:**
- Sleep duration, deep sleep, REM sleep
- Recovery score
- HRV (heart rate variability)
- Resting heart rate
- Workout strain score
- Active calories (converted from kilojoules)

**How it works:**
1. Same unified `sync-provider` Edge Function
2. Routes to provider-specific sync logic
3. Fetches data from provider APIs
4. Normalizes to standard metrics format
5. Upserts to `metrics` table
6. Updates sync cursors

**API Endpoints Used:**
- Strava: `/api/v3/athlete/activities`
- Fitbit: `/1/user/-/activities`, `/1.2/user/-/sleep`, `/1/user/-/activities/heart`
- WHOOP: `/developer/v1/activity/sleep`, `/developer/v1/recovery`, `/developer/v1/activity/workout`

---

## 📊 Supported Providers

| Provider | Type | Status | Metrics |
|----------|------|--------|---------|
| **Oura Ring** | Cloud OAuth | ✅ Complete | Sleep, readiness, activity, steps, calories |
| **Strava** | Cloud OAuth | ✅ Complete | Workouts, runs, rides, distance, heart rate |
| **Fitbit** | Cloud OAuth | ✅ Complete | Activity, sleep, heart rate, steps, calories |
| **WHOOP** | Cloud OAuth | ✅ Complete | Recovery, strain, sleep, HRV |
| **Apple Health** | Local iOS | ✅ Complete | Steps, sleep, calories |
| **Health Connect** | Local Android | ✅ Complete | Steps, sleep, calories, heart rate |

---

## 🗄️ Database Schema

### `source_accounts`
Stores OAuth tokens and connection status for each provider.

```sql
- id (uuid, primary key)
- user_id (uuid, references auth.users)
- provider (text: 'oura', 'strava', 'fitbit', 'whoop', 'apple_health', 'health_connect')
- status (text: 'connected', 'connected_local', 'revoked', 'error')
- access_token (text, encrypted)
- refresh_token (text, encrypted)
- token_expires_at (timestamp)
- provider_user_id (text)
- last_sync_at (timestamp)
- metadata (jsonb)
```

### `metrics`
Normalized time-series health data from all providers.

```sql
- id (uuid, primary key)
- user_id (uuid, references auth.users)
- provider (text)
- metric_type (text: 'steps', 'sleep_duration', 'heart_rate', etc.)
- value (numeric)
- unit (text: 'count', 'minutes', 'bpm', 'kcal', etc.)
- timestamp (timestamp with time zone)
- day (text, YYYY-MM-DD for daily aggregations)
- metadata (jsonb)
```

### `sync_cursors`
Tracks last sync date for incremental syncs.

```sql
- id (uuid, primary key)
- user_id (uuid, references auth.users)
- provider (text)
- last_cursor (text, YYYY-MM-DD)
- updated_at (timestamp)
```

### `daily_aggregates` (view)
Pre-aggregated daily metrics for fast dashboard queries.

---

## 🔄 Sync Flow

### Cloud Providers (Oura, Strava, Fitbit, WHOOP)

```
1. User connects via OAuth
2. Tokens stored in source_accounts
3. Manual sync or cron job triggers
4. Edge Function checks token expiry
5. Refresh token if needed
6. Fetch data from provider API
7. Normalize to standard format
8. Upsert to metrics table
9. Update sync cursor
10. Update last_sync_at
```

### Local Providers (HealthKit, Health Connect)

```
1. User taps Connect
2. Native permission dialog
3. User grants permissions
4. Fetch data from local APIs
5. Normalize to standard format
6. Upsert to metrics table
7. Update sync cursor
8. Update source_accounts
```

---

## 🚀 Deployment Checklist

### Supabase Setup

1. **Run migrations:**
   ```bash
   # Apply database migrations
   supabase db push
   ```

2. **Deploy Edge Functions:**
   ```bash
   supabase functions deploy oauth-init
   supabase functions deploy oauth-callback
   supabase functions deploy sync-provider
   ```

3. **Set up cron job:**
   - Navigate to Supabase Dashboard → Database → Cron Jobs
   - Run `003_cron_jobs.sql` migration
   - Set `app.settings.supabase_url` and `app.settings.service_role_key`

4. **Add provider credentials:**
   ```bash
   # Set OAuth credentials as Edge Function secrets
   supabase secrets set OURA_CLIENT_ID=your_client_id
   supabase secrets set OURA_CLIENT_SECRET=your_client_secret
   supabase secrets set STRAVA_CLIENT_ID=your_client_id
   supabase secrets set STRAVA_CLIENT_SECRET=your_client_secret
   # ... repeat for Fitbit and WHOOP
   ```

### Mobile App Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Build for iOS:**
   ```bash
   eas build --profile development --platform ios
   ```

3. **Build for Android:**
   ```bash
   eas build --profile development --platform android
   ```

4. **Test on real devices:**
   - iOS: Install on iPhone to test HealthKit
   - Android: Install Health Connect app, then test

---

## 🧪 Testing

### Test OAuth Flow (Oura)
1. Navigate to About → Connected Devices
2. Tap "Connect" on Oura Ring card
3. Complete OAuth in browser
4. Verify redirect back to app
5. Check "Connected" badge appears
6. Tap "Sync Now"
7. Verify metrics in database

### Test HealthKit (iOS)
1. Navigate to About → Connected Devices
2. Tap "Connect" on Apple Health card
3. Grant permissions in iOS dialog
4. Verify initial sync completes
5. Check metrics in database
6. Test "Sync Now" button

### Test Health Connect (Android)
1. Install Health Connect from Play Store
2. Navigate to About → Connected Devices
3. Tap "Connect" on Health Connect card
4. Grant permissions in Android dialog
5. Verify initial sync completes
6. Check metrics in database
7. Test "Sync Now" button

---

## 📈 Next Steps (Optional)

### ~~PR5: Additional Cloud Providers~~ ✅ Complete
- ✅ Implement Strava sync (activities, runs, rides)
- ✅ Implement Fitbit sync (activity, sleep, heart rate)
- ✅ Implement WHOOP sync (recovery, strain, sleep)

### PR6: Dashboard Integration
- Query `daily_aggregates` view in Dashboard
- Show metrics alongside manual entries
- Update calendar dots to include wearable data
- Add charts/graphs for trends

### Enhancements
- Background sync for local providers (iOS Background Tasks, Android WorkManager)
- Conflict resolution for overlapping data
- Data export functionality
- Provider-specific settings (sync frequency, metric selection)

---

## 🎯 Key Achievements

✅ **6 providers supported** - Cloud and local integrations  
✅ **Cross-platform** - iOS and Android  
✅ **Secure** - OAuth tokens server-side, local data stays on device  
✅ **Automatic** - Background syncs every 6 hours  
✅ **Normalized** - Consistent data format across all providers  
✅ **Scalable** - Single endpoint handles all providers  
✅ **Production-ready** - RLS policies, indexes, error handling  

---

## 📝 Notes

- **HealthKit** requires real iOS device (doesn't work in simulator)
- **Health Connect** requires Android 14+ or Health Connect app from Play Store
- **OAuth credentials** must be obtained from each provider's developer portal
- **Cron job** requires Supabase Pro plan (or manual trigger via API)
- **Token refresh** happens automatically 5 minutes before expiry

---

## 🐛 Troubleshooting

### "Unable to resolve expo-web-browser"
- Run `npm install` to ensure all dependencies are installed
- Restart Metro bundler: `npx expo start --clear`

### "HealthKit not available"
- Ensure testing on real iOS device (not simulator)
- Check HealthKit entitlements in `app.config.ts`
- Verify iOS deployment target is 15.1+

### "Health Connect not available"
- Install Health Connect app from Play Store
- Check Android permissions in `app.config.ts`
- Ensure Android 14+ or compatible device

### OAuth redirect not working
- Verify redirect URI matches in provider settings
- Check deep linking configuration
- Test with `serraactive://oauth-callback`

### Sync failing
- Check Edge Function logs in Supabase Dashboard
- Verify provider credentials are set
- Check token expiry and refresh logic
- Ensure RLS policies allow inserts

---

## 📚 Documentation

- **Main docs:** `WEARABLES_INTEGRATION.md`
- **Database schema:** `supabase/migrations/002_wearables.sql`
- **API reference:** `src/lib/integrations.ts`
- **Type definitions:** `src/types/integrations.ts`

---

**Built with ❤️ for Serra Active**  
*Complete wearables integration - from Oura to Apple Health*
