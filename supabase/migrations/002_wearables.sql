-- Migration 002: Wearables Integration
-- Add tables for multi-wearable data ingestion without touching existing entries table

-- ============================================================================
-- source_accounts: OAuth tokens & connection status
-- ============================================================================
CREATE TABLE IF NOT EXISTS source_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('oura', 'fitbit', 'strava', 'whoop', 'apple_health', 'health_connect', 'google_fit')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'connected', 'connected_local', 'error', 'revoked')),
  access_token TEXT, -- encrypted, null for local providers
  refresh_token TEXT, -- encrypted, null for local providers
  token_expires_at TIMESTAMPTZ,
  scopes TEXT[], -- requested OAuth scopes
  provider_user_id TEXT, -- external user ID from provider
  metadata JSONB, -- provider-specific config (e.g., enabled metric types)
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

-- ============================================================================
-- metrics: normalized time-series data from all providers
-- ============================================================================
CREATE TABLE IF NOT EXISTS metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN (
    -- Activity
    'steps', 'distance_km', 'active_minutes', 'workout',
    -- Sleep
    'sleep', 'resting_hr', 'hrv_rmssd', 'hr_series',
    -- Energy
    'calories_active', 'calories_basal',
    -- Readiness
    'readiness_score', 'strain',
    -- Cycle
    'period_flow', 'ovulation',
    -- Body
    'weight_kg', 'body_fat_pct',
    -- Nutrition (if provider supports)
    'nutrition_calories', 'nutrition_protein', 'nutrition_carbs', 'nutrition_fat'
  )),
  timestamp TIMESTAMPTZ NOT NULL, -- UTC timestamp
  day TEXT NOT NULL, -- YYYY-MM-DD for daily aggregation
  value NUMERIC, -- primary metric value
  unit TEXT, -- min, km, kcal, bpm, ms, count, score, kg, pct, g
  source_key TEXT NOT NULL, -- provider's unique ID for deduplication
  payload JSONB, -- raw/extended data (sleep stages, hr zones, workout details, etc.)
  timezone TEXT, -- original timezone from provider
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, provider, type, source_key) -- deduplication constraint
);

-- ============================================================================
-- sync_cursors: track sync state per provider per user
-- ============================================================================
CREATE TABLE IF NOT EXISTS sync_cursors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  cursor_type TEXT NOT NULL DEFAULT 'timestamp', -- timestamp, token, page
  cursor_value TEXT NOT NULL, -- ISO timestamp or pagination token
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, provider, cursor_type)
);

-- ============================================================================
-- Indexes for performance
-- ============================================================================

-- source_accounts indexes
CREATE INDEX IF NOT EXISTS idx_source_accounts_user_provider ON source_accounts(user_id, provider);
CREATE INDEX IF NOT EXISTS idx_source_accounts_status ON source_accounts(status) WHERE status IN ('connected', 'connected_local');

-- metrics indexes
CREATE INDEX IF NOT EXISTS idx_metrics_user_day_type ON metrics(user_id, day, type);
CREATE INDEX IF NOT EXISTS idx_metrics_user_timestamp ON metrics(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_provider_type ON metrics(provider, type);
CREATE INDEX IF NOT EXISTS idx_metrics_day ON metrics(day);

-- sync_cursors indexes
CREATE INDEX IF NOT EXISTS idx_sync_cursors_user_provider ON sync_cursors(user_id, provider);

-- ============================================================================
-- RLS Policies
-- ============================================================================

ALTER TABLE source_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_cursors ENABLE ROW LEVEL SECURITY;

-- source_accounts policies
CREATE POLICY "Users own source_accounts" ON source_accounts
  FOR ALL USING (auth.uid() = user_id);

-- metrics policies
CREATE POLICY "Users own metrics" ON metrics
  FOR ALL USING (auth.uid() = user_id);

-- sync_cursors policies
CREATE POLICY "Users own sync_cursors" ON sync_cursors
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- Update trigger for source_accounts
-- ============================================================================

CREATE OR REPLACE FUNCTION update_source_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_source_accounts_updated_at 
    BEFORE UPDATE ON source_accounts 
    FOR EACH ROW 
    EXECUTE FUNCTION update_source_accounts_updated_at();

-- ============================================================================
-- Aggregation view for dashboard/calendar
-- ============================================================================

CREATE OR REPLACE VIEW daily_aggregates AS
SELECT 
  user_id,
  day,
  -- Activity
  SUM(CASE WHEN type = 'steps' THEN value ELSE 0 END) as total_steps,
  SUM(CASE WHEN type = 'distance_km' THEN value ELSE 0 END) as total_distance_km,
  SUM(CASE WHEN type = 'active_minutes' THEN value ELSE 0 END) as total_active_min,
  COUNT(CASE WHEN type = 'workout' THEN 1 END) as workout_count,
  -- Sleep
  SUM(CASE WHEN type = 'sleep' THEN value ELSE 0 END) as total_sleep_min,
  AVG(CASE WHEN type = 'resting_hr' THEN value END) as avg_resting_hr,
  AVG(CASE WHEN type = 'hrv_rmssd' THEN value END) as avg_hrv,
  -- Energy
  SUM(CASE WHEN type = 'calories_active' THEN value ELSE 0 END) as total_calories_active,
  SUM(CASE WHEN type = 'calories_basal' THEN value ELSE 0 END) as total_calories_basal,
  -- Readiness
  AVG(CASE WHEN type = 'readiness_score' THEN value END) as avg_readiness,
  AVG(CASE WHEN type = 'strain' THEN value END) as avg_strain,
  -- Cycle
  MAX(CASE WHEN type = 'period_flow' THEN 1 ELSE 0 END) as has_period,
  MAX(CASE WHEN type = 'ovulation' THEN 1 ELSE 0 END) as has_ovulation,
  -- Body
  AVG(CASE WHEN type = 'weight_kg' THEN value END) as avg_weight_kg,
  AVG(CASE WHEN type = 'body_fat_pct' THEN value END) as avg_body_fat_pct,
  -- Nutrition
  SUM(CASE WHEN type = 'nutrition_calories' THEN value ELSE 0 END) as total_nutrition_calories,
  SUM(CASE WHEN type = 'nutrition_protein' THEN value ELSE 0 END) as total_nutrition_protein
FROM metrics
GROUP BY user_id, day;

-- Grant access to view
GRANT SELECT ON daily_aggregates TO authenticated;

-- ============================================================================
-- Helper functions
-- ============================================================================

-- Function to get latest metric value
CREATE OR REPLACE FUNCTION get_latest_metric(
  p_user_id UUID,
  p_type TEXT,
  p_provider TEXT DEFAULT NULL
)
RETURNS TABLE (
  value NUMERIC,
  timestamp TIMESTAMPTZ,
  provider TEXT,
  unit TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT m.value, m.timestamp, m.provider, m.unit
  FROM metrics m
  WHERE m.user_id = p_user_id
    AND m.type = p_type
    AND (p_provider IS NULL OR m.provider = p_provider)
  ORDER BY m.timestamp DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get metrics for date range
CREATE OR REPLACE FUNCTION get_metrics_range(
  p_user_id UUID,
  p_start_date TEXT,
  p_end_date TEXT,
  p_types TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  type TEXT,
  day TEXT,
  value NUMERIC,
  provider TEXT,
  unit TEXT,
  timestamp TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT m.type, m.day, m.value, m.provider, m.unit, m.timestamp
  FROM metrics m
  WHERE m.user_id = p_user_id
    AND m.day >= p_start_date
    AND m.day <= p_end_date
    AND (p_types IS NULL OR m.type = ANY(p_types))
  ORDER BY m.day DESC, m.timestamp DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON TABLE source_accounts IS 'OAuth tokens and connection status for wearable providers';
COMMENT ON TABLE metrics IS 'Normalized time-series data from all wearable providers';
COMMENT ON TABLE sync_cursors IS 'Tracks last sync position for each provider per user';
COMMENT ON VIEW daily_aggregates IS 'Pre-aggregated daily metrics for dashboard and calendar';

COMMENT ON COLUMN metrics.source_key IS 'Provider unique ID for deduplication (e.g., oura_sleep_2024-01-15)';
COMMENT ON COLUMN metrics.payload IS 'Extended data like sleep stages, HR zones, workout details';
COMMENT ON COLUMN source_accounts.metadata IS 'Provider config like enabled metric types, sync preferences';
