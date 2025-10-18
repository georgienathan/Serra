-- Create attachments table for AI file processing
CREATE TABLE IF NOT EXISTS attachments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('nutrition', 'exercise', 'period', 'sleep')),
  day TEXT NOT NULL, -- YYYY-MM-DD
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('image', 'audio')),
  file_size INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'ready', 'error')),
  extracted JSONB,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own attachments" ON attachments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own attachments" ON attachments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own attachments" ON attachments
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own attachments" ON attachments
  FOR DELETE USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_attachments_user_category_day ON attachments(user_id, category, day);
CREATE INDEX IF NOT EXISTS idx_attachments_status ON attachments(status) WHERE status = 'processing';
CREATE INDEX IF NOT EXISTS idx_attachments_created_at ON attachments(created_at);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_attachments_updated_at 
    BEFORE UPDATE ON attachments 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
