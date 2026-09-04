# Where this project is

Written down so a new session does not have to reconstruct it. Update it when the answer
changes rather than letting it rot.

Last updated 4 September 2026, after the colour scheme, the view transitions and the
grouped filters. See `docs/one-product.md` for the one-product change that preceded it
and which of its phases are built.

## Blocking: run `0004` before the next deploy

`session_runs` is a new table, so a deploy ahead of the migration is not the
disaster the share token would have been: sessions, favourites and everything
else carry on. What breaks is only the log. A coach marks a night as run, it
stays on their device. The coverage list looks right to them until they pick up
a second phone and find it empty.

Paste `supabase/migrations/0004_session_runs.sql` into the SQL editor, then push.
Nothing is lost either way, because the local mirror holds every night and
retries on the next load and whenever the browser comes back online.

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
| `supabase/migrations/0003_share_session.sql` applied | done |
| `supabase/migrations/0004_session_runs.sql` applied | **not yet** |
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
usually anonymous and RLS has nothing to match them against.

**The drills teach rather than remind.** Every one of the 100 carries at least
one fault: what it looks like when it is going wrong, plus the one thing to say.
Coaching points assume a coach who has seen the drill go right before. This
audience is a parent who never played. It is the gap the competition fills with
video, which costs money and puts children on camera, so it is words instead.

**What you have covered.** Framed as coverage rather than as a diary, because
nobody keeps a diary. A coach marks a night as run from the session and the
sessions page lists every theme their grade is allowed, worst first: never
coached above coached weeks ago. Handling four Tuesdays running and nothing on
evasion since June is the failure a volunteer actually has. It was invisible.
Local-first like the stars, so the button works at a pitch. Needs `0004` run
against the live project before a second device sees any of it. Stores nothing
about a child: a row is a date, a title and a list of themes.

**Present mode.** `#/plan/<id>/run/<n>`. One block at a time at arm's length,
coaching points big, minutes counting down, the screen held awake. The block is
in the URL so a phone that locks comes back to the drill being run. Overrunning
counts up rather than stopping at zero. It shows the drill's setup and its
diagram, so a coach knows where the cones go, with how it runs plus the ways to
change it one tap behind them.

**A drill goes into a session from the drill page.** The planner's own search
was the only way in. Sessions the drill's grade may not do are left out, with the
gate enforced in `addDrillToPlan` rather than only in the render.

**Small space.** One chip in the catalogue and in the editor, derived from each
drill's diagram, for the January hall and the half pitch. See `CLAUDE.md` for why
the box is 25 by 15 rather than the sports hall it started at.

**Hard ground.** The chip beside it, for a pitch baked solid or frozen. This one is
authored rather than derived, because a shield drill where nobody goes down and one
where everybody does read the same in the data while the surface is the whole
question. 43 drills carry `softGround`: somebody goes to ground in them, works from
their knees, or could be put there by a collision. Nothing below U9 has it at all, so
a coach on a frozen U7 evening loses nothing. It is a browse filter rather than a
verdict on the weather.

**The filters are grouped by what they do.** Nine chips in one row put the pitch you
have got tonight beside what the drill is about, all wearing the same shape, when
tapping a theme replaces the theme before it and tapping the other two stacks with
everything. Above the rule is the drill itself, its kind then its theme. Below it is
your stars and your pitch. The two that stack carry a leading tick, which is how a
control says it combines. Clear filters sits next to the count once there is
something to clear, because every chip being its own way back still leaves four taps
to reach the whole list.

**The offline promise, said out loud.** The Account page says whether the app is
saved on the device and offers the home screen install where a browser gives one.

**The rules guides are indexed.** Same words, two publications: the hub route a
coach reads with no signal, plus a static page per grade emitted at build for
search. `/rugby-rules-u7` through `u12` plus an index, in the sitemap, linked
from the drills cluster.

**The app follows the reader's colour scheme, with a switch to overrule it.** Tokens
flip in `src/base.css` using the values `public/pages.css` had already chosen, so the
site and the app are one palette rather than two takes on it. The static pages had
flipped for months while the app had not, which meant reading the homepage at night
and tapping through got you a white screen in the face. The switch is one button that
flips, top right of the phone bar and under Account in the rail, because the footer
put it below a hundred drill cards. Light and Dark are the only two states. Auto sat
ahead of them in the cycle for a while and read as a mode of its own rather than as
the two colours it picks between, so the phone's own preference is the fallback now
instead of a named option on screen.

**Movement is the browser's job.** `src/lib/motion.ts` hands a DOM change to
`startViewTransition`, which photographs the page either side of it and animates
between the two. That is the whole of the sliding pill in the nav, the segmented
controls and match day's team tabs, with nothing measuring a tab and no number to go
stale when a label changes. The theme chips gave their slide up, because a pill flying
between chips of different widths, sometimes across a line break, answers nothing.
Reduced motion is honoured in `motion.ts` rather than in CSS.

**The hub's buttons have three tiers and answer a pointer.** One filled button for
what a screen is for, an outlined one for the other things a coach might do, then that
same button at the width of its own label for a dismissal. Only the filled tier had a
`:hover` rule before this, so Print it, Duplicate, Delete this session, Got it and Not
now were all dead under a mouse. Every input, select, chip and stepper now wears
`--color-control-edge`, which is the 3:1 boundary WCAG 1.4.11 asks of a control.

**The sessions page is two lists you can read.** Both were wrapped in a panel, which
made every card a card inside a card, so the only thing left telling one apart was a
grey fill. They sit on the page under a heading now, the way the drill list already
did. Your own sessions come first once there are any. Each card draws the shape of the
evening, one segment per block flexed to its own minutes, so six cards look like six
different evenings rather than six bold titles over a grey line. Grid or list is a
toggle and the choice is kept.

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

**The Half Game Rule, checked.** Match settings takes an optional match length,
so the planner can state playing time in the minutes Regulation 15 is written in
and say who is under half of what was available to them. Measured per player,
not per day, because a late arrival cannot reach half of a morning they missed.
It reports who is short and never certifies compliance, since the minutes are
worked out from the order of substitutions rather than from a clock. It also
says when no rotation can get everybody there, which is a fixture problem: once
more than twice as many turn up as go on the pitch, somebody finishes under the
floor whatever you do.

**Reg 15 in the places it was missing.** The rule is named on the pages a search
engine reads rather than only inside the guide. Squad sizes per grade sit on the
match settings panel, one tap each. Girls' and mixed rugby is in the guides,
which had no mention of either. Contact drills link the RFU's Headcase. The
guide footer links their Age Grade Resources. Every age grade claim carries the
season it was read for. `guides.test.ts` fails the build once that date is over
a season old.

**A page that says who writes this.** `/about`, linked from the hub footer,
where "About Equal Play" used to go to the marketing homepage. Plus "Tell us if
this is wrong" on every guide page and every static rules page, because the
people most able to correct one are referees and age grade coaches and there was
nowhere for them to say so.

## Next, in order

Shipping is done, so this is no longer guesswork about whether the thing works. It is
still guesswork about what a coach wants next, until one who is not us has used it for
a few weeks.

1. **Your own drills.** Every club has three of its own. Without this the catalogue is
   always somebody else's. The expensive part is not storage: a coach can tag a ruck
   drill U8 and the one safety promise is gone. Scope the gate before building it.
2. **Submit the rules pages to Search Console.** Seven new URLs went into the sitemap
   on 27 August 2026. The drills cluster took months to get crawled because nobody
   told Google it existed, which is a mistake worth not repeating.

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
- **A headcount check on a session.** Shipped 4 September 2026, taken out the same
  week. It read a drill's stated group size as a rule and told a coach a block
  would not run, when a coach adapts a drill to whoever turned up without being
  asked. "Needs 6" is a note about the shape of the drill rather than a floor,
  so checking a plan against it was the app being confidently wrong at the one
  moment a coach has no time for it.
- **A magazine or any editorial cadence.** That is Rugby Coach Weekly's business and it
  is a treadmill a volunteer project cannot keep up with.

## Known issues

- **The hub is one chunk and Supabase is in it.** 473 kB raw. Roughly half of
  that is `@supabase/supabase-js`, imported statically, so a
  signed-out first visit downloads the sign-in machinery before a drill renders.
  Measured on a 4x throttled phone: the chrome paints at 116ms because both
  entries write their nav and stylesheet into the document, but the drill list
  arrives at 514ms on 4G and 4.5s on slow 3G. The service worker means only the
  first visit pays. Making the client lazy means a fast path that decides signed
  in or out without it, which is a change to the one part that must not break,
  so it wants verifying against a real account rather than a stub.
- **A shared link needs signal the first time.** It was never the reader's plan to hold
  on their device, so there is nothing to cache. The view says so rather than looking
  broken.
- **A stale second device can revoke a live link.** `share_token` is last-write-wins
  like the rest of the row, so a tablet holding an unsynced edit from before the coach
  shared will push null over the token. Marked `ponytail:` in `plans.ts`. The fix is
  the token getting its own row, which is not worth it yet.
- The skip link leaves `#hub-view` in the URL, so a reload lands on Drills rather than the
  view you were on. Cosmetic.
- The signed-out catalogue is readable by anyone, but the app is still `noindex`. Making
  it indexable is most of the work of the public drill catalogue below, so it is its own
  decision rather than a side effect.
- `e2e/contrast.spec.ts` covers the homepage, the planner and the signed-out hub. The
  signed-in views need an auth stub before it can reach them. Present mode and the
  Account page's device panel are both signed in, so both are unmeasured. The one
  fixed colour either of them uses for text is `--color-danger` on `--color-bg` at
  roughly 4.6:1, checked by hand rather than by machine.
- No way to add a drill to a session from present mode, which is where "eight turned
  up" will want one.
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
