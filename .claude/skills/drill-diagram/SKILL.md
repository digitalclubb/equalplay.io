---
name: drill-diagram
description: Draws the set up diagram for a drill in the coaching hub. Use when adding a diagram to a drill that has none, adding a new drill to src/hub/content/catalogue/, or changing how diagrams are drawn. Covers the layout conventions, the authoring loop and the review checklist.
user-invocable: true
argument-hint: "[theme or drill id]"
---

# Drill diagrams

A diagram is data. You write where things stand in metres and
`src/hub/content/diagram.ts` renders it. You never write SVG.

Read `src/hub/content/diagram.ts` for the `Diagram` type before starting. The
renderer owns every stroke weight, colour, radius and dash pattern, so nothing
in this skill is about how it looks. It is about where things go.

## The rules that are not in the code

The renderer cannot check these. They are what makes 104 diagrams look like one
person drew them.

**Every drill runs bottom to top.** `y` increases towards the coach, so the
attack starts at high `y` and works towards `y: 0`. A channel drill runs up the
long axis whatever order the `space` string puts the numbers in: "20 x 10 m"
becomes `space: [10, 20]`. The first pass at this had channel drills running
sideways while everything else ran up the page and it looked wrong the moment
you saw them together.

**Red is whoever has the ball or is doing the work.** `attack` renders in the
primary, `defence` in `currentColor`. In a pairs drill that means the thrower is
`attack` and the catcher is `defence`. In a relay the runner is `attack` and the
queue is `defence`. Nothing about it implies opposition.

**Draw one working group, not the whole session.** "Threes in a line" means draw
one three. Six pairs on the pitch is a smudge at card size. The test caps you at
`players.max` and nothing stops you going far below it.

**Do not set `label` out of habit.** Twenty one of the first hundred needed the
label taking off again, because the generated wording already said exactly what
the picture showed. Read what `describe()` would produce before you write one.
Set `label` when the generated description would mislead. `describe()` says
"N players with the ball, N without" off the colour convention. That is honest
for a game and wrong for a relay, where four runners are drawn red but there is
one ball between them. Five of the handling drills carry a label for this.

**Keep lines clear of the things they join.** A run or a pass that starts inside
a player marker, or lands its arrowhead on top of one, reads as a smudge at card
size. Start about a metre clear and stop about a metre and a half short. This was
the single most common correction when 89 of these were drawn at once.

**Keep the ball about a metre and a half off the nearest player.** Closer and the
two discs merge into one blob on a card. The ball is drawn about the same size as
a player, so it needs the same room.

**Not every drill gets one.** `diagram` is optional. A mobility warm-up whose
setup is "everyone with a bit of space around them" has nothing to draw, and an
empty box with six dots in it is worse than no picture at all. `warmup-ankles-and-knees`
is the one that failed this and has none. If your diagram would fit any drill in
the theme, either find what makes this one different or leave it out.

**Cones are the ones in the kit list, in the places the setup names.** "8 cones"
with "a scoring box in each far corner" means four marking the square and two
marking where each box meets the edge. Work out which eight the coach is
actually putting down rather than spacing eight evenly to make the count.

## Doing it

1. Read the drill's `space`, `equipment`, `players` and `setup`. The setup
   sentence is the diagram. `howItRuns` tells you where the arrows go.
2. Write `diagram: { ... }` under the `space` line. Coordinates in metres.
3. Preview. Do not skip this and do not trust the coordinates in your head:

   ```
   # a throwaway test that writes an html file, then screenshot it
   npx vitest run src/__tests__/_preview.test.ts
   ```

   Render each one at full size **and** at about 130 px, which is card size.
   Things that look fine at 280 px turn to mush at 130. Delete the throwaway
   test afterwards.
4. `pnpm test`. `diagram.test.ts` will tell you if the cone count, the
   dimensions or the bounds disagree with the drill.
5. `pnpm lint`, `pnpm build`, and `pnpm test:e2e` because this is the hub.

## Reviewing one

- Does the picture describe **this** drill, or would it fit any drill in the
  theme? If the second, it is decoration and it is not worth its bytes.
- Does it run bottom to top?
- Cone count against the kit list, and are they in the right places rather than
  merely the right number?
- At 130 px, can you still tell what the drill is?
- Read the `aria-label` out loud. Does it claim a contest the drill has not got?
- Anything overlapping? A ball under a player and an arrowhead on a marker are
  the two that keep happening.
- Is the `label` earning its place, or does it repeat the generated wording?

## What not to do

- Do not write a layout engine. The coordinates are meant to be dumb. A clever
  one would need overriding by the thirtieth drill and you would spend longer
  fighting it than placing dots.
- Do not add a primitive for one drill. `shields` earns its place because
  sixteen drills use a tackle shield. Something one drill needs gets built out
  of the primitives that exist.
- Do not put a second fixed colour in the renderer. One diagram serves both
  colour schemes and `diagram.test.ts` fails the build over it.
- Do not announce a diagram twice. A catalogue card renders it with
  `{ decorative: true }`, because the title beside it already says which drill it
  is. Only the drill page, where the picture carries something the words do not,
  gets the description. A new place that shows one has to decide which it is.
- Do not assume every card has a picture. One drill deliberately has none, so the
  card keeps an empty figure slot to hold the phone layout's left edge and drops
  the reserved band in the grid. Anywhere else showing drills needs the same
  answer for that gap.
