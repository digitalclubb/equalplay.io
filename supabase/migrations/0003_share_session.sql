-- 0003_share_session
-- Run this in the Supabase SQL editor after 0002. Safe to run more than once.
--
-- A coach shares the session with whoever else takes the age group. They read
-- it, they cannot change it and they do not need an account, because the person
-- who turns up on a Tuesday to help is not going to register first.
--
-- The token is the whole permission. It is null until the author asks for a
-- link. Clearing it takes every copy of that link out of service at once, which
-- is what keeps sharing revocable.

alter table public.session_plans
  add column if not exists share_token uuid;

-- Partial, so the unshared rows do not all collide on null
create unique index if not exists session_plans_share_token_idx
  on public.session_plans (share_token)
  where share_token is not null;

-- The reader is anonymous, so row level security cannot help: there is no
-- auth.uid() to match against. A policy loose enough to let the token through
-- ("share_token is not null") would also let anyone list every shared plan and
-- the user_id on each one.
--
-- So the token goes in as an argument instead. This is the only way in and it
-- returns at most one row. The columns are written out so a caller can never
-- reach user_id. security definer is what lets it see past the policy.
-- search_path is pinned because that is what stops a definer being tricked into
-- running somebody else's function.
create or replace function public.shared_plan(token uuid)
returns table (
  id              uuid,
  title           text,
  age_group       text,
  theme           text,
  session_minutes integer,
  blocks          jsonb,
  updated_at      timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    plan.id,
    plan.title,
    plan.age_group,
    plan.theme,
    plan.session_minutes,
    plan.blocks,
    plan.updated_at
  from public.session_plans as plan
  where plan.share_token = token
$$;

-- Nobody gets it by default. The two roles the app actually uses are named.
revoke all on function public.shared_plan(uuid) from public;
grant execute on function public.shared_plan(uuid) to anon, authenticated;
