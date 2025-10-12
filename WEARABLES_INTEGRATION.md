# Wearables Integration - Implementation Guide

## Overview
This document tracks the implementation of multi-wearable data ingestion for Serra. The integration adds normalized time-series metrics from cloud APIs (Oura, Fitbit, Strava, WHOOP) and on-device sources (HealthKit, Health Connect) without disrupting existing manual entry workflows.

---

## Implementation Status

### ✅ PR0: Foundation (COMPLETE)
**Branch:** `feature/wearables-foundation`

**Deliverables:**
- ✅ Database migration (`002_wearables.sql`)
  - `source_accounts` table for OAuth tokens
  - `metrics` table for normalized time-series data
  - `sync_cursors` table for sync state tracking
  - `daily_aggregates` view for dashboard/calendar
  - RLS policies and indexes
  - Helper functions for queries

- ✅ TypeScript types (`src/types/integrations.ts`)
  - Provider types
  - Metric types
  - Source account interfaces
  - Provider-specific data structures

- ✅ Normalization layer (`src/integrations/normalize/`)
  - Oura normalizers (sleep, daily, readiness)
  - Strava normalizers (activities)
  - Fitbit normalizers (sleep, activities)
  - WHOOP normalizers (sleep, recovery)
  - Placeholder stubs for HealthKit and Health Connect

- ✅ Client API helpers (`src/lib/integrations.ts`)
  - Get connected accounts
  - Sync provider
  - Query metrics by day/range
  - Get daily aggregates
  - Update account metadata

**Files Created:**
```
supabase/migrations/002_wearables.sql
src/types/integrations.ts
src/integrations/normalize/oura.ts
src/integrations/normalize/strava.ts
src/integrations/normalize/fitbit.ts
src/integrations/normalize/whoop.ts
src/integrations/normalize/healthkit.ts (stub)
src/integrations/normalize/healthconnect.ts (stub)
src/integrations/normalize/index.ts
src/lib/integrations.ts
```

**No UI Changes** - This PR is pure infrastructure.

---

## Next Steps

### PR1: Connections UI + OAuth (`feature/connections-oauth`)
**Scope:**
- Create `Connections.tsx` screen
- Add navigation from About screen
- Implement OAuth flow with Expo AuthSession
- Create `oauth-callback` Edge Function
- Test with Oura and Strava

**Dependencies to Install:**
```bash
npm install expo-auth-session expo-secure-store expo-crypto
```

**Files to Create:**
- `src/screens/Connections.tsx`
- `supabase/functions/oauth-callback/index.ts`

---

### PR2: Oura Sync (`feature/oura-sync`)
**Scope:**
- Create `sync-oura` Edge Function
- Implement Oura API client
- Add Supabase cron job
- Test end-to-end sync

**Files to Create:**
- `supabase/functions/sync-oura/index.ts`

---

### PR3: HealthKit (iOS) (`feature/healthkit`)
**Scope:**
- Add HealthKit entitlements to `app.config.ts`
- Install `react-native-health`
- Implement local sync
- Test on EAS build

**Dependencies to Install:**
```bash
npm install react-native-health
npx expo install expo-build-properties
```

---

### PR4: Health Connect (Android) (`feature/health-connect`)
**Scope:**
- Add Android permissions
- Install `react-native-health-connect`
- Implement local sync
- Test on EAS build

**Dependencies to Install:**
```bash
npm install react-native-health-connect
```

---

### PR5: Fitbit + Strava Sync (`feature/fitbit-strava`)
**Scope:**
- Create `sync-fitbit` and `sync-strava` Edge Functions
- Add to cron schedule
- Test multi-provider sync

---

### PR6: Dashboard Integration (`feature/dashboard-metrics`)
**Scope:**
- Update Dashboard to query `daily_aggregates`
- Show metrics + manual entries
- Update calendar dots
- Add data source indicators

---

## Database Schema

### Tables Created

#### `source_accounts`
Stores OAuth tokens and connection status for each provider.

**Key Fields:**
- `provider`: oura | fitbit | strava | whoop | apple_health | health_connect | google_fit
- `status`: pending | connected | connected_local | error | revoked
- `access_token`, `refresh_token`: Encrypted tokens (null for local)
- `metadata`: Provider-specific config (enabled metrics, etc.)

#### `metrics`
Normalized time-series data from all providers.

**Key Fields:**
- `type`: steps | sleep | workout | readiness_score | etc.
- `timestamp`: UTC timestamp
- `day`: YYYY-MM-DD for aggregation
- `value`: Primary metric value
- `unit`: min | km | kcal | bpm | ms | count | score
- `source_key`: Unique ID from provider (for deduplication)
- `payload`: Extended data (sleep stages, HR zones, etc.)

**Unique Constraint:** `(user_id, provider, type, source_key)`

#### `sync_cursors`
Tracks last sync position for incremental updates.

**Key Fields:**
- `provider`: Provider name
- `cursor_type`: timestamp | token | page
- `cursor_value`: ISO timestamp or pagination token

### Views

#### `daily_aggregates`
Pre-aggregated daily metrics for performance.

**Aggregations:**
- Total steps, distance, active minutes, workout count
- Total sleep, avg resting HR, avg HRV
- Total calories (active + basal)
- Avg readiness score, strain
- Period/ovulation flags
- Body metrics (weight, body fat %)
- Nutrition totals

---

## API Contracts

### Client API (`src/lib/integrations.ts`)

```typescript
// Get all connected accounts
getConnectedAccounts(): Promise<SourceAccount[]>

// Get specific account
getSourceAccount(provider: Provider): Promise<SourceAccount | null>

// Disconnect provider
disconnectProvider(provider: Provider): Promise<void>

// Trigger sync
syncProvider(provider: Provider): Promise<SyncResult>

// Get metrics for a day
getMetricsForDay(day: string, types?: MetricType[]): Promise<Metric[]>

// Get metrics for date range
getMetricsRange(startDate: string, endDate: string, types?: MetricType[]): Promise<Metric[]>

// Get daily aggregates
getDailyAggregates(startDate: string, endDate: string): Promise<DailyAggregate[]>

// Get latest metric value
getLatestMetric(type: MetricType, provider?: Provider): Promise<Metric | null>
```

### Edge Functions (To Be Implemented)

#### `oauth-callback/:provider`
**Input:** `{ code, state, code_verifier }`  
**Output:** Redirect to `app://serra/oauth-success?provider=oura`

#### `sync-:provider`
**Input:** `{ userId? }`  
**Output:** `{ success, metrics_inserted, metrics_updated, last_sync }`

---

## Normalization Examples

### Oura Sleep
```typescript
{
  user_id: "...",
  provider: "oura",
  type: "sleep",
  timestamp: "2024-01-15T23:30:00Z",
  day: "2024-01-15",
  value: 420, // minutes
  unit: "min",
  source_key: "oura_sleep_abc123",
  payload: {
    deep_min: 90,
    light_min: 200,
    rem_min: 130,
    stages: [...]
  }
}
```

### Strava Activity
```typescript
{
  user_id: "...",
  provider: "strava",
  type: "workout",
  timestamp: "2024-01-15T07:00:00Z",
  day: "2024-01-15",
  value: 45, // minutes
  unit: "min",
  source_key: "strava_activity_123456",
  payload: {
    name: "Morning Run",
    activity_type: "run",
    distance_km: 8.5,
    avg_hr: 145
  }
}
```

---

## Testing Checklist

### PR0 (Foundation)
- [x] Database migration runs without errors
- [x] TypeScript types compile
- [x] Normalizers produce valid Metric objects
- [x] Client API helpers are type-safe
- [x] No UI changes (app still works)

### PR1 (OAuth)
- [ ] OAuth flow initiates correctly
- [ ] Tokens stored in `source_accounts`
- [ ] Deep link returns to app
- [ ] Connection status displays

### PR2 (Oura Sync)
- [ ] Edge Function fetches Oura data
- [ ] Metrics inserted into database
- [ ] Deduplication works (no duplicates)
- [ ] Sync cursor updates
- [ ] Manual "Sync now" works

### PR3 (HealthKit)
- [ ] Permissions requested on iOS
- [ ] Steps/sleep/workouts sync locally
- [ ] Metrics appear in database
- [ ] EAS build succeeds

### PR4 (Health Connect)
- [ ] Permissions requested on Android
- [ ] Steps/sleep sync locally
- [ ] Metrics appear in database
- [ ] EAS build succeeds

### PR5 (Fitbit/Strava)
- [ ] Multi-provider sync works
- [ ] Cron jobs run on schedule
- [ ] No conflicts between providers

### PR6 (Dashboard)
- [ ] Calendar shows metrics-based dots
- [ ] Dashboard displays aggregated data
- [ ] Manual entries still visible
- [ ] Data source indicators work

---

## Security Notes

- ✅ All OAuth tokens stored server-side in `source_accounts`
- ✅ RLS policies ensure users only see own data
- ✅ Client never has access to API keys/tokens
- ✅ Edge Functions handle all external API calls
- ✅ Unique constraints prevent duplicate metrics

---

## Performance Considerations

- ✅ Indexes on `(user_id, day, type)` for fast queries
- ✅ `daily_aggregates` view pre-computes common queries
- ✅ Incremental sync via `sync_cursors`
- ✅ Batch inserts for large datasets
- ✅ Deduplication via `source_key` unique constraint

---

## Migration Instructions

### To Apply Database Migration

```bash
# Using Supabase CLI
supabase db push

# Or manually in Supabase Dashboard
# SQL Editor → Run supabase/migrations/002_wearables.sql
```

### To Verify Migration

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('source_accounts', 'metrics', 'sync_cursors');

-- Check RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('source_accounts', 'metrics', 'sync_cursors');

-- Check view exists
SELECT viewname FROM pg_views 
WHERE schemaname = 'public' 
AND viewname = 'daily_aggregates';
```

---

## Rollback Plan

If issues arise, the migration can be rolled back:

```sql
DROP VIEW IF EXISTS daily_aggregates;
DROP TABLE IF EXISTS sync_cursors;
DROP TABLE IF EXISTS metrics;
DROP TABLE IF EXISTS source_accounts;
DROP FUNCTION IF EXISTS get_latest_metric;
DROP FUNCTION IF EXISTS get_metrics_range;
DROP FUNCTION IF EXISTS update_source_accounts_updated_at;
```

The `entries` table remains untouched, so manual entries are never affected.

---

## Support & Documentation

- **Database Schema:** See `supabase/migrations/002_wearables.sql`
- **Type Definitions:** See `src/types/integrations.ts`
- **Normalizers:** See `src/integrations/normalize/`
- **Client API:** See `src/lib/integrations.ts`

For questions or issues, refer to the implementation plan in the repository root.
