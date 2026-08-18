# How drill content gets written

Read this before adding a single drill.

## The legal position

A drill is a way of moving bodies around a pitch. Nobody owns that. What people do
own is the wording they used to describe it, the diagrams they drew and the
particular selection and running order of the drills they chose to publish.

So three rules follow and they are not negotiable:

1. **Read widely, never from one place.** Working from a single source and changing
   the words is how you end up copying its selection and arrangement, which is
   protected even when every sentence is your own.
2. **Every word is ours.** No paraphrasing with a thesaurus. Understand the drill,
   shut the source, then write it the way you would explain it to another dad on a
   Sunday morning.
3. **No diagrams, photos or video lifted from anywhere.** If we draw one, we draw it
   from scratch.

RFU, WRU and World Rugby material is free to read. It is licensed for personal
non-commercial use, so it is inspiration only. That includes the Activate warm-up
programme: the shape of it and the ideas in it are fine, the manual's sentences are
not.

## The age data is different

Numbers of players, pitch sizes, ball sizes and which bits of contact are allowed at
which age grade are facts out of Regulation 15. Facts are not copyrightable and we
should state them plainly.

We also link to the RFU's own rules of play for every age grade, from
`RULES_OF_PLAY` in `src/hub/content/types.ts`. Linking is the whole point: their
wording stays theirs, the coach gets the current version rather than our snapshot,
and every claim the hub makes about what a grade may do is one tap from its source.
Never paste those pages in.

Two things to keep straight:

- Record which season the figures came from. `THEME_MIN_AGE` in
  `src/hub/content/types.ts` says 2025-26.
- The RFU reissues Regulation 15 every year. Re-check the appendices each August,
  before the season starts, not after somebody notices.

## House style

Written like a local dad passing on what he has learned, because that is what it is.

- British English. Practise is the verb, practice is the noun.
- No Oxford commas. No comma before "and". No em dashes.
- Second person. "Stick four cones down", not "the coach should position four cones".
- Concrete over abstract. "Eight to ten goes each" beats "sufficient repetitions".
- No selling it. A drill does not need to be described as fun, engaging or effective.
  If it is any good the coach will work that out on Tuesday night.
- Say why, once, where the why is not obvious. Then stop.

## Prose is not a coaching point

A coaching point gets read one-handed, in the rain, with eighteen children waiting, so
it stays clipped. Prose gets read on a sofa. Everything below applies to prose only,
meaning the homepage, the static pages under `public/` and the hub explaining itself.
Drill copy carries on exactly as it is.

- **Vary the sentence length.** Three clipped sentences in a row is the loudest tell
  that a machine wrote something, however true each one is. "Free. No account. Works
  offline." reads as generated. "Free to use with no account, then it keeps working
  once you have opened it" reads as somebody talking.
- **No staccato triplets.** "No sign-up, no download, no cost." That shape is filler
  wearing the clothes of emphasis. It is the default closer of every language model
  going.
- **No "X, not Y".** Negative parallelism, as in "the age grade is enforced, not
  suggested" or "it is not a filter, it is a gate". Say the positive thing once.
- **Contractions are wanted.** "There's no roster" rather than "There is no
  roster". Without them the whole site reads like a form letter. This is the single
  biggest thing separating the voice we want from the voice we had.
- **No counting before you list.** "Two tools", "three things that matter". Just say
  them.
- Anaphora is the same trap as the triplet. "One keeps game time even. One gets
  Tuesday planned." Two sentences built to the same template give the game away.

`src/__tests__/copy-style.test.ts` enforces the mechanical half of the house style: em
dashes, commas before "and", Americanisms and a ban list of phrasing that reads as
machine-written. It cannot enforce rhythm or voice. That part is on you.

## What every drill needs

- A safety note if there is any contact in it. The test will fail without one.
- Coaching points short enough to read while eighteen children wait, so under 120
  characters, written as fragments with no full stop.
- A `minAge` no lower than the floor for every theme it claims.
- A stable `id`. Saved session plans point at it, so renaming one breaks somebody's
  Tuesday. Never rename, only add.

## How a ready-made session gets built

A preset is a running order. A running order is a compilation, so the same rule applies
as to the words: read around, then build it ourselves out of our own drills.
The shape below is not anybody's list. It is what the RFU's own coaching material,
the county age grade pages and the coaching press all describe in slightly different
words, which is to say it is the ordinary shape of a Tuesday.

- Something to do the moment they arrive, then movement prep, then the skill, then a
  game where the skill is the thing that wins it.
- One focus. A session that covers three things covers none of them.
- It ends with a game. Every time. A session ending on a drill ends on the coach
  talking and eighteen children going cold.
- It fills the time it claims, allowing for the water break `fromPreset` drops in the
  middle. Nothing opens saying "22 minutes still to fill".
- Every drill in it is legal at that grade. That one is a safety matter.
  `content-age-gate.test.ts` will not let it through otherwise.

One session per theme per age grade, so a coach who opens the planner at U10 finds a
rucking night, a scrum night, a tackle night, a handling night, a beat-your-man night
and a match week. `sessionPlan.test.ts` builds all thirty into real plans and fails if
any of them raises a single warning.

Ages move at the pace of the regulation, not our own: the tag grades get games and
hands, tackling appears at U9, ruck and scrum at U10, the lineout at U12.

## Where things live

```
src/hub/content/
  types.ts              the model, age grades, THEME_MIN_AGE
  drills.ts             pulls the catalogue together, plus filtering
  presets.ts            curated sessions
  catalogue/
    warmups.ts          every warm-up, all age grades
    handling.ts         passing, catching, ball presentation
    evasion.ts          footwork, finding space, tag
    gamesense.ts        conditioned games, decision making
    tackle.ts           U9 and up
    breakdown.ts        ruck and maul, U10 and up
    setpiece.ts         scrum U10 and up, lineout U12 and up
```
