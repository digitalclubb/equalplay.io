# Where this project is

Written down so a new session does not have to reconstruct it. Update it when the answer
changes rather than letting it rot.

Last updated 21 August 2026, after session sharing. See `docs/one-product.md` for the
one-product change that preceded it and which of its phases are built.

## Blocking: run `0003` before the next deploy

`syncPlans` selects `share_token` and every upsert sends it. Against a schema without
that column PostgREST rejects both, so a deploy that lands ahead of the migration
takes out session sync for every coach, not just sharing. They would see the offline
notice on a working connection and their edits would sit in `unsynced` until it ran.
Nothing is lost, because the local mirror holds everything and retries, but it looks
like the app has broken.

Paste `supabase/migrations/0003_share_session.sql` into the SQL editor first, then
push.

## Where the real project stands

The hub now runs against the real Supabase project. It is committed, pushed, deployed
and exercised in production, which clears the blocker this section used to carry. The
migrations are applied. The environment variables are set in Vercel with the service
role key correctly unprefixed. Registration, email confirmation, sync and favourites
have been used for real rather than against a stub.

| Step | State |
| --- | --- |
| `supabase/migrations/0001_session_plans.sql` applied | done |
| `supabase/migrations/0002_favourites.sql` applied | done |
| `supabase/migrations/0003_share_session.sql` applied | **not yet** |
| Environment variables set in Vercel, service role key without a `VITE_` prefix | done |
| Committed, pushed, deployed | done |
| Register for real, confirm the email, build a session, star a drill, reload | done |
| Delete the account and confirm the rows are gone | done |

Every path is now proven against the real project, account deletion included.
`api/delete-account.ts` has executed: it verifies the caller's own JWT, admin-deletes
that user, then their plans go with them through `on delete cascade`. It is the only
server code in the project, so it is the only thing here that can destroy data. Any
change to it wants a throwaway account to re-verify against.

No credential ever reached the repository. `.env.local` matches `*.local` in
`.gitignore` and has never appeared in git history. `.env.example` carries
placeholders only.

## Built

**One product.** `/` is static marketing HTML with no bundle, one call to action,
pointing at the app. The match-day planner sits at `/planner` as its own entry so
Supabase never lands on the indexed page, but it shares the shell, the navigation and
the manifest, so it reads as one thing. Signed out is a real state: pick an age grade
and the whole catalogue for it is readable with no account. Gates are on persistence
only, meaning saved sessions and starred drills. See `docs/one-product.md`.

**Age grade rules guides.** `#/guide` in the hub, one page per grade from U7 to
U12, written from the RFU's own rules of play and checked against the appendices
in August 2026. Data in `hub/content/guides.ts`, so it ships in the bundle and
opens with no signal. Not gated by the coach's own grade: reading what U10 allows
is the point of it when you are coaching U9 in May.

**Match-day planner.** Unchanged in behaviour. It now uses the shared shell in
`src/base.css`, so it has the same navy bar on a phone, the same rail at 900px and the
same five tabs as the app, while still shipping 13.9 kB gzipped with no Supabase in it.
Team switching moved out of the chrome into the planner's own view, above the squad
inputs, because the chrome is navigation only.

**Marketing.** `/` positions the app rather than the planner: one call to action, the
drills as the lead, U7 to U12 named in the first sentence. Static HTML at roughly 5.5 kB
gzipped. It carries `WebSite`, `Organization`, `SoftwareApplication` and `FAQPage`
structured data, the last generated from the page itself so the two cannot drift.
There are no testimonials, because there are no users to quote. The proof band is
checkable instead: counts that match the code plus links to the RFU's own appendices.

**Search.** Two clusters of static pages in `public/`. Match day covers substitution,
the playing time calculator and Regulation 15. Drills covers the age grades, one page
each from U7 to U12 plus an index. Every one carries `BreadcrumbList` and `FAQPage`
structured data whose questions are visible on the page, points its chrome at `/hub`
and shares one footer. `landing-pages.test.ts` holds the drill counts to the
catalogue, so adding a drill cannot leave seven pages quietly wrong. The sitemap was
never submitted to Search Console until 19 August 2026, which is most of why four of
five URLs had never been crawled.

**Copy.** Rewritten away from the rhythms that read as machine-written. Staccato
triplets, negative parallelism, anaphora, no contractions. `docs/content-sourcing.md`
records which patterns and why. Coaching points stay clipped on purpose, because they
are read one-handed in the rain.

**Sharing.** A session goes out as a link to whoever else takes the age group. They
read it, they cannot change it and they need no account, because the person who turns
up on a Tuesday to help is not going to register first. The token is the whole
permission and clearing it takes every copy of that link out of service. Read through
`shared_plan` in migration `0003` rather than through the table, because the reader is
usually anonymous and RLS has nothing to match them against. Needs `0003` run against
the live project before a link resolves.

**Coaching hub.**

- Account: register with name, club and age group, sign in, reset, change password, edit
  details, delete the account for real
- Privacy notice at `/privacy`. The "no account" copy elsewhere is scoped so it stays true
- Catalogue: 100 drills, U7 to U12, filtered by age grade, focus, type and free text
- Favourites, starred per coach, synced and filterable
- Session planner: ready-made sessions, build from scratch, reorder, water breaks, live
  time budget, kit list, warnings, print sheet
- A session opens in a reading view for the pitch, editing is behind a button
- Links out to the RFU's own rules of play from every age grade claim
- Responsive from 320px to a desktop rail, two-pane editor above 900px
- Offline first throughout. Local writes are synchronous, pushes are debounced, deletes
  leave tombstones. The interface says when something has not reached the server

## Next, in order

Shipping is done, so this is no longer guesswork about whether the thing works. It is
still guesswork about what a coach wants next, until one who is not us has used it for
a few weeks.

1. **"Eight turned up."** You planned for twenty, eight came, so you have to decide in
   the car park. Nobody does this, free or paid. It is the most real problem a
   volunteer has. Every drill already carries `players: { min, max? }`, so this is a
   number input and a filter over the blocks, flagging what will not work.
2. **Present mode.** One drill fullscreen, big type, coaching points only. Sportplan's
   marquee feature. About twenty lines here.
3. **What you have already run.** Framed as coverage rather than as a diary: handling
   four weeks running and nothing on evasion since June is the failure a volunteer
   actually has. Needs migration `0004`. Stores nothing about a child.
4. **Your own drills.** Every club has three of its own. Without this the catalogue is
   always somebody else's. The expensive part is not storage: a coach can tag a ruck
   drill U8 and the one safety promise is gone. Scope the gate before building it.

Instrumentation is live but has no data yet. `planner_to_app` and `register` are the
two custom events, from `src/lib/track.ts`. A season of those answers whether the free
planner actually feeds the app, which `docs/one-product.md` says is the number the
whole shape of the product turns on.

## The competition

| | Price | What they have that we do not |
| --- | --- | --- |
| Rugby Coach Weekly | £9.95 to £12/mo, £108/yr | 3,000 drills, 350 ready-made plans |
| Sportplan | Free tier plus paid | Diagrams, animator, present mode, sharing, season planner |
| RugbyCoaching.tv | Not published | Video |
| RugbyCoachingDiary | App store | Roster, attendance, calendar |

Volume is the wrong race. Nobody browses 3,000 drills, which their own 350 pre-made plans
quietly admit. **Not one of them gates content by what an age grade is legally allowed to
do**. That gap widens the more they add.

Rugby Coach Weekly organises by skill rather than by grade, which is what breadth costs
them: covering U6 to U17+ from one library means no page can know who is reading it. Our
gap widens the more they add.

**Decided 21 August 2026: free, for good.** This is for volunteers giving up their
Sundays, so there is no paid tier to design around and the earlier £24 to £36/yr note is
withdrawn. That settles what to build: things that help one unpaid coach on a Tuesday,
never things that would justify a price.

## Out of scope, with reasons

- **Anything about a child.** No names, notes, photographs or medical information. This is
  the line the whole product is built around and it is not a trade-off to revisit.
- **Video.** Production cost, plus it breaks the offline promise.
- **Attendance registers.** Drifts straight towards children's data.
- **Contact load and FITT modelling.** RFU guidance for that is written for U13 to U18, so
  it would be guesswork at minis level. Revisit if the hub ever goes above U12.
- **WRU content.** Later phase. RFU first, because that is the grade being coached.
- **A public indexed drill catalogue.** Still out. The separate work it named is now done:
  `public/rugby-drills-by-age-group` plus a page per grade say what each age group may
  practise and how many drills it has, without reproducing a word of a drill. The hub
  itself stays `noindex`. Publishing the drill copy is a different decision with its own
  copyright question and it has not been taken.
- **Payments and tiers.** Free for good, decided 21 August 2026. See above.
- **Competing on drill count.** 100 a coach can trust beats 3,000 they have to check.
- **A magazine or any editorial cadence.** That is Rugby Coach Weekly's business and it
  is a treadmill a volunteer project cannot keep up with.

## Known issues

- **A shared link needs signal the first time.** It was never the reader's plan to hold
  on their device, so there is nothing to cache. The view says so rather than looking
  broken.
- **`0003_share_session.sql` is not applied yet.** See the blocker at the top.
- **A stale second device can revoke a live link.** `share_token` is last-write-wins
  like the rest of the row, so a tablet holding an unsynced edit from before the coach
  shared will push null over the token. Marked `ponytail:` in `plans.ts`. The fix is
  the token getting its own row, which is not worth it yet.
- The skip link leaves `#hub-view` in the URL, so a reload lands on Drills rather than the
  view you were on. Cosmetic.
- No way to add a drill to a session from the drill page. The planner's own search is the
  single path, which was a deliberate choice rather than an oversight.
- The signed-out catalogue is readable by anyone, but the app is still `noindex`. Making
  it indexable is most of the work of the public drill catalogue below, so it is its own
  decision rather than a side effect.
- `e2e/contrast.spec.ts` covers the homepage, the planner and the signed-out hub. The
  signed-in views need an auth stub before it can reach them.
- `e2e/hub.spec.ts:146` opens a drill by clicking `.drill-card` rather than the link
  inside it. That aims at the element's centre, which moves when the web font swaps, so
  it can miss under load. One test was fixed this way already.
- Anything the router reaches by changing the hash renders a task after the click, so a
  `count()` straight after one reads the old view. Wait on a retrying assertion first.
  Two tests have been fixed for this.

## Decisions worth not relitigating

Each of these was argued through once and the reasoning is in `CLAUDE.md`.

- Drill content is static data in the bundle, not database rows, because offline is the
  requirement that matters most
- The coach's profile lives in auth metadata rather than a `profiles` table, because
  nothing security sensitive keys off it
- Separate Vite entries rather than one app, so `@supabase/supabase-js` never lands in the
  rotation planner's bundle
- The age gate is enforced by tests, not by discipline
- Reading a session is the default, editing is the detour
