-- 0004_session_runs
-- Run this in the Supabase SQL editor after 0003. Safe to run more than once.
--
-- One row per training night a coach says they ran. It exists to answer one
-- question: what have you not covered lately. Handling four Tuesdays running
-- and nothing on evasion since June is the failure a volunteer actually has,
-- and nothing in the app could see it.
--
-- A new table rather than a column on `session_plans`, deliberately. A deploy
-- landing ahead of this migration then degrades to the log not syncing, rather
-- than taking session sync down with it the way a new column on an existing
-- select would. That mistake is written up in the 0003 notes.
--
-- `themes` is copied off the plan at the moment it ran rather than looked up
-- later. A plan gets deleted, or edited into something else entirely. The night
-- you actually coached still happened. The log is a record of the past,
-- so it cannot depend on the present.
--
-- Nothing here is about a child. A row is a date, a title and a list of themes.

create table if not exists public.session_runs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  -- The plan it came from, kept only so the interface can link back. Text, not
  -- a foreign key: deleting a session must not delete the record of running it.
  plan_id    text,
  title      text not null,
  age_group  text not null,
  themes     text[] not null default '{}',
  ran_on     date not null,
  created_at timestamptz not null default now()
);

-- The only read pattern is one coach's log, most recent first
create index if not exists session_runs_user_idx
  on public.session_runs (user_id, ran_on desc);

alter table public.session_runs enable row level security;

drop policy if exists "own session runs" on public.session_runs;
create policy "own session runs" on public.session_runs
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
