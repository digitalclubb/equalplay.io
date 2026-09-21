// ---- Coaching hub content model ----
//
// Drill content is authored as typed data in this directory and ships in the
// bundle. It is deliberately not in a database: the service worker then makes
// the whole catalogue readable at a wet training pitch with no signal, which is
// the only place it actually gets used.

import type { Diagram } from "./diagram.js";

/**
 * RFU age grades covered by the hub. Order matters. Comparisons use the index,
 * so keep this ascending.
 */
export const AGE_GROUPS = ["u7", "u8", "u9", "u10", "u11", "u12"] as const;
export type AgeGroup = (typeof AGE_GROUPS)[number];

export const AGE_GROUP_LABELS: Record<AgeGroup, string> = {
  u7: "U7",
  u8: "U8",
  u9: "U9",
  u10: "U10",
  u11: "U11",
  u12: "U12",
};

/**
 * The RFU's own rules of play for each grade, one appendix per age group.
 *
 * Linked rather than reproduced. The wording is theirs and licensed for personal
 * non-commercial use. Reg 15 is also reissued every year, so a copy here would be
 * both a licence problem and out of date by August. A link is neither.
 *
 * Written out rather than built from a pattern so a single broken one can be fixed
 * without touching the others. All six checked as live.
 */
const RFU_BASE =
  "https://www.englandrugby.com/run/rules-governance/rfu-rules-and-regulations/regulation-15-age-grade-rugby";

export const RULES_OF_PLAY: Record<AgeGroup, string> = {
  u7: `${RFU_BASE}/regulation-15-appendix-1-u7-rules-of-play`,
  u8: `${RFU_BASE}/regulation-15-appendix-2-u8-rules-of-play`,
  u9: `${RFU_BASE}/regulation-15-appendix-3-u9-rules-of-play`,
  u10: `${RFU_BASE}/regulation-15-appendix-4-u10-rules-of-play`,
  u11: `${RFU_BASE}/regulation-15-appendix-5-u11-rules-of-play`,
  u12: `${RFU_BASE}/regulation-15-appendix-6-u12-rules-of-play`,
};

/** The index of every age group's rules, for when a coach wants the lot. */
export const REGULATION_15_URL = RFU_BASE;

/**
 * The RFU's concussion education, from the drills where a head can get hit.
 *
 * Every contact drill here carries a safety note, which says what to watch for
 * during the drill. It says nothing about what to do afterwards. That is the
 * part with a national programme behind it. Linked rather than summarised,
 * for the same reason Reg 15 is.
 */
export const HEADCASE_URL = "https://www.englandrugby.com/run/player-welfare/headcase";

/**
 * The RFU's age grade contact training, match load plus recovery guidance.
 *
 * Linked from every coaching guide, because those are the pages that say how
 * to teach a tackle and a scrum without saying how much of it a child should
 * be doing in a week. That number is the RFU's to set rather than ours, it
 * moves every few seasons, then getting it wrong is the kind of wrong that
 * hurts somebody.
 */
export const CONTACT_GUIDANCE_URL =
  "https://www.englandrugby.com/run/coaching/coach-resources/contact-guidance";

/** Everything the RFU publishes for age grade coaches, from the guide index. */
export const AGE_GRADE_RESOURCES_URL =
  "https://www.englandrugby.com/run/coaching/age-grade-rugby/resources";

/**
 * The RFU's own explainer for the Half Game Rule.
 *
 * The floor on playing time, which unlike the daily maximum is the same at
 * every age grade. Written out here for the same reason the appendices are: it
 * is linked from the guide, from the static rules pages plus the match-day
 * pages, so one broken link stays one edit. `landing-pages.test.ts` holds the
 * hand-written pages to this value.
 */
export const HALF_GAME_RULE_URL =
  "https://help.rfu.com/support/solutions/articles/103000094875-what-is-the-half-game-rule-";

/**
 * When the age grade claims in here were last read against the RFU's own
 * appendices, plus the season they were read for.
 *
 * Reg 15 is reissued every summer, so a claim with no date on it is one nobody
 * can tell has gone stale, us included. Said out loud wherever the rules are
 * stated at length, which today means the guide plus the static pages it is
 * published as. Move both fields together, after actually re-reading the six
 * appendices, or the date is worse than not having one. `guides.test.ts` fails
 * once this is over a season old, so it cannot rot quietly.
 */
export const RULES_CHECKED = { season: "2026/27", on: "August 2026" } as const;

/** One sentence, minus its full stop, for a page footer to end with. */
export const rulesCheckedPhrase = (): string =>
  `Read against the RFU's ${RULES_CHECKED.season} appendices in ${RULES_CHECKED.on}`;

/** True when `age` is the same grade as `floor` or older. */
export function ageAtLeast(age: AgeGroup, floor: AgeGroup): boolean {
  return AGE_GROUPS.indexOf(age) >= AGE_GROUPS.indexOf(floor);
}

export function isAgeGroup(value: unknown): value is AgeGroup {
  return typeof value === "string" && (AGE_GROUPS as readonly string[]).includes(value);
}

/**
 * True for a real theme key, so a `THEME_*` table can be indexed by something
 * that came out of storage.
 *
 * `isStoredPlan` does not check `plan.theme`. Rejecting a whole session over a
 * bad badge would lose a coach their work, so the plan is kept and the theme is
 * checked at the point it is used. A bare `plan.theme ? TABLE[plan.theme] : x`
 * is not that check: these tables are object literals, so "constructor" and
 * "toString" come back as inherited functions rather than undefined, sail past
 * a truthy test, then throw on `.map` or inside `esc`. Same trap as the
 * `hasOwnProperty` over `in` rule on the confirmation gate.
 */
export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

export const THEMES = [
  "handling",
  "evasion",
  "tackle",
  "breakdown",
  "setpiece",
  "kicking",
  "gamesense",
] as const;
export type Theme = (typeof THEMES)[number];

/**
 * Short forms for filter chips. The full labels are right on a drill page where
 * there is room to be descriptive. In a scrolling chip row they mean only one and
 * a half chips fit on a small phone.
 *
 * `setpiece` is the exception that keeps its full label. "Set piece" is shorter
 * but says lineout to anybody who has played. There is no lineout at any grade
 * here, so the chip promised something the eight drills behind it cannot hold.
 * See `THEME_MIN_AGE` for why.
 */
export const THEME_SHORT: Record<Theme, string> = {
  handling: "Handling",
  evasion: "Evasion",
  tackle: "Tackle",
  breakdown: "Ruck and maul",
  setpiece: "Scrum and restarts",
  kicking: "Kicking",
  gamesense: "Game sense",
};

export const THEME_LABELS: Record<Theme, string> = {
  handling: "Handling and passing",
  evasion: "Evasion and footwork",
  tackle: "Tackle",
  breakdown: "Ruck and maul",
  setpiece: "Scrum and restarts",
  kicking: "Kicking and catching",
  gamesense: "Game sense",
};

/**
 * The handful of things worth saying all night, whatever drill is running.
 *
 * A drill's coaching points belong to that drill. They tell a coach what to
 * watch for in the ten minutes it runs, then they are gone. What a volunteer
 * is missing is the layer above: the thing that is true of every tackle in the
 * session, so they have something to say while the squad is doing a drill they
 * have never seen before. A coach holding three ideas coaches better than one
 * trying to hold thirty.
 *
 * Written as coaching points rather than as prose, because that is what they
 * are. Fragments, no full stop, short enough to read in the rain. They sit in
 * the head of a session on that theme and at the top of the theme's own page.
 *
 * Nothing here may claim something the grade cannot do. `THEME_MIN_AGE` sets
 * the floor, so a tip only has to hold from that grade up. Note that nobody
 * pushes in a scrum at any grade the hub covers, so the set piece tips are
 * about shape rather than about a shove.
 */
export const THEME_TIPS: Record<Theme, string[]> = {
  handling: [
    "Hands out early, fingers spread, before the ball gets near you",
    "Pass in front of them so they run onto it",
    "Eyes on where it is going, never on the ball in your hands",
  ],
  evasion: [
    "Head up, pick the gap before you get to it",
    "Take them on at the shoulder, never straight at the middle",
    "One clear step then go, dancing about gets caught",
  ],
  tackle: [
    "Go forward into it, never backwards or standing still",
    "Head to the side of them, never across the front",
    "Both arms wrapped then squeeze, a shove is not a tackle",
  ],
  breakdown: [
    "Stay on your feet, going off them gives the ball away",
    "Come in through the gate, from behind your own feet",
    "Place it long with both hands, away from the other lot",
  ],
  setpiece: [
    "Flat back and head up, even though nobody is pushing",
    "Grip the shirt before it moves, never after",
    "Free pass goes backwards off both hands, nobody moves until it has gone",
  ],
  kicking: [
    "Head down over the ball, look up once it has gone",
    "Laces through it, never the toe end",
    "Watch it all the way into your hands before you start running",
  ],
  gamesense: [
    "Look up before the ball arrives rather than after",
    "Talk to each other, the quiet team loses the ball",
    "Support means being somewhere they can actually pass to",
  ],
};

/**
 * The earliest RFU age grade at which each theme is legal to coach.
 *
 * Source: RFU Regulation 15 rules of play, checked August 2026. Tackling arrives
 * at U9. Rucks, mauls and the uncontested three-player scrum arrive at U10.
 * Kicking arrives at U11, after four seasons where a boot near the ball is a
 * penalty. There is no lineout at any grade the hub covers: touch restarts with
 * a free pass through U13 and the uncontested lineout arrives at U14. Reg 15 is
 * reissued every year. Re-check these against the live appendices each season.
 *
 * `content-age-gate.test.ts` enforces this table against every drill. It is the
 * check that stops the catalogue offering rucking practice to seven-year-olds.
 */
export const THEME_MIN_AGE: Record<Theme, AgeGroup> = {
  handling: "u7",
  evasion: "u7",
  gamesense: "u7",
  tackle: "u9",
  breakdown: "u10",
  setpiece: "u10",
  kicking: "u11",
};

export type DrillKind = "warmup" | "exercise";

/**
 * A piece of kit. Structured rather than free text so a session plan can answer
 * "what do I put in the bag" with one line per item. Three drills needing 6, 4
 * and 8 cones means pack 8, not three separate entries.
 *
 * `item` is singular and canonical ("cone", "ball", "tackle shield"); the plural
 * is the singular plus an s, which holds for every piece of rugby kit so far.
 */
export interface KitItem {
  item: string;
  qty: number;
  /** `qty` scales with the group rather than being an absolute count. */
  per?: "pair" | "player";
}

export function kitLabel(kit: KitItem): string {
  const noun = kit.qty === 1 ? kit.item : `${kit.item}s`;
  if (!kit.per) return `${kit.qty} ${noun}`;
  return `${kit.qty} ${noun} per ${kit.per}`;
}

/**
 * Collapses a plan's kit into one requirement per item.
 *
 * A per-player requirement always outweighs a per-pair one and either outweighs
 * any absolute count, because they scale with however many players turn up.
 * Absolute counts take the largest, never the sum, because one block follows
 * another and the same cones go back out. Stations inside a carousel run at the
 * same time and are added up first by `sumKit`, then handed to this.
 */
/**
 * How specific a requirement is. A "per player" count cannot be compared with a
 * flat one, so the more specific always wins rather than the two being reckoned
 * against each other.
 */
const kitRank = (kit: KitItem): number => (kit.per === "player" ? 2 : kit.per === "pair" ? 1 : 0);

export function mergeKit(items: KitItem[]): KitItem[] {
  const merged = new Map<string, KitItem>();

  for (const kit of items) {
    const held = merged.get(kit.item);
    if (!held) {
      merged.set(kit.item, kit);
      continue;
    }
    if (kitRank(kit) > kitRank(held) || (kitRank(kit) === kitRank(held) && kit.qty > held.qty)) {
      merged.set(kit.item, kit);
    }
  }

  return [...merged.values()];
}

/**
 * Kit for things happening at the same time, added up rather than reused.
 *
 * `mergeKit` keeps the largest requirement, which is right for blocks running
 * one after another: the same eight cones go back out for the next drill. A
 * carousel is the opposite. Four stations run at once, so four sets of cones
 * are on the grass at once. A coach who packed for the biggest station arrives
 * three sets short with twenty children waiting.
 *
 * Only counts in the same unit are added. A "per player" requirement still
 * beats a "per pair" one and both beat a flat count, the same ranking
 * `mergeKit` uses, because two of those cannot be added at all.
 */
export function sumKit(items: KitItem[]): KitItem[] {
  const summed = new Map<string, KitItem>();

  for (const kit of items) {
    const held = summed.get(kit.item);
    if (!held) {
      summed.set(kit.item, kit);
      continue;
    }
    if (kitRank(kit) > kitRank(held)) summed.set(kit.item, kit);
    else if (kitRank(kit) === kitRank(held)) {
      summed.set(kit.item, { ...held, qty: held.qty + kit.qty });
    }
  }

  return [...summed.values()];
}

export interface Drill {
  /** Stable slug. Saved session plans reference it, so never rename one. */
  id: string;
  title: string;
  kind: DrillKind;
  themes: Theme[];
  /** Earliest age grade this is legal and appropriate for. */
  minAge: AgeGroup;
  /** Set only where a drill stops being useful, e.g. tag-specific work. */
  maxAge?: AgeGroup;
  /** Suggested duration; a plan block can override it. */
  minutes: number;
  players: { min: number; max?: number };
  /** Free text, e.g. "15 × 15 m". */
  space: string;
  /** Aggregated into a single kit list per session plan. See mergeKit. */
  equipment: KitItem[];
  setup: string;
  howItRuns: string;
  coachingPoints: string[];
  progressions?: string[];
  regressions?: string[];
  /**
   * What it looks like when it is going wrong, plus the one thing to say.
   *
   * Coaching points tell a coach what should be happening. They are reminders,
   * and a reminder only works for somebody who has seen the drill go right
   * before. Most of this audience has not: they are a parent who never played,
   * running the age group because nobody else volunteered. They read "keep the
   * line flat", watch ten children, then genuinely cannot tell which of them is
   * flat.
   *
   * `looks` has to be spottable from the touchline by somebody who does not
   * know the game. Not "poor body position", which is the same problem in
   * fewer words. `say` is one instruction to give, in the words a coach would
   * actually use.
   *
   * This is the part every competitor buys with video. Video costs money and
   * puts children on camera, so it is written instead, which means it has to be
   * more precise than a picture would need to be. A vague fault is worse than
   * no fault: it fills the space the useful one would have gone in.
   */
  faults?: { looks: string; say: string }[];
  /** Contact drills only. */
  safety?: string;
  /**
   * Set where the drill needs a forgiving surface, so it can be filtered out
   * when the pitch is baked hard or frozen.
   *
   * True of a drill where somebody goes to ground, which includes working from
   * the knees. True as well where a collision with a player or a shield could
   * put them there. Not true of a drill that only asks a child to bend down, to
   * sit or to crouch. `content-age-gate.test.ts` holds every tackle drill to it,
   * because a tackle ends on the floor at every grade and in every variation.
   * Ruck work is the same bar one warm-up that is a walk down a line of cones.
   */
  softGround?: true;
  /** Where everything stands, in metres. Rendered by `diagram.ts`. */
  diagram?: Diagram;
}

/**
 * True when a drill is legal and appropriate for this age grade. Lives here
 * rather than beside the catalogue so `src/logic/` can reach it without
 * depending on the content itself.
 */
export function isAvailableAt(drill: Drill, age: AgeGroup): boolean {
  if (!ageAtLeast(age, drill.minAge)) return false;
  return !drill.maxAge || AGE_GROUPS.indexOf(age) <= AGE_GROUPS.indexOf(drill.maxAge);
}

export interface Preset {
  id: string;
  title: string;
  /**
   * What tonight is for, in one sentence a parent who never played can act on.
   *
   * A title plus a running order tells somebody what they will be doing without
   * telling them what they are trying to get out of it. "Hands and space" is
   * five drills to a coach who has watched a session go well. To everybody else
   * it is five drills. The aim is what they read on the card while picking, so
   * it says what the squad should look like by the end rather than selling the
   * session back to them.
   *
   * Prose, so it takes a full stop. `copy-style.test.ts` holds it to the same
   * house style as everything else a coach reads.
   */
  aim: string;
  ageGroup: AgeGroup;
  theme: Theme;
  sessionMinutes: number;
  /** Curated order: arrival, activation, skill, conditioned game. */
  drillIds: string[];
}
