-- 0002_favourites
-- Run this in the Supabase SQL editor after 0001. Safe to run more than once.
--
-- One row per coach per drill. `drill_id` is a slug from the bundled catalogue
-- rather than a foreign key, because the drills are not in the database.
--
-- The composite primary key is the whole trick: it makes starring an upsert and
-- unstarring a delete, with no chance of the same drill being favourited twice.

create table if not exists public.favourites (
  user_id    uuid not null references auth.users (id) on delete cascade,
  drill_id   text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, drill_id)
);

-- Fetching a coach's favourites is the only read pattern
create index if not exists favourites_user_id_idx
  on public.favourites (user_id, created_at desc);

alter table public.favourites enable row level security;

drop policy if exists "own favourites" on public.favourites;
create policy "own favourites" on public.favourites
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
