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

export const THEMES = [
  "handling",
  "evasion",
  "tackle",
  "breakdown",
  "setpiece",
  "gamesense",
] as const;
export type Theme = (typeof THEMES)[number];

/**
 * Short forms for filter chips. The full labels are right on a drill page where
 * there is room to be descriptive. In a scrolling chip row they mean only one and
 * a half chips fit on a small phone.
 */
export const THEME_SHORT: Record<Theme, string> = {
  handling: "Handling",
  evasion: "Evasion",
  tackle: "Tackle",
  breakdown: "Ruck and maul",
  setpiece: "Set piece",
  gamesense: "Game sense",
};

export const THEME_LABELS: Record<Theme, string> = {
  handling: "Handling and passing",
  evasion: "Evasion and footwork",
  tackle: "Tackle",
  breakdown: "Ruck and maul",
  setpiece: "Scrum and restarts",
  gamesense: "Game sense",
};

/**
 * The earliest RFU age grade at which each theme is legal to coach.
 *
 * Source: RFU Regulation 15 rules of play, checked August 2026. Tackling arrives
 * at U9. Rucks, mauls and the uncontested three-player scrum arrive at U10. There
 * is no lineout at any grade the hub covers: touch restarts with a free pass
 * through U13 and the uncontested lineout arrives at U14. Reg 15 is reissued
 * every year. Re-check these against the live appendices each season.
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
 * Absolute counts take the largest, never the sum. Drills run one at a time.
 */
export function mergeKit(items: KitItem[]): KitItem[] {
  const rank = (kit: KitItem): number => (kit.per === "player" ? 2 : kit.per === "pair" ? 1 : 0);
  const merged = new Map<string, KitItem>();

  for (const kit of items) {
    const held = merged.get(kit.item);
    if (!held) {
      merged.set(kit.item, kit);
      continue;
    }
    if (rank(kit) > rank(held) || (rank(kit) === rank(held) && kit.qty > held.qty)) {
      merged.set(kit.item, kit);
    }
  }

  return [...merged.values()];
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
  ageGroup: AgeGroup;
  theme: Theme;
  sessionMinutes: number;
  /** Curated order: arrival, activation, skill, conditioned game. */
  drillIds: string[];
}
