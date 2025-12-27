-- Security Hardening Migration
-- 1. Ensure RLS is enabled on all tables
ALTER TABLE weekly_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

-- 2. Weekly Config Policies
-- Drop existing to ensure clean slate (optional, but safer to CREATE OR REPLACE or IF NOT EXISTS logic)
DROP POLICY IF EXISTS "Enable full access for authenticated users" ON weekly_config;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON weekly_config; -- if any
DROP POLICY IF EXISTS "Enable all for anon" ON weekly_config; -- ensure none

-- Strict Admin Access Only
CREATE POLICY "Enable full access for authenticated users" ON weekly_config
  FOR ALL USING (auth.role() = 'authenticated');

-- 3. Submissions Policies
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON submissions;
DROP POLICY IF EXISTS "Enable insert for anon" ON submissions; -- ensure none

-- Admin Read Only
CREATE POLICY "Enable read access for authenticated users" ON submissions
  FOR SELECT USING (auth.role() = 'authenticated');

-- Ensure NO access for anon on submissions (Edge Function uses Service Role which bypasses RLS)
-- So we do NOT create an INSERT policy for anon.

-- 4. Create Index for performance/security (abuse check)
CREATE INDEX IF NOT EXISTS idx_submissions_phone_created ON submissions(phone_number, created_at);
