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

As of 18 August 2026 neither has been run against the live project, so the hub works
on the device and nothing reaches the server. `docs/roadmap.md` tracks that.

## Auth settings to check

- Email confirmations **on**
- Site URL `https://equalplay.io`
- Redirect URLs `https://equalplay.io/hub` and `http://localhost:5173/hub`

## Environment variables

See `.env.example`. The service role key is server only. It must never carry a
`VITE_` prefix or it ships to the browser and walks straight past every policy.
