# Equal Play

One rugby coaching app for minis and junior coaches, U7 to U12. It ships as three
documents, which is a build decision rather than a product one. See
`docs/one-product.md`.

**Marketing homepage** at `/`. Static HTML, no bundle, no JavaScript, one call to
action.

**The app** at `/hub`. Drills, session planner, account. `noindex`. Pick an age grade
and the whole catalogue for it is readable with no account. An account is needed only
for what has to persist, meaning saved sessions and starred drills.

**Match-day planner** at `/planner`. Fair playing time on match day. Free for good, no
account, indexed, everything stays on the device. Its own entry so
`@supabase/supabase-js` never lands on it. This is the top of the funnel.

No data about any child is stored or transmitted anywhere.

## Getting started

```bash
pnpm install
cp .env.example .env.local   # fill in from your Supabase project
pnpm dev
```

`http://localhost:5173` is the marketing homepage, `/hub` the app, `/planner` the
match-day planner. Without `.env.local` the app says so plainly rather than failing
oddly; the match-day planner needs nothing.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Dev server |
| `pnpm build` | Type-check then build |
| `pnpm test` | Unit and integration tests |
| `pnpm test:watch` | The same, watching |
| `pnpm test:e2e` | Playwright, all three entries |
| `pnpm lint` | OXC over `src/` and `api/` |
| `pnpm preview` | Preview the build |
| `pnpm preview:demo` | Build and preview with throwaway Supabase credentials |
| `pnpm generate-icons` | Rasterise the PWA icons and OG image |

**Never write `.env.local` from a script.** It holds real credentials, it is gitignored
so there is no copy to restore, which means overwriting it destroys them. `pnpm preview:demo`
passes throwaway values inline instead.

## The rotation planner

Enter your squad, set players per team and number of matches, tap **Sort my team**. Then
run the session: mark players late, injured or leaving early, make substitutions, advance
through the games. A fairness-debt algorithm tracks each child's actual playing time
against their fair share and rebalances the remaining games to compensate.

Nothing leaves the device. No account, no team code, nothing to delete if a parent asks.

## The coaching hub

104 drills and 30 ready-made sessions covering U7 to U12, written from scratch.

The point of it is the age gate. RFU Regulation 15 introduces contact in stages, so the
catalogue only ever offers what your grade is allowed to do: tackling from U9, rucks,
mauls and the uncontested scrum from U10, the lineout from U12. Every claim links out to
the RFU's own rules of play so a coach can check it.

- Filter by age grade, focus, warm-up or exercise, or free text
- Star drills and filter to favourites
- Build a session that fits the pitch time you booked, with water breaks counted
- A kit list per session, plus a printable sheet
- A session opens to be read at the pitch, with coaching points on the page. Edits sit
  behind an Edit button

## Supabase

Auth is set up. Everything else is a numbered migration in `supabase/migrations/`, run in
order. See `supabase/README.md`.

The hub holds as little as possible: the coach's name, club and age group live in
`auth.users.raw_user_meta_data`. The only tables are `session_plans` and `favourites`,
both scoped by row level security. Drill content is not in the database at
all. It ships in the bundle, which is what makes the catalogue readable at a pitch with
no signal.

## Testing

```
pnpm test       474 unit and integration tests across 14 files
pnpm test:e2e    60 Playwright tests, 7 rotation planner and 53 hub
```

The hub end-to-end tests stub auth in localStorage and run against a build carrying
throwaway credentials, so every Supabase request fails on purpose. That is what proves
the hub still works with no signal.

Three test files are load bearing rather than incidental:

- `content-age-gate.test.ts` stops a ruck drill reaching a U8 coach
- `plans.test.ts` mocks the client so persistence can be exercised with the server off
- `copy-style.test.ts` enforces the house style across drills, interface and pages

## Deployment

Static, on Vercel. `dist/` holds two entries, `index.html` and `hub/index.html`, plus the
static guide pages copied from `public/`. One serverless function, `api/delete-account.ts`.

Environment variables in Vercel: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and
`SUPABASE_SERVICE_ROLE_KEY`. The last one is server only and must never carry a `VITE_`
prefix, or it ships to the browser and walks past every policy.

## Further reading

| File | What is in it |
| --- | --- |
| `CLAUDE.md` | Architecture, design decisions and the rules that must not be broken |
| `docs/content-sourcing.md` | How drill content gets written, plus the copyright position |
| `docs/roadmap.md` | What is built, what is left, what is deliberately out of scope |
| `supabase/README.md` | Migrations and auth settings |
| `.impeccable.md` | Who this is for and how it should feel |

## Licence

ISC
