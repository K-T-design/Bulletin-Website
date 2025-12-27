
-- Run this in your Supabase SQL Editor to enable the new dashboard features
alter table weekly_config add column if not exists week_label text;
