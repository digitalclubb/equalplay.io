# One product, not two

Decided 18 August 2026. Phases 1 to 3 are built. Phase 4 is not.

## Status

| | |
| --- | --- |
| Phase 1, one shell | Done. `src/lib/nav.ts`, one manifest, two analytics events |
| Phase 2, signed out is a real state | Done. Age picker, free catalogue, sync guarded |
| Phase 3, the upsell moments | Done bar one, see below |
| Phase 4, build before registering | Not started. Deliberate, see the phase |

The fourth upsell moment, adding a drill to a session from the drill page, is not
built. It was already ruled out in `docs/roadmap.md` known issues as a deliberate
choice, so it stays ruled out rather than being reopened here.

Marketing copy landed after phase 2 rather than during phase 1, because writing
"free to browse without an account" before that was true would have been a lie.

## The decision

Equal Play is one product with one identity, one home screen icon and one call to
action. The coaching hub is the product. The rotation planner is the free part of it
rather than a separate free app that links to it.

The trigger was the project owner, who coaches the U10s this was built for, finding
the marketing site confusing. Two apps, two manifests, two headers, two things to
choose between before you know what either does.

## What stays split and why

One product is a decision about what a coach sees. It is not a decision about how
many HTML files the build emits. Those come apart cleanly, so keep them apart.

`/planner` keeps its own Vite entry. Measured from the current build:

| | raw | gzipped |
| --- | --- | --- |
| planner bundle | 48.17 kB | 13.60 kB |
| hub bundle | 363.53 kB | 98.04 kB |

`src/hub/supabase.ts` calls `createClient` at module load and `src/hub/main.ts`
imports the chain that reaches it, so anything served from the hub entry carries
`@supabase/supabase-js` whether or not a coach ever signs in. Folding the planner in
makes the app's only indexed page seven times heavier. It also loses the static header
in `planner/index.html` that paints before the bundle arrives, because the page would
become a route rather than a document.

So: same shell, same navigation, same manifest, two entries. No coach can tell.

## What a coach sees

Signed out, on either entry:

1. **Pick your age group.** First run only, stored locally. It puts the safety story
   on screen inside ten seconds, before anybody has registered. None of the
   competition does this.
2. **The whole catalogue for that grade.** Browsable, searchable, drill pages
   readable. Nothing locked.
3. **The rotation planner.** Unchanged, free, no account, nothing about a child
   leaving the phone.

Signed in, the same thing plus Sessions, favourites and sync.

## The gates

Gate persistence, never content.

| Action | Signed out | Why |
| --- | --- | --- |
| Browse drills for your grade | Free | It is the proof the product is worth an account |
| Rotation planner | Free, always | It is the acquisition engine and the privacy proof |
| Star a drill | Register | A favourite is per coach and has to persist |
| Keep a session | Register | It has to survive the phone |

A locked drill would sit in the same list as a drill hidden by the age gate, in the
same visual language, with no way for a coach to tell which is which. `CLAUDE.md`
calls the age gate a safety feature rather than a filter. `.impeccable.md` says it is
never presented as a preference. A paywall beside it makes it look like one. This is
the one part of the original idea that should not be built.

Upsell moments, all at the point where a coach has just done the work:

- End of a match day in the planner, once the per-child totals are on screen
- Tapping the star on a drill
- Opening Sessions
- "Add to a session" from a drill page

## Work, in order

### Phase 1. One shell

- `src/lib/nav.ts`: the nav items and their render, in one place, importing nothing.
  Match day is the only one of the five that is a document of its own
  from `supabase.js`. Both entries use it. The planner renders it statically, so the
  planner page still ships no auth code.
- Same navigation on both entries, whatever the sign-in state. Tapping Sessions
  while signed out lands on the register prompt, which is honest and costs nothing.
  Reading the session to decide what to draw would drag Supabase onto the planner
  page, or mean guessing at the `sb-<ref>-auth-token` key, which is fragile.
- One manifest. Delete `public/hub-manifest.json`, drop `"scope": "/hub"`, set
  `start_url` to the app. The known issues list in `docs/roadmap.md` records the
  two-manifest split as deliberate, so that note goes with it. Scope then defaults
  to `/`, which pulls the marketing homepage in as well. Harmless, because
  `start_url` decides what actually opens.
- Marketing copy repositioned: the hub is the product, one call to action, the
  planner described as the free part rather than a separate thing.
- Two custom analytics events, because the whole point of this is a funnel and
  there is currently no way to see one. A planner-to-app event plus a registration
  event. Roughly ten lines. Without them phase 3 cannot be judged.

**Done when** both entries look like the same app and there is one icon on a home
screen.

### Phase 2. Signed out is a real state

- `render()` in `src/hub/main.ts` currently returns `renderAuth` whenever
  `!signedIn`. That wall moves so catalogue and planner routes render without a
  session.
- Age group when signed out: a local key, seeded by the picker, passed into
  `renderCatalogue(container, defaultAge, userId, ...)`, which already takes it as
  an argument. On registration it prefills the form.
- Dropping that wall weakens nothing. Row level security is the boundary rather than
  the view layer. Every row of `session_plans` is scoped to `auth.uid()` in
  `supabase/migrations/0001_session_plans.sql`, so a signed-out coach reaching a
  route simply has no rows.
- Guard the sync calls. `syncFavourites` and `syncPlans` both hit Supabase
  unconditionally, so a signed-out catalogue would fire a pointless request on every
  render. Both take `userId`, so an empty one is the signal to skip.
- Extend `src/__tests__/catalogue-view.test.ts`. It exists because catalogue filter
  state sits one layer above `filterDrills` and can defeat the age gate without
  `content-age-gate.test.ts` noticing. A signed-out age choice is another layer on
  exactly that seam, so it needs the same treatment.

**Done when** a coach who has never registered can pick U8 and read the whole U8
catalogue, with no test anywhere letting a ruck drill reach them.

### Phase 3. The upsell moments

The four listed above. Each is a small component plus a register prompt that returns
you to where you were.

**Done when** every gate explains what registering gets you at the moment the coach
wanted it, rather than in the abstract.

### Phase 4, optional. Build a session before registering

The local-first plumbing in `plans.ts` already writes locally first and pushes
behind it, so a signed-out coach could build a session under an anonymous id and
migrate it on registration. "You have built it, register to keep it" converts better
than a wall. The cost is an anonymous id plus a migration path on first sign-in, so
it is worth doing only once phases 1 to 3 are proving themselves.

## Risks worth naming

**The e2e suite assumes the split.** `signedIn()` in `e2e/hub.spec.ts` waits for
`.hub-tab` to confirm sign-in. Once the nav renders signed out, that selector
resolves immediately and the helper stops proving anything while still passing. It
needs a different sentinel. Fifty-one of the fifty-three hub tests go through it.

**The privacy line gets harder to say.** Today "no account, nothing about a child
leaves your phone" is provable because the planner cannot phone home. Inside an app
you might be signed into, it becomes "even signed in, no player name is ever stored",
which is still true, `session_plans` holds drill ids. It is a sentence that needs
writing carefully rather than a fact you can point at.

**A signed-out coach can pick any age group.** So can a signed-in one, on the account
page, so this is not a regression. Worth saying out loud because the age gate guards
against getting it wrong by accident rather than against somebody choosing to lie.

**Naming.** `/hub` stops matching what the thing is once the hub is the whole
product. Renaming to `/app` costs redirects and buys clarity nobody outside the
codebase sees, so leave it. Revisit if the copy keeps tripping over it.

## Not doing yet

**Indexing the catalogue.** Phase 2 makes the drill catalogue publicly readable,
which is most of the work of the public drill catalogue the roadmap rules out of
scope. Keep `noindex` on the app for now. One change at a time. Indexing is its
own decision with its own copyright and content questions.

**Lazy Supabase.** Worth doing on its own merits, but it does not rescue the merged
bundle idea, because the static header in `planner/index.html` is the other half of
why that page is fast.
