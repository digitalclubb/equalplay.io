# Where this project is

Written down so a new session does not have to reconstruct it. Update it when the answer
changes rather than letting it rot.

Last updated 22 September 2026, after an audit against Search Console. The
answers got a tab of their own the same day. Before
that a session had stopped being something a coach could only take or leave: it
can be swapped drill by drill, fitted to the time they actually have, or built
from nothing on the theme they have been avoiding.
See `docs/one-product.md` for the one-product change that preceded it and which
of its phases are built.

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
| `supabase/migrations/0004_session_runs.sql` applied | done |
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

**Coaching guides for the phases nobody taught the volunteer.** `#/guide/tackling`,
`rucking`, `scrums` and `kicking`, in `hub/content/coaching.ts`, rendered by the
same view and the same blocks as the rules guides beside them. A rules guide answers
"can we ruck yet". These answer "how do I teach eight children to scrummage when I
never packed down myself", which is the question that actually turns up in October.
Each one is a progression in steps, the cues to shout, a table of what going wrong
looks like and what the phase turns into at the grade above, plus the drills that run
each step. Which four exist comes off `THEME_MIN_AGE`: every theme the game lets in
part way through, so handling and evasion get none. Published twice like the rest,
at `/how-to-teach-rugby-<slug>`, since that is a search a coach makes at ten at
night. Researched from the RFU's age grade material plus World Rugby's Tackle Ready,
then written in our own words. The footer says the order to teach it in is ours
rather than the RFU's, because it is.

**The answers, on a tab.** `#/answers`, from `hub/content/questions.ts`. 71 short
answers to what just happened, grouped by what was going on rather than by
grade, with a search box over the lot. A rules guide is the August read and a
coaching guide is how to teach it. This is the car park at ten past eleven: the
ball came out the wrong side of the scrum, the referee gave a scrum to the side
that knocked it forward, somebody has taken a bang on the head. About fifty of
these answers already existed at the foot of a grade page where nobody scrolls.
They are findable now.

Written rather than generated, which was the decision worth recording. An AI
coach in the nav was the shape this started as. It fails three ways here: it
needs signal at a wet pitch, which is the only place the hub gets used; nothing
could hold it to Regulation 15, which is the one claim this product cannot get
wrong; and a chat answer is invisible to the search that brings coaches in.
Revisit only if the search box starts logging questions nobody has written an
answer to. Then write the answers rather than the endpoint.

Not age gated, for the reason the guide is not, so every answer states the
grades it holds for and `questions.test.ts` fails if one does not. Published
twice like everything else, at `/rugby-questions` plus one page per topic.

**Match-day planner.** Unchanged in behaviour. It now uses the shared shell in
`src/base.css`, so it has the same navy bar on a phone, the same rail at 900px and the
same six tabs as the app, while still shipping 13.9 kB gzipped with no Supabase in it.
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

**The grade travels in from the page that knew it.** Every theme page is
written for one age grade. So is every rules page. So are the six
hand-written drills pages. All of them used to hand a coach to a bare
`/hub`, where the first
thing the app did was ask which age group they coach. That is the app
forgetting something it had just been told, at the point in the funnel it can
least afford to. The call to action carries `?age=` now and `takeUrlIntent` in
`hub/main.ts` reads it once at boot. Only ever a seed: a coach who has already
answered keeps their answer, while signed in the profile overwrites it. The
chrome still points at a plain `/hub` on every page, because it belongs to the
product rather than to the page underneath it. A drill page carries nothing,
since a drill spans grades and seeding off `minAge` would set a U12 coach to U7
for reading a warm-up.

**A confirmation email comes back to what the coach was reaching for.**
Registering to keep the session you were reading, then confirming, used to land
you on the drill list. `auth.ts` writes the gate to storage at sign-up and
`landAfterConfirming` in `hub/main.ts` reads it back when a link returns with a
code in it. Deliberately not on `emailRedirectTo`: Supabase matches that address
against an allow list of whole URLs, so a query nobody had added would miss,
fall back to the Site URL and drop the coach on the marketing homepage, which
ships no JavaScript and can never exchange the code. Storage gives up nothing,
because a PKCE code only exchanges in the browser that asked for it and that is
the browser this was written in. An expired link puts its reason in the
fragment, so a fragment that is not a route is left alone for
`reportLinkFailure` to read out. The round trip still wants a throwaway account
and a real inbox. No auth setting changes.

**The ready-made sessions read with no account.** `#/plans` signed out lists the
presets for the grade and `#/preset/<id>` opens one in full, meaning the running
order, the diagrams and what to say when it goes wrong. The gate has always been
on persistence and keeping a session is persistence, but reading one is not.
What a coach without an account used to get was 120 drills and no help ordering
them, which is the half of the job this audience cannot do for itself. The
account is asked for at the foot of the session, next to the button that would
keep it. Signed in nothing changes: the card still takes the session outright.
The preset route is age gated like every other route into the catalogue, since
its id comes off the address bar and the exception a shared link makes does not
cover our own content.

**Search finds the symptom.** `filterDrills` reads `faults` now, so a coach
typing what is happening in front of them lands on the drill for it. That field
is the part written for somebody who has never seen the drill go right. It was
also the one part the search box could not reach.

**A drill goes out as a link.** The share control on a drill page sends the
drill's own public page rather than a hub route. Whoever is being sent it has
no account and has picked no age grade, so the hub would ask which grade they
coach before showing them anything. It is an anchor rather than a button, so a
phone gets its own share sheet while a desktop gets the clipboard. A browser
with neither opens the page, where the address bar has the link.

**The drills teach rather than remind.** Every one of the 120 carries at least
one fault: what it looks like when it is going wrong, plus the one thing to say.
Coaching points assume a coach who has seen the drill go right before. This
audience is a parent who never played. It is the gap the competition fills with
video, which costs money and puts children on camera, so it is words instead.

**What you have covered.** Framed as coverage rather than as a diary, because
nobody keeps a diary. A coach marks a night as run from the session and the
sessions page lists every theme their grade is allowed, worst first: never
coached above coached weeks ago. Handling four Tuesdays running and nothing on
evasion since June is the failure a volunteer actually has. It was invisible.
Local-first like the stars, so the button works at a pitch. `0004` is applied
against the live project, so a second device sees the log. Stores nothing about
a child: a row is a date, a title and a list of themes.

**A session is something to change, not only to take.** Every block carries a
swap, which hands back the next drill of the same kind doing the same sort of
work, legal at the grade and not already in the session. The block keeps its
minutes. Tapping again walks the list. It turns 38 ready-made sessions into as
many nights as a coach has Tuesdays. It is also the fine tuning for everything
else here that hands them a session.

**A session fits the time a coach actually has.** The ready-made ones come at
45, 60 or 75 minutes, because those are the slots a club books. One tap scales
the blocks to whatever is in the minutes box, keeping the shape and leaving the
water breaks where they are. Under rather than over, always, because a plan a
minute over its own length is a warning nobody caused.

**A session can be built rather than picked.** What the presets add to 120
drills is an order, which is a rule rather than a judgement. `buildSession`
writes it down once: a warm-up, the work, a game where they have to use it, on
any grade, any theme and any length. The tile picks the theme the coach has
gone longest without coaching. With nothing logged yet it takes a bit of
everything instead of a theme out of a hat. Held to the same bar as the
hand-picked sessions, which is not one warning on any of them.

**What you have not covered is a way in.** Each row of the list is now
the link to the ready-made session for that theme. It read the gap out and then
sat there, which is the easy half of the problem it was built for.

**The next few weeks.** The same list the other way up. It used to read
backwards, as what had been coached and how long ago. It said nothing at all
until a night had been marked as run. So the coach who most needed it, the one
opening the app in September with a whole term ahead of them, got an empty
panel. Six sessions now, numbered, least covered first, each row the way into
the ready-made session for it. That is what the paid competition sells as a
season planner. Here it is `termPlan` over an order the app already worked out.
No dates: a training night moves for a frozen pitch, half term and a fixture, so
weeks rather than Tuesdays.
With nothing logged the order comes off `THEME_MIN_AGE`, newest phase to the
grade first, which is the same rule the coaching guides use. Alphabetical handed
a U11 coach the ruck they had had for a year while the boot sat fifth.

**Carousel presets.** One per grade, so a coach with helpers starts from the
Sunday shape rather than building it from scratch every week. A preset entry
may hold a list, which is a carousel. Each of the six is one theme at every
station. A station has to be a drill a group of five can run in a corner of a
pitch. U9 is three tackle stations with a grown-up on each, which is how a
volunteer watches every tackle rather than a line of twenty.

**Carousels.** A block can hold stations that run at the same time, one coach on
each, with the groups moving round. That is the Sunday shape: twenty children
and four parents helping is four groups of five rather than twenty children
queueing for a turn. Built in the editor by adding stations to a block, so it is
one item in the running order however many drills are in it. The arithmetic
follows: minutes are per station, the block's length is minutes times stations,
and the kit is added up across the stations because they are all on the grass at
once. Present mode becomes the rotation caller's board, saying which group is at
which station, because in a carousel the coach stays and the children move. The
helpers get the print sheet, one section per station, or the share link, which
renders every station in full. See `CLAUDE.md` for the rest.

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

**The drills are indexed.** Sitemap submitted to Search Console on 7 September
2026, so the 150 new URLs plus the seven rules pages from 27 August are finally
in front of a crawler.

 The catalogue was the best thing here and a search
engine could not read a word of it: the hub is `noindex` and a hash route is one
URL to a crawler however many drills sit behind it. So every drill is published
as its own page at `/rugby-drill-<name>`, gathered by a page per theme per grade
at `/rugby-tackling-drills-u9` and the like, 150 pages generated at build from
`hub/content/` by `src/seo/drillPage.ts`. The whole drill goes out, the faults
included, because what going wrong looks like is the part no competitor has and
the part a coach searching a symptom will land on. The age gate travels with
them: no theme page exists below the grade Regulation 15 allows that work at,
which `drill-pages.test.ts` holds. The sitemap is generated now rather than kept
by hand, since 186 URLs is past what anybody will maintain in a text file.

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
- Catalogue: 120 drills, U7 to U12, filtered by age grade, focus, type and free text
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
2. **A session a coach can put their own aim on.** `Preset.aim` says what a
   ready-made night is for. A session they wrote gets the theme tips instead,
   because an aim would want a column on `session_plans`. Add it when somebody
   asks rather than before.

Instrumentation is live but has no data yet. `planner_to_app` and `register` are the
two custom events, from `src/lib/track.ts`. A season of those answers whether the free
planner actually feeds the app, which `docs/one-product.md` says is the number the
whole shape of the product turns on.

## The competition

Re-read 22 September 2026. Three of these moved since the last look and two
names are new, so the old table was describing a field that had changed.

| | Price | What they have that we do not |
| --- | --- | --- |
| Rugby Coach Weekly | 97p first month, then £9.95/mo | 1,200 drills, video, a Session Builder with a free tier, a U8 to U16 curriculum on the club tier, coach allocation |
| Sportplan | Free tier plus paid | 1,100+ drills, an animator, a season planner, present mode |
| CoachEdge Rugby | Free plans, £5 to £14.99 a pack, £79 club | Season programmes, festival plans, certificates, a parent letter, U6 to U18 plus women's and wheelchair |
| RugbyCoach.AI | Free | Live match tracking, yellow card timers, score sharing, England Rugby fixture import |
| RugbyCoaching.tv | Not published | Video |

Two things changed and both are worth saying plainly.

**Rugby Coach Weekly built a session builder.** Browse, build, share, deliver on
a phone, filtered to an age group, free for three sessions. That is the shape of
our session planner with a bigger library behind it. What it does not do is
refuse to show an U8 coach a ruck drill. Its own marketing does not mention
Regulation 15 anywhere either.

**CoachEdge Rugby says "RFU Kids First & England Rugby 2026 regs" on the tin.**
That is the nearest anybody has come to the claim this product is built on. It
is a shop selling PDF packs rather than an app, so the regulations are a
provenance note on a download rather than a gate in software: nothing stops a
coach opening the U14 pack. Still, the line "not one of them is age grade aware"
has stopped being true and should not be said again.

What survives is narrower and still true. Nobody else **enforces** the age grade
in the product, as opposed to filtering by it or citing it on a cover page. Ours
is the only one where a ruck drill cannot reach an U8 coach through any route,
held there by tests rather than by a content editor remembering.

Volume is still the wrong race. Nobody browses 1,200 drills, which everyone's
ready-made plans quietly admit.

**A season planner is the feature everybody else charges for.** Sportplan,
Rugby Coach Weekly and CoachEdge all sell one. What it actually takes here is
the order `themeCoverage` already worked out, laid out as weeks, which shipped
on 22 September. Ours is shorter than theirs and knows what this coach has
actually run.

**RugbyCoach.AI is the one to watch.** Free, grassroots, match day, England Rugby
fixture import. What it does not do is substitutions or playing time. That is our
`/planner` sitting in the middle of their gap. If they add it, the acquisition
engine this whole shape depends on has a free competitor with fixture data we do
not have.

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
- **Payments and tiers.** Free for good, decided 21 August 2026. See above.
- **Competing on drill count.** 120 a coach can trust beats 3,000 they have to check.
- **A headcount check on a session.** Shipped 4 September 2026, taken out the same
  week. It read a drill's stated group size as a rule and told a coach a block
  would not run, when a coach adapts a drill to whoever turned up without being
  asked. "Needs 6" is a note about the shape of the drill rather than a floor,
  so checking a plan against it was the app being confidently wrong at the one
  moment a coach has no time for it.
- **A magazine or any editorial cadence.** That is Rugby Coach Weekly's business and it
  is a treadmill a volunteer project cannot keep up with.

## Known issues

- **The 172 generated pages are not in the index.** Checked against Search
  Console on 22 September 2026. 186 URLs are in the sitemap, which Google last
  downloaded on 21 September. 17 pages have ever had an impression and every one
  of them is hand-written. A sample of the generated cluster comes back "URL is
  unknown to Google", meaning not crawled rather than crawled and rejected. The
  one exception, `/rugby-passing-drills-u10`, is "Discovered, currently not
  indexed". `/planner` is unknown as well, which is the free tool the funnel
  turns on.
  The cause is almost certainly depth plus authority, not a bug: the homepage
  links three of the six grade pages, a grade page links its theme pages and a
  theme page links its drills, so a drill page is four hops from the front
  door on a domain with 29 clicks a month behind it. A sitemap gets a URL
  discovered. It does not get it crawled.
  What is worth trying, cheapest first: link the answers index and the four
  coaching guides from the homepage, since neither is reachable from it at all
  today; link every grade from the homepage rather than three; then give the
  drills index real links to all 120 drill pages so the deepest page is two hops
  rather than four. None of that is a guarantee. Re-check in Search Console
  rather than assuming it worked.

- **The hub is one chunk and it is 510 kB.** 141 kB gzipped, measured
  22 September 2026, down from 637 kB the same day. The three reading tabs are
  their own chunks now: the guide plus the coaching guides at 92 kB, the answers
  at 33 kB. Both are warmed at idle once the drill list is up, so `sw.js` still
  has them for a pitch with no signal, which is why the guide moved into the
  bundle in the first place. `nav.test.ts` holds all of it: dynamic import only,
  nothing on the boot path touching the content, the warm still there.
  What is left is `@supabase/supabase-js` at about 220 kB, imported statically,
  so a signed-out first visit still downloads the sign-in machinery before a
  drill renders. Making that client lazy means a fast path deciding signed in or
  out without it, which is a change to the one part that must not break, so it
  wants verifying against a real account rather than a stub. The catalogue is
  most of the rest and cannot go anywhere: the drill list is the route a coach
  lands on.
  Measured on a 4x throttled phone at 473 kB, so these numbers want re-taking:
  the chrome painted at 116ms because both entries write their nav and
  stylesheet into the document, while the drill list arrived at 514ms on 4G and
  4.5s on slow 3G. The service worker means only the first visit pays.

- **A shared link needs signal the first time.** It was never the reader's plan to hold
  on their device, so there is nothing to cache. The view says so rather than looking
  broken.
- **A stale second device can revoke a live link.** `share_token` is last-write-wins
  like the rest of the row, so a tablet holding an unsynced edit from before the coach
  shared will push null over the token. Marked `ponytail:` in `plans.ts`. The fix is
  the token getting its own row, which is not worth it yet.
- The skip link leaves `#hub-view` in the URL, so a reload lands on Drills rather than the
  view you were on. Cosmetic.
- `e2e/contrast.spec.ts` covers the homepage, the planner, the signed-out hub
  and, since 22 September, the sessions page. The stub the non-text sweep uses
  was always there; the text sweep simply never reached for it. Present mode and
  the Account page's device panel are still unmeasured. The one fixed colour
  either of them uses for text is `--color-danger` on `--color-bg` at roughly
  4.6:1, checked by hand rather than by machine.
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
- The drill copy is published in full to search, faults included, decided 7 September
  2026. Every word of it was written from scratch, so the copyright risk runs the other
  way. `/hub` itself stays `noindex`: it is a hash router, so indexing it buys one thin
  page rather than 120
- The coach's profile lives in auth metadata rather than a `profiles` table, because
  nothing security sensitive keys off it
- Separate Vite entries rather than one app, so `@supabase/supabase-js` never lands in the
  rotation planner's bundle
- The age gate is enforced by tests, not by discipline
- Reading a session is the default, editing is the detour
