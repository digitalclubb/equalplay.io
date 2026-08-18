-- 0001_session_plans
-- Run this in the Supabase SQL editor. Safe to run more than once.
--
-- Auth is already set up, so nothing here touches it. Coach details (name, club,
-- age group) live in auth.users.raw_user_meta_data rather than a profiles table.
-- Nothing security-sensitive keys off those fields so a table, a trigger and a
-- policy would be three moving parts for no gain. Add a profiles table the day
-- something needs to query across coaches.
--
-- Drill content is not in the database either. It ships in the app bundle so the
-- catalogue still opens on a pitch with no signal.

create table if not exists public.session_plans (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  title           text not null,
  age_group       text not null,
  theme           text,
  session_minutes integer,
  -- [{ "drillId": "...", "minutes": 8 }, ...]
  -- Drill ids come from the bundle so there is nothing to join to.
  blocks          jsonb not null default '[]'::jsonb,
  updated_at      timestamptz not null default now()
);

create index if not exists session_plans_user_id_idx
  on public.session_plans (user_id, updated_at desc);

alter table public.session_plans enable row level security;

-- One policy covers select, insert, update and delete. "using" gates reads plus
-- the rows an update or a delete can touch. "with check" stops a row being
-- written against somebody else's user_id.
drop policy if exists "own plans" on public.session_plans;
create policy "own plans" on public.session_plans
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
