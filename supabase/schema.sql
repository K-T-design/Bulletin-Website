-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Weekly Config Table
create table weekly_config (
  id bigint primary key generated always as identity,
  current_week_start date not null default current_date,
  valid_code text not null,
  is_active boolean default true,
  winner_selected boolean default false,
  created_at timestamptz default now()
);

-- Submissions Table
create table submissions (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz default now(),
  first_name text not null,
  phone_number text not null,
  submitted_code text not null,
  is_correct boolean default false,
  ip_address text -- for rate limiting/abuse prevention
);

-- Index for phone number to prevent duplicates per week easily if needed
create index idx_submissions_phone on submissions(phone_number);
create index idx_submissions_created_at on submissions(created_at);

-- RLS Policies (Secure by default)
alter table weekly_config enable row level security;
alter table submissions enable row level security;

-- 1. Weekly Config Policies
-- Allow Authenticated users (Admin) to do everything on weekly_config
create policy "Enable full access for authenticated users" on weekly_config
  for all using (auth.role() = 'authenticated');

-- Allow Anon users (Edge Function/Client) to READ active config?
-- Actually, the Edge Function uses Service Role, so it bypasses RLS.
-- The Client (script.js) does NOT read weekly_config directly. It calls the Edge Function.
-- So we don't need to expose weekly_config to anon.

-- 2. Submissions Policies
-- Allow Authenticated users (Admin) to VIEW submissions (to find the winner)
create policy "Enable read access for authenticated users" on submissions
  for select using (auth.role() = 'authenticated');

-- Allow Anon users to INSERT submissions?
-- No, the Edge Function handles insertion using Service Role.
-- So we keep submissions locked down for anon.

-- Only service_role (Edge Functions) has full bypass access.
