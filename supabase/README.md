# Supabase

Auth is already set up. Everything else goes in `migrations/`, numbered, run in order.

## Running a migration

Paste the file into the Supabase SQL editor and run it. Every migration is written
to be safe if you run it twice, so if you lose track you can just run them all again
from `0001`.

| File | What it does | Needed before |
| --- | --- | --- |
| `0001_session_plans.sql` | `session_plans` table, index, row level security | the session planner can save anything |
| `0002_favourites.sql` | `favourites` table, index, row level security | starred drills sync between devices |
| `0003_share_session.sql` | `share_token` column, unique index, the `shared_plan` function | a coach can send a session to whoever else takes the age group |

`0001` and `0002` are applied. `0003` is not yet, so the share button stages a token
locally and the link will not resolve until it has been run. `docs/roadmap.md` tracks
the state of play.

## About `shared_plan`

The one function in the database. It is the second piece of server code in the
project after `api/delete-account.ts`, so it is worth understanding before it is
changed.

Whoever opens a shared link is usually not signed in, so row level security has
nothing to match them against. A policy loose enough to let the token through would
also let anyone list every shared plan along with the `user_id` on each one. So the
token goes in as an argument instead: the function is the only way to that row and
it returns at most one. Its columns are written out so `user_id` can never come back
with it.

`security definer` is what lets it see past the policy. `set search_path = public`
is not decoration: without it a definer function can be pointed at somebody else's
schema. Keep both if you touch it.

## Auth settings to check

- Email confirmations **on**
- Site URL `https://equalplay.io`
- Redirect URLs `https://equalplay.io/hub` and `http://localhost:5173/hub`

## Environment variables

See `.env.example`. The service role key is server only. It must never carry a
`VITE_` prefix or it ships to the browser and walks straight past every policy.
