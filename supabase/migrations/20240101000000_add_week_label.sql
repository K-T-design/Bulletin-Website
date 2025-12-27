-- Add week_label column to weekly_config
alter table weekly_config add column if not exists week_label text;
