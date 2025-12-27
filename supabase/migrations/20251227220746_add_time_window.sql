-- Add active_from and expires_at columns to weekly_config
ALTER TABLE weekly_config
ADD COLUMN IF NOT EXISTS active_from TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;
