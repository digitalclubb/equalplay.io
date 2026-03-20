-- Equal Play: shared sessions
-- Run this in your Supabase SQL editor.

create table sessions (
  id text primary key,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

-- No auth — permissive RLS (session IDs are random UUIDs)
alter table sessions enable row level security;

create policy "Anyone can read sessions"
  on sessions for select using (true);

create policy "Anyone can insert sessions"
  on sessions for insert with check (true);

create policy "Anyone can update sessions"
  on sessions for update using (true);

-- Enable realtime for the sessions table
alter publication supabase_realtime add table sessions;
