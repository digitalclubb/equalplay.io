# CLAUDE.md: project instructions for Claude

## Project

Equal Play is one mobile-first web app for youth rugby coaches. It ships as three
documents, which is a build decision rather than a product one. See
`docs/one-product.md`.

- **Marketing homepage** (`/`): static HTML, no bundle, no JavaScript. One call to
  action, pointing at the app.
- **The app** (`/hub`): drill catalogue, session planner, account. `noindex`. Drills
  are free to read once an age grade is picked, no account needed. An account is
  required only for what has to persist, meaning saved sessions and starred drills.
- **Match-day planner** (`/planner`): fair player rotations and live substitutions.
  Free for good, no account, indexed, everything in localStorage. Its own entry so
  `@supabase/supabase-js` never lands on it. Never regress this.

Content is gated by RFU age grade throughout. No data about any child is ever stored
or transmitted, anywhere.

**Read `docs/roadmap.md` first.** It says what is built, what is next, what is
deliberately out of scope, plus what is still blocking. The hub runs against the real
Supabase project in production. Auth, email confirmation, sync, favourites plus account
deletion are all proven rather than assumed.

| Where | What is in it |
| --- | --- |
| `docs/roadmap.md` | State of play, next steps, decisions not to relitigate |
| `docs/content-sourcing.md` | How drill content gets written, plus the copyright position |
| `supabase/README.md` | Migrations to run, auth settings to check |
| `.impeccable.md` | Who this is for, where they use it, how it should feel |
| `README.md` | The outside view, for a human arriving cold |

## Tech stack

- TypeScript (strict mode)
- Vite (build tool)
- Vanilla DOM (no framework)
- OXC (linting)
- Vitest (testing)
- pnpm (package manager)

## Commands

```bash
pnpm dev          # Start dev server
pnpm preview:demo # Build and preview with throwaway Supabase credentials
pnpm build        # Type-check + production build
pnpm test         # Run all tests (vitest)
pnpm test:watch   # Run tests in watch mode
pnpm lint         # Run OXC linter
```

## IMPORTANT: How every request finishes

Nothing is finished until both of these have happened. This applies to every request,
however small it looked when it started.

1. **Review the diff.** Run `/code-review`, or read the diff yourself with the same
   attention when that is not available. Act on what comes back, then run `pnpm test`
   and `pnpm lint` again. A review nobody acted on is worse than no review.
2. **Commit to `main`.** Straight to the branch, no feature branch and no pull
   request. Prefix the message the way the history does, so `feat:`, `fix:`, `docs:`
   or `chore:`. Say what changed rather than which files moved. One commit per idea,
   so two unrelated changes in one session are two commits.

Push only when asked for it. Tests and lint pass before the commit rather than after.
The e2e suite (`pnpm test:e2e`) belongs in that check whenever the change touches the
hub, the planner or anything either of them renders.

## IMPORTANT: Run tests when changing core logic

**Always run `pnpm test` after touching:**

- `src/logic/` (rotation.ts, validate.ts, storage.ts, sessionPlan.ts, playingTime.ts)
- `src/types/index.ts`
- `src/hub/content/` (types.ts, drills.ts, presets.ts, diagram.ts, catalogue/),
  **especially when adding a drill**

Do not skip them. A past bug where late and joined players were permanently benched after
a game advanced was only caught by `"joined player stays on field after game advances"`.

### Tests worth knowing about

667 unit and integration tests across 22 files, 156 Playwright tests. Most are ordinary.
These eleven are load bearing and a failure means the code is wrong, not the test:

| File | What it protects |
| --- | --- |
| `content-age-gate.test.ts` | A ruck drill can never reach a U8 coach. Theme floors, maxAge, presets, favourites, search, plus the one exception a shared link makes and the warning that pays for it |
| `sessionPlan.test.ts` | Plan arithmetic, the kit list, water breaks, block indexes addressing `plan.blocks` |
| `plans.test.ts` | Persistence with the server mocked off. Offline creates, offline deletes staying deleted |
| `copy-style.test.ts` | House style across drills, interface and pages. Em dashes, commas before "and", Americanisms, a ban list |
| `catalogue-view.test.ts` | Filter state above `filterDrills` cannot defeat the age gate, signed in or out |
| `nav.test.ts` | Both entries' written-out navs match `src/lib/nav.ts`, both link their own stylesheet rather than importing it, both share one chrome, nothing from `hub/` reaches the planner's bundle. Guide and Match day resolve to paths rather than fragments |
| `homepage-faq.test.ts` | The homepage's FAQ structured data says what the homepage says |
| `landing-pages.test.ts` | The age grade pages in `public/` state the counts the catalogue actually holds. Every static page's chrome points at the product, every FAQ is visible where it is claimed. Every grade has a rules page, linked from its drills page and from the index, in the sitemap, with no hand-written copy left in `public/` |
| `install.test.ts` | The offline promise is only made once the service worker is serving the page. The install offer is spent once shown, never on a prompt the browser refused to display. iPhone never fires the event, so the way in stays written down |
| `playingTime.test.ts` | The Half Game Rule check, which is the only verdict the product gives against an RFU regulation. A late arrival measured against the rugby they were there for rather than the whole day, an absent player left out of it, a squad too big for any rotation to clear the floor |
| `diagram.test.ts` | A drill diagram agrees with the drill. Cone counts against the kit list, dimensions against `space`, nothing outside the pitch, no fixed colour but the primary, no contest claimed that the drill has not got |

`rotation.test.ts`, `matchday-scenarios.test.ts` and `algorithm-audit.test.ts` cover the
rotation planner and predate the hub.

### End to end

`pnpm test:e2e` is 156 tests across four files: `matchday` (14), `home` (11), `hub` (105)
and `contrast` (26). `contrast.spec.ts` is the load-bearing one of those. It measures
text and control contrast in both colour schemes, plus a hovered nav tab at both nav
widths, because fixed brand colours sitting next to tokens that flip is a mistake that
has shipped three times: 1.5:1 on a button border, 1.12:1 on the homepage, then 1:1
on the tab you were already standing on. The hub specs stub auth by writing a session into localStorage, then wait
on `body[data-signed-in]` rather than on anything the chrome renders. The build under test carries
throwaway Supabase credentials passed inline from `playwright.config.ts`, so every request
to Supabase fails on purpose. That is what proves the hub still works with no signal.

`reuseExistingServer` is off deliberately. Reusing a server skips the build that inlines
those credentials, which fails the whole hub suite in a way that looks like an app bug
rather than a stale process.

## Architecture

Three Vite entries. `index.html` → `/`, `planner/index.html` → `/planner`,
`hub/index.html` → `/hub`. Keeping them separate is deliberate:
`@supabase/supabase-js` is ~220 kB and must never land in the planner's bundle. The
homepage ships no JavaScript at all. Static SEO pages fall into three clusters:
match day (`rugby-substitution-app`, `equal-playing-time-calculator`,
`rfu-regulation-15-playing-time`), drills (`rugby-drills-by-age-group` plus one
page per grade, `rugby-drills-u7` through `rugby-drills-u12`) and the rules guides
(`rugby-rules-by-age-group` plus `rugby-rules-u7` through `rugby-rules-u12`). The
first two are hand-written in `public/` and copied verbatim. The third is
generated at build from `hub/content/guides.ts` by `src/seo/rulesPage.ts`, so it
never appears in `public/` at all. All of them share `public/pages.css` with the
homepage and point their chrome at `/hub`, because the chrome belongs to the
product rather than to whichever half a coach landed on.

**The rules guides are published twice, from one source.** The guide a coach
reads is a hub route, in the bundle, so the Guide tab opens with no signal. The
hub is `noindex`, so the same words are also emitted as static pages a search
engine can read. Nothing is written twice: both come out of `guides.ts`. A copy
in `public/` would be a second source of truth going stale, which is why
`landing-pages.test.ts` fails if one appears. Two traps are worth knowing about.
`oxlint` loads `vite.config.ts` with plain Node, which cannot resolve a `.ts`
behind the `.js` specifier used everywhere else, so the generator is imported
inside the plugin hook rather than at the top of the file. And `vite preview`
resolves its config with the command set to `serve` while serving `dist`, so
`directoryIndex` sets its root in `configurePreviewServer`. Before that it only
found pages that also exist under `public/`, so a generated page 404'd locally
while working in production.

**A landing page states counts the catalogue owns.** "73 drills" on the U10 page is
true until somebody adds a drill. `landing-pages.test.ts` holds every count, theme
row, card and session title to what `filterDrills` would return for that grade, plus
the site-wide 100 to `DRILLS.length`, so a new drill fails the build rather than
quietly making seven pages lie. Note `maxAge`: one tag drill stops at U8, which is
why no grade above U8 sees all 100.

**There is no lineout at any grade the hub covers.** Reg 15 has touch restarting
with a free pass all the way through U13, the uncontested lineout arriving at U14
and lifting held back to U15. The site said U12 on seven pages and shipped four
lineout drills to match, one of them coaching a lift, until August 2026. The claim
is banned by `landing-pages.test.ts` now, by the claim rather than by the word, so
a page may still say a grade has no lineout. `THEME_LABELS.setpiece` reads "Scrum
and restarts" for the same reason.

One manifest for one product. `public/manifest.json` starts at `/hub` with no scope,
so a home screen gets one Equal Play icon rather than one per half. `sw.js` pre-caches
`/`, `/planner` and `/hub`. Static pages point their header at `/hub` while the logo
points home. A match-day page still sends its own in-body calls to action to
`/planner`, because that is what the coach came for.

```
src/
  base.css                # Shared: reset, tokens, header, footer, toast
  styles.css              # Rotation planner only (imports base.css)
  lib/
    esc.ts                # HTML and attribute escaping, used by both halves
    rulesLink.ts          # Links out to the RFU, one wording in one place
    nav.ts                # The five tabs, shared by both entries. Imports nothing
    track.ts              # The two custom analytics events, lazily imported
  types/index.ts          # Rotation planner domain types
  logic/
    rotation.ts           # Fairness algorithm (generateInitialPlan, applyEvents)
    validate.ts           # Input validation
    storage.ts            # localStorage persistence (multi-team)
    teamState.ts          # Multi-team store
    sessionPlan.ts        # Hub: plan totals, warnings, kit list, breaks, reorder
  seo/
    rulesPage.ts          # The rules guides as static pages, emitted at build
  hub/
    main.ts               # Bootstrap, route dispatch, signed-out routing, online retry
    ageChoice.ts          # The age grade picked before registering, in localStorage
    supabase.ts           # Client (PKCE). Anon key is public, RLS is the boundary
    install.ts            # Offline readiness plus the home screen install offer
    auth.ts               # Sign up/in/out, profile, deletion, validation
    router.ts             # Hash router, plus stillOn() for async guards
    plans.ts              # session_plans CRUD, offline mirror, delete tombstones,
                          # share tokens and the read-only fetch behind them
    favourites.ts         # Starred drills, same local-first shape
    styles.css            # Hub only (imports base.css)
    content/
      types.ts            # Drill/Preset/KitItem, age grades, THEME_MIN_AGE,
                          # THEME_SHORT, RULES_OF_PLAY
      drills.ts           # Pulls the catalogue together, plus filterDrills
      presets.ts          # 30 ready-made sessions, one per theme per age grade
      catalogue/          # 100 drills by theme: warmups, handling, evasion,
                          # gamesense, tackle, breakdown, setpiece
    views/
      agePicker.ts        # First run, before any account. Seeds the age grade
      authView.ts         # Sign in, register, reset, gate reasons, password reveal
      account.ts          # Details, password, sign out, delete. Also the setup form
      catalogue.ts        # Drill list, filters, favourites, drill page
      planner.ts          # Sessions list, reading view, editor, present mode, print sheet
  components/             # Rotation planner only
    form.ts, playerList.ts, results.ts, teamTabs.ts, toast.ts, logo.ts, icons.ts
  app.ts                  # Rotation planner orchestration
  main.ts                 # Rotation planner entry
  __tests__/              # See "Tests worth knowing about" below

index.html                # Marketing homepage. Static, zero JavaScript
planner/index.html        # Rotation planner entry
hub/index.html            # Hub entry, noindex
api/delete-account.ts     # The only server code. Verifies the caller's own JWT
supabase/migrations/      # Numbered, run in order. See supabase/README.md
docs/                     # content-sourcing.md, roadmap.md
```

## Key design decisions

### Fairness algorithm (rotation.ts)

Uses a **fairness debt** model:
- `fairnessDebt = (gamesAvailable * fairRate) - playTimeUnits`
- Players with highest debt (most underplayed) get selected first
- Tie-break: longest since last played

**Two-phase event application:**
- Phase 1: Past games (before currentGame), locked lineups, late+joined players excluded
- Phase 2: Current + future games, fully rebalanced, all available players eligible

**Critical invariant:** Late+joined players must be excluded from Phase 1 (past games they missed) but FULLY eligible in Phase 2 (current and future games). The `gameNumber === currentGame` exclusion was removed because it caused the "permanent bench" bug when advancing games.

### Play time units

- Full game on field = 1.0
- Subbed on mid-game = 0.5
- Subbed off mid-game = 0.5
- On bench = 0.0

### Multi-team state

Each team has independent state (players, plan, events, currentGame). Teams are stored as an array in localStorage under `equalplay_teams`. Legacy single-team data under `equalplay_state` is auto-migrated on first load.

### Coaching hub

#### Content and safety

**Drill content is static data in `src/hub/content/`, not a database.** The service
worker then makes the whole catalogue readable at a wet pitch with no signal, which is
the only place it gets used. Content changes ship as a deploy and get reviewed as a diff.

**Age gating is a safety feature, not a filter.** `THEME_MIN_AGE` in
`src/hub/content/types.ts` records the earliest RFU age grade at which each theme is
legal. Tackle at U9, ruck/maul/scrum at U10 per Regulation 15, no lineout at any
grade here. A drill must never surface for an age group that is not allowed to
do it. Re-check the table
against the live Reg 15 appendices each season; the RFU reissues it annually.

**Age grade claims link out to the RFU.** `RULES_OF_PLAY` in
`hub/content/types.ts` holds one appendix URL per grade, written out rather than
built from a pattern so one broken link can be fixed on its own. Surfaced wherever
the hub asserts what an age grade may do: the age-gate empty state, a drill's facts,
the running order and the account page. Linked, never copied, because the wording is
licensed and Reg 15 is reissued annually.

**Drill copy must be written from scratch.** Drills as methods are not copyrightable, but
the wording and diagrams in any source are and so is a curated compilation's selection
and arrangement. Read widely, never mirror one source's list, write every word ourselves.

**A drill diagram is data, not a picture.** A drill says where things stand in
metres and `hub/content/diagram.ts` renders it at load. Shipping one SVG file per
drill would cost around 210 kB across 100 precache entries. It would also put
the stroke weights, colours and marker sizes into 100 places where they drift.
The renderer owns them once. 99 of the 100 drills carry one, for 10.6 kB gzipped
across the whole hub. The one without is a mobility warm-up whose setup is
"everyone with a bit of space around them", where a box with six dots in it says
less than no picture. `diagram` is optional for exactly that reason.

The catalogue shows them too. A thumbnail beside the title on a phone, where the
list has to stay scannable, becomes the same figure as a picture on top once the
grid has the room. On a card it is `decorative`, because the title says which drill it
is and a coach on a screen reader does not want a hundred set up descriptions
read out between the names. Two conventions the code cannot check. Every drill runs bottom to top, so a
channel runs up the long axis whatever order `space` puts the numbers in. Red is
whoever has the ball or is doing the work, which in a pairs drill means the
thrower rather than an opponent. `.claude/skills/drill-diagram/` has the rest,
plus the authoring loop. Preview at card size before believing any of it.

**The "Safety note" badge is keyed off `drill.safety`, not off contact.** Movement prep
carries a safety note and involves no contact, so labelling it "contact" would be
wrong and would make the badge worthless everywhere else.

**Warm-ups are cool, exercises are warm.** `--color-warmup-*` and
`--color-exercise-*` in `base.css`, used by `.drill-kind` and `.kind-dot` so a
warm-up looks the same in the catalogue, the add panel and the running order. Both
pairs are checked for AA on their own background.

#### Data and offline behaviour

**Everything reaches the database. Offline is a state, not a storage mode.** Both
`hub/plans.ts` and `hub/favourites.ts` write to localStorage synchronously then push,
and nothing lives only on the device. `src/__tests__/plans.test.ts` mocks the client
so the whole thing can be exercised with the server switched off.

**Session plans are written locally first, pushed second.** `stagePlan` is synchronous
and cannot fail; the network push is debounced behind it and flushed on navigation and
on `visibilitychange`. A coach editing a plan on a dead connection must never lose work.
Conflicts are last-write-wins on `updatedAt` and an unsynced local edit always beats a
remote row.

**Starring is local-first too.** `toggleFavourite` in `hub/favourites.ts` is
synchronous and returns the new set, so the star flips with no signal and the push
happens behind it. A drill id sits in `pending` until the server has heard about it,
and on the next sync a pending id keeps its local state while everything else takes
the server's word for it.

**A shared session is read through a function, never through the table.** A coach
sends a link to whoever else takes the age group. The reader is usually signed out,
so RLS has no `auth.uid()` to match them against. A policy loose enough to let a
token through would also let anyone list every shared plan and its `user_id`. So
`shared_plan(token)` in migration `0003` takes the token as an argument, returns at
most one row and writes its columns out so `user_id` can never come back. The token
is the whole permission: null until the author asks for a link. Clearing it takes
every copy of that link out of service. `stagePlan` carries it forward through an
edit, because the editor works in `SessionPlan` and would otherwise drop it, quietly
breaking a link a coach had already sent.

**Deletes carry a tombstone.** A delete that cannot reach the server leaves the id in
`deleted`. `syncPlans` then skips any remote row that is tombstoned. Without it,
deleting a session with no signal un-deletes it, because the row is still on the
server and the next pull cannot tell "never seen" from "deliberately gone". Staging
the same id again cancels the tombstone.

**Offline state is said out loud.** `syncPlans` returns `reachedServer` so the
planner can show a notice when what you are looking at came off the device rather than
the server. Silence would let a coach assume an edit had saved. `retryPending` is
wired to the browser `online` event, which is the moment a touchline edit can leave
the phone.

**Anything crossing back in gets validated.** `isStoredPlan` in `hub/plans.ts` guards
both localStorage and the database. A stale schema or a hand-edited row must not take
the planner down.

**Signing out clears everything belonging to that coach**: cached profile, local plans,
planner module state. Clubs share tablets.

#### Supabase and secrets

**Supabase stores as little as possible.** The coach's name, club and age group live in
`auth.users.raw_user_meta_data`. No `profiles` table, no trigger, no extra policy.
The only table is `session_plans` (`supabase/migrations/`), RLS'd to `auth.uid()`.
Add a `profiles` table only when something needs to query across coaches.

**Account deletion is real.** `api/delete-account.ts` verifies the caller's own JWT and
admin-deletes that user; plans go with them via `on delete cascade`. It has run against
the real project. It is the only server code here, so it is the only thing that can
destroy data: re-verify any change to it against a throwaway account.
`SUPABASE_SERVICE_ROLE_KEY` is server-only. Never give it a `VITE_` prefix.

**Never write `.env.local` from a script or a command.** It holds the real Supabase
credentials. It is gitignored so there is no copy to restore, which means
overwriting it destroys them. To build or preview against throwaway values use `pnpm preview:demo`,
which passes them inline. Same rule for any test harness.

#### Interface

**Both entries link their own stylesheet from their HTML.** Never `import "./x.css"`
from an entry's TypeScript. A JS import gives the browser nothing to hold paint on,
so it puts the bare markup up first, logo at its intrinsic 374px, then styles it
once the module graph lands. `inline-css` in `vite.config.ts` turns both links into a
`<style>` in the head at build, which is why production never showed it and the dev
server did. `nav.test.ts` fails if the import comes back.

**Both entries write their nav into their HTML.** Neither waits on a bundle to
paint the chrome. The hub used to ship an empty `.hub-nav` and fill it once 400 kB
of JavaScript had arrived, so leaving Match day gave you a logo on navy and then a
124px jump. `nav.test.ts` holds both copies to `lib/nav.ts`. The active tab is
still the router's job, because `is-active` only paints a background and so moves
nothing when it lands.

**`.app-shell` names its rows.** Chrome to its content, view takes the slack,
footer at the foot. They are all `auto` otherwise. A grid with `min-height: 100dvh`
then shares the spare height between them, so an empty view swelled the chrome by
156px until the first route rendered. Both entries measure 0px of movement
through boot now, at both widths.

**The shell owns the gutters, so neither entry adds its own.** `--gutter` on
`.app-shell` insets the chrome's contents and the view. The hub used to put side
padding on `body` below 360px as well, which moved the shell instead of what is
in it, so the navy stopped short and every hub route wore a pair of background
gutters the planner did not have. `e2e/hub.spec.ts` measures the chrome against
the viewport at 320px on both entries.

**Both entries use one shell.** `.app-shell`, `.app-chrome` and `.app-view` live in
`src/base.css`, not in `hub/styles.css`, because the match-day planner is the same
product and has to look like it while loading none of the hub's bundle. One markup
shape, two layouts, switched by grid placement. Under 900px it is a phone app with a
navy bar on top. At 900px the same markup becomes a navy rail down the side. Beyond
the shell the hub goes further with the width: `auto-fill` card grids, the planner as two
panes so adding a drill does not scroll you away from the session. A drill page is
shaped like a document with its facts alongside.

**The nav is ordered by when a coach reaches for it.** Drills to find something,
Sessions to build it, Match day on the Sunday. Then the two nobody opens the app
to reach. Guide is an August read. Account goes last, pinned to the foot of the
rail with `margin-top: auto`. Each tab carries an inline icon,
written out in `lib/nav.ts` rather than imported so that module keeps pulling in
nothing. Icon over label on the phone bar: beside the label came to about 450px
across four tabs. Dropping the labels would leave a coach guessing at a cone.

**The phone bar shares its width between the tabs.** They used to size to their
own labels, which fitted four and put five at 340px against a 320px phone. Even
columns fit five with room for a sixth. "Match day" is the only label that ever
needs two lines, so it wraps wherever it will not fit rather than truncating.
The first fix put a breakpoint at 360px for that and left 361px and 362px
rendering "Match da...", so `e2e/hub.spec.ts` sweeps every width from 320 to 480
on both entries rather than sampling one. A breakpoint that has to be right to
the pixel is a breakpoint that is wrong somewhere.

**The guide is hub content, not a marketing page.** `#/guide` and
`#/guide/<age>`, rendered by `hub/views/guide.ts` off `hub/content/guides.ts`.
It shipped as seven static pages under `public/rugby-rules-*` for one commit,
which made Guide the only tab that left the app shell and the only one that
would not open with no signal, since `sw.js` precaches `/hub` rather than each
page. As hub content it is in the bundle the catalogue is already in.

**The guide is set as an article, not as an app screen.** White to the edges via
`#hub-view:has(.guide)`, one centred column, 18px body against the app's 16px,
and Outfit on the headings. It is the only route in the hub that reads rather
than being tapped through, so it gets the room a document gets. Two earlier goes
are worth not repeating: the first had the title at 17.6px with both heading
levels and the body all at 16px, so weight carried the whole hierarchy; the
second kept the app's grey behind it and ran a bar of colour down the side of
whichever grade was yours.

**The index is cards. The card title carries the link colour.** Six grades
laid out as a grid is how somebody picks one. A card gives the whole row a hit
area. Replacing them with bordered rows of body-coloured text was an
over-correction: it took the affordance out with the decoration, so nothing
about the list said it went anywhere. The grade a coach takes is marked by its
edge plus the words in it, never a bar down the side.

`e2e/hub.spec.ts` holds the scale: each level clear of the one under it, a
standfirst never smaller than its body copy, the measure between 45 and 78
characters. That guard has already caught `.guide p` beating `.guide-lede` on
specificity and silently dropping the standfirst back to body size.

**The guide is the one thing in the hub the age gate does not touch.** Every
other route hides what the coach's grade may not do, because handing an U8 a
ruck drill is a safety problem. A guide is the opposite: a coach going up to U10
in September wants to read the U10 page in August, so hiding the grade above
yours hides the thing they came for. It also needs no account and no grade at
all, so `render()` takes it before both checks, the same way a shared session
comes before the age picker.

**A session opens to be read, is edited on purpose and is run on the pitch.**
`#/plan/<id>/run/<n>` is present mode: one block, coaching points at a size you
can read at arm's length, the minutes counting down. The block number is in the
URL, so a phone that locks comes back to the drill actually being run rather
than the top of the plan. The clock keeps a deadline rather than a count,
because a backgrounded tab is throttled and would otherwise come back with
however many ticks the browser felt like delivering. Overrunning counts up and
says so instead of stopping at zero: a block quietly taking twenty minutes when
it was given ten is the thing the feature exists to catch. Each block keeps its
own clock, keyed on the drill and the minutes it had, so stretching a block or
reordering the session does not hand back a stale deadline. Leaving present mode
retires the lot, because checking the running order in the car park at 6:15 must
not open training at 6:30 on a red overrun. Moving between blocks is not leaving,
which is what the map is for.

**A wake lock is held while a block runs, then given back on the way out.** A
screen going dark mid-drill is the one place that is not a small annoyance. A
browser drops the lock whenever the tab is backgrounded, so it is taken again on
return. Two failure modes are already written into the code: a request still in
flight when present mode is left releases what it is handed rather than keeping
it. Only that abandoned case asks again, because Chrome refuses outright
under battery saver, so retrying on every settle spun rejected requests for the
length of the session.

**A drill can go into a session from the drill page.** The planner's own search
used to be the only way in, which meant reading a drill, remembering the title,
going to Sessions and finding it again. Sessions the drill is not legal in are
left out of the picker rather than shown and refused. `addDrillToPlan` checks
the age gate itself as well: a gate that only exists in a render is one new
caller away from not existing. A drill page is never age gated, so the grade
being browsed can be one the drill is not legal at, in both directions. A new
session started from there walks down to the nearest grade that is allowed it
and says on the button which grade that is, because the editor shows a plan's
grade as text with no way to change it.

**Small space is derived, not authored.** `fitsSmallSpace` reads the pitch a
drill's own diagram describes, so it cannot drift from the drill. The box is 25
metres by 15, either orientation. A tighter 20 by 10 was tried first and left a
U7 coach two drills out of eighteen, because tag games need running room while
tackle and ruck work happens in a tight square: emptiest at the grades most
likely to be indoors, offering mostly contact. The catalogue's sizes cluster, so
anything from here up to a full 33 by 18 hall picks the same drills. It is
called small space rather than indoors because it knows nothing about the
surface. A filter should not look like it is blessing a tackle drill on a
wooden floor.

**The offline promise is said out loud.** Everything else in the hub can be
checked by a coach on the spot. Whether it still works at a pitch with no signal
cannot, until the moment it matters. The Account page keys off the service
worker actually controlling the page rather than merely being registered, so a
genuine first visit says not yet instead of promising something untrue.
`beforeinstallprompt` is caught at load because it fires early and is otherwise
gone for the visit. iPhone never fires it at all and is most of this audience,
so rather than sniff a user agent the panel always writes down where a browser
keeps it.

**The chrome is identity plus navigation. Nothing else.** No tagline, no "Coaching
U10" pill. Anything only one entry can say makes the rail change shape depending on
which route you are on, which is what a coach notices. `nav.test.ts` compares the two
chromes structurally so the next tagline fails the build.

**A shared session is a document, not a route into the app.** `#/shared/<token>`
comes before the age picker signed out, because asking which grade somebody coaches
is no answer to a link. It states the grade it was written for and links the RFU's
rules for it, the same as the author's own view. It shows no authoring nudges, only
errors. Its blocks carry no link through to the catalogue either. The reader has no
session of their own to come back to. Nor should a share link hand a U8 coach a
route into U10 drill pages.

It is also the one path by which a drill reaches a grade that is not allowed to do
it, because a coach deliberately sent it. It renders as written rather than being
filtered down to the reader. The reader is told instead: below the plan's grade a
banner says so, above the drills. `content-age-gate.test.ts` pins that, because
`filterDrills` no longer covers every route drill copy takes to a screen.

**A session opens to be read, not edited.** `#/plan/<id>` is the running order at
full size with coaching points on the page and safety expandable in place.
`#/plan/<id>/edit` is the editor. Reading it on a wet Tuesday is the common case and
editing it at the kitchen table is the rare one, so the route reflects that. Creating
or duplicating lands in edit, because you have just made the thing.

**Block controls address `plan.blocks`, not the render order.** `planDrills` drops
blocks whose drill no longer exists, so its array index is not the block's index. It
returns the real one and `blockRow` takes both: `index` for the controls, `position`
for disabling up and down. Getting this wrong made the remove button delete a
different block than the one tapped.

**Async work checks the route before it paints.** `stillOn(name, param?)` in
`hub/router.ts`. Every view renders into the same `#hub-view`, so a slow sync
resolving after the coach has moved on will happily replace whatever is on screen.

**Signed out is a real state, not a wall.** `render()` in `hub/main.ts` sends a coach
with no session to the age picker, then to the catalogue, which takes the grade from
`ageChoice.ts` instead of a profile. Drills are free to read because the catalogue is
what proves the thing is worth an account. What needs an account is anything that has
to persist: saved sessions and starred drills. Those gates route through
`#/join/<reason>`, which renders the register form with a line saying what the coach
was reaching for. Landing on that route with a session is what signing up through it
looks like, so `render()` sends them straight on to the thing they were reaching for
rather than dropping them on the catalogue with nothing to show for it. Never gate a
drill. A locked drill sits in the same list as one the
age gate hid, in the same visual language, which makes a safety feature look like a
paywall.

**Sync calls are guarded on an empty user id.** `syncPlans` and `syncFavourites`
return early rather than firing a request that can only fail. Both report
`reachedServer: true` when they do, because nothing failed. Claiming to be offline
when there is simply nobody signed in is a lie the interface would then repeat.

**A fixed brand colour is never a text colour.** `--color-navy` and `--navy` do not
flip with `prefers-color-scheme`. Using either for text on a surface that does flip
gives navy on dark navy: it shipped at 1.5:1 on a button border, then again at 1.12:1
on the homepage. Text on a themed surface uses `--color-text` or `--text`.
`e2e/contrast.spec.ts` measures both schemes so this stops being a matter of noticing.
It measures hover as well, at both nav widths. A hover rule lifting a tab's colour
to white was written for the tabs you are not on. Over the one you are it painted
white on white, which measured 1:1.

A navy fill on a surface that flips is the same mistake wearing a different hat. It
was in eleven places the moment the app started answering `prefers-color-scheme`:
the active nav tab, the live game stripe, five buttons, two badges, the budget bar
plus the running order's numbers. What replaces it is a pair, `--color-text` on
`--color-bg` or the reverse, which inverts with the scheme rather than staying put.
Navy is only ever chrome. Nothing inside the chrome may flip either: the active tab
is a fixed white pill with fixed navy text, because the bar under it is fixed.

**The app follows the reader's colour scheme.** Tokens flip in `src/base.css`, using
the values `public/pages.css` already chose, so the site and the app are one palette
rather than two takes on it. The static pages had flipped for months while the app
had not, so a coach reading the homepage at night and tapping through got a white
screen in the face. `@media print` puts the light values back, or a team sheet
printed from a dark screen comes out near white on the paper.

**A control needs an edge you can see. It has a token of its own.** WCAG 1.4.11
wants 3:1 on a control's boundary. `--color-border` is 1.25:1 against a panel, which
is a hairline you can see and an edge you cannot, so `--color-control-edge` is what
every input, select, chip, stepper plus add row wears. Cards keep the hairline: a
card is identified by the title inside it rather than by its outline, which is the
exception the success criterion makes. `contrast.spec.ts` checks the drill list and
the session editor, because the editor is where the steppers and the add rows exist
and listing their selectors while standing on the catalogue matched nothing at all.

**Searching waits 140ms before it rebuilds.** Typing rebuilt 73 cards, each carrying
a diagram, on every letter: 127ms a keystroke on a phone throttled to a mid-range
Android. A debounced callback has to read `filters` when it fires rather than closing
over them, or a chip tapped inside the window deselects itself. It has to check the
route as well, like every other async path here. The cards carry `content-visibility` too,
which took a full relayout from 53ms to 9ms at that same throttle, measured on one
warm page. Measuring it across two page loads compares a cold cache with a warm one
and proves nothing.

**Every view has a heading and navigation moves focus to it.** The drill list had
neither, on the tab every coach lands on. Its heading is not shown, because the nav
tab says Drills and carries `aria-current` while the count states it in words, but it
exists so heading navigation finds something. `#hub-view` carries `tabindex="-1"` for
the skip link, so `onRoute` focuses it: a tab tap used to swap the whole view with
nothing said about it and the next Tab restarted from the top of the page.

**`.hub-btn` is worn by anchors as often as by buttons.** So it cannot lean on
anything a `<button>` does for free. An inline box ignores `min-height` and `width`,
which left every link wearing it underlined and 23px tall inside a 48px pill: the
empty session, the shared view, both. The base rule carries the display, the centring
plus the underline reset now. The `-edit` and `-done` variants change only what is
actually different about them. `e2e/hub.spec.ts` measures one.

**A control needs a visible edge.** Secondary buttons sit on `--color-surface` panels,
so a `--color-surface` fill with a `--color-border` edge was 1.19:1 and effectively
invisible. WCAG 1.4.11 wants 3:1 on a control's boundary. The same spec checks it.

**Favourites is a route, not a filter setting.** `#/favourites` is the catalogue
with the stars kept in, rendered by `renderCatalogue` off `currentRoute()` rather
than off anything held in `filters`. So it survives a reload, it can be linked to, a
drill opened from it comes back to it. The join gate gets somewhere to hand a new
coach as well. The Drills tab stays lit, because it is the same list. Signed out, the
bare route is a gate but `#/favourites/<id>` is not: a drill is never gated.

**`filterDrills` stays pure.** The starred set is passed in as `favourites` rather
than read from storage inside it. The age check runs before the star check, so a
starred drill the age grade cannot do is still hidden. There are tests for exactly
that, because it is the obvious way to accidentally build a bypass.

## Copy style

Read `docs/content-sourcing.md` before writing any copy. Enforced mechanically by
`src/__tests__/copy-style.test.ts` across drills, the interface and the static pages.

- British English. Practise is the verb, practice is the noun
- **No em dashes. No Oxford commas. No comma before "and"**
- No phrasing that reads as machine-written. The test holds the ban list
- Voice is a local dad passing on what he has learned. Second person, concrete over
  abstract and no selling the drill to the reader
- Coaching points are fragments under 120 characters with no full stop
- **Prose is not a coaching point.** A coaching point stays clipped because it gets
  read in the rain. Prose does not. In prose: vary the sentence length, use
  contractions, no staccato triplets ("Free. No account. Works offline."), no "X, not
  Y" and no counting before you list. See `docs/content-sourcing.md`, which explains
  why each of those reads as machine-written

## Code style

- British English in UI copy
- Sentence case for labels (not ALL CAPS)
- `esc()` function used for all user-supplied text in innerHTML
- No framework. Vanilla DOM manipulation
- No external CSS frameworks
- System font stack throughout
