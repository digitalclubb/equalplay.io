import {
  isAvailableAt,
  searchWords,
  type AgeGroup,
  type Drill,
  type DrillKind,
  type Theme,
} from "./types.js";
import { WARMUPS } from "./catalogue/warmups.js";
import { HANDLING } from "./catalogue/handling.js";
import { EVASION } from "./catalogue/evasion.js";
import { GAMESENSE } from "./catalogue/gamesense.js";
import { TACKLE } from "./catalogue/tackle.js";
import { BREAKDOWN } from "./catalogue/breakdown.js";
import { SETPIECE } from "./catalogue/setpiece.js";
import { KICKING } from "./catalogue/kicking.js";

export { isAvailableAt };

/**
 * The whole catalogue, U7 to U12. Every word written from scratch. Read
 * docs/content-sourcing.md before adding a drill, then run `pnpm test`.
 *
 * Age data follows RFU Regulation 15 for the 2025-26 season. The RFU reissues it
 * every year, so re-check the appendices each August.
 *
 * Warm-ups come first because that is the order a session runs in and the
 * catalogue reads better that way with no filters on.
 */
export const DRILLS: Drill[] = [
  ...WARMUPS,
  ...HANDLING,
  ...EVASION,
  ...GAMESENSE,
  ...TACKLE,
  ...BREAKDOWN,
  ...SETPIECE,
  ...KICKING,
];

// ---- Queries ----

/**
 * The box a drill has to fit inside to count as needing a small space.
 *
 * A school sports hall is where a minis session ends up in January when the
 * pitch is frozen. A corner of the field is where it ends up when another age
 * group has the rest. Both are about this size. Either orientation counts:
 * every drill is drawn running bottom to top, but nothing stops a coach turning
 * one sideways to fit the room.
 *
 * The catalogue's pitch sizes cluster, so anything from here up to a full 33 by
 * 18 sports hall picks exactly the same 56 drills. That gap is worth knowing
 * about: the number is not balanced on a knife edge and a metre either way
 * changes nothing.
 *
 * A tighter box was tried first, at 20 by 10. It left a U7 coach two drills out
 * of eighteen, because tag games need running room while tackle and ruck work
 * happens in a tight square. So the filter was most useless at exactly the
 * grades most likely to be indoors. What it did offer was mostly contact.
 */
const SMALL_SPACE_METRES = { long: 25, short: 15 };

/**
 * Whether a drill fits a small space, worked out from the pitch its own diagram
 * describes rather than from a field somebody has to remember to keep true.
 *
 * The one drill with no diagram is a mobility warm-up that needs no marked area
 * at all, so it fits anywhere. `content-age-gate.test.ts` holds that to the
 * space the drill states, so a later one cannot arrive with no diagram and a
 * full pitch and quietly be offered for a sports hall.
 *
 * This says nothing about the surface. Whether a tackle drill belongs on a hard
 * floor is a coach's call and not something a filter should look like it is
 * blessing.
 */
export function fitsSmallSpace(drill: Drill): boolean {
  if (!drill.diagram) return true;
  const [width, depth] = drill.diagram.space;
  return (
    Math.max(width, depth) <= SMALL_SPACE_METRES.long &&
    Math.min(width, depth) <= SMALL_SPACE_METRES.short
  );
}

/**
 * Whether a drill can be run on ground too hard to fall on.
 *
 * August dust and February frost both leave a pitch you can hear a child land
 * on. The answer is not to cancel the session, it is to run the half of the
 * catalogue that never asks anybody to go to the floor. A drill says so itself
 * with `softGround`, because nothing about the surface can be worked out from
 * the shape of a drill: a shield drill where nobody goes down reads the same in
 * data as one where everybody does.
 *
 * This says nothing about whether the ground is safe to run on at all. Frozen
 * ruts turn an ankle in a tag game as readily as in a tackle. That call stays
 * with the coach standing on it.
 */
export function fitsHardGround(drill: Drill): boolean {
  return !drill.softGround;
}

export interface DrillFilter {
  ageGroup: AgeGroup;
  kind?: DrillKind;
  theme?: Theme;
  search?: string;
  /** Narrow to starred drills. Needs `favourites` to mean anything. */
  onlyFavourites?: boolean;
  /** Starred drill ids. Passed in so this stays a pure function. */
  favourites?: ReadonlySet<string>;
  /** Narrow to what fits a sports hall or a corner of a pitch. */
  smallSpace?: boolean;
  /** Narrow to what nobody has to hit the floor for. */
  hardGround?: boolean;
}

/**
 * Age gated, filtered, then ordered with the session's work first.
 *
 * Age is a hard filter rather than a preference. A drill the age grade is not
 * allowed to do never appears, whatever else the coach has typed.
 *
 * The catalogue is assembled warm-ups first, which put 21 warm-up cards ahead
 * of the first exercise at U10. A coach opening the list is looking for what
 * the session is about. The warm-up is one tap away on its own tab, so the
 * exercises lead. Within each kind the catalogue's own order is kept, because
 * it groups by theme and that is worth more than anything alphabetical.
 */
export function filterDrills(drills: Drill[], filter: DrillFilter): Drill[] {
  const search = filter.search ? searchWords(filter.search) : [];

  return matching(drills, filter, search).sort((a, b) => rank(a) - rank(b));
}

const rank = (drill: Drill): number => (drill.kind === "exercise" ? 0 : 1);

function matching(drills: Drill[], filter: DrillFilter, search: string[]): Drill[] {
  return drills.filter((drill) => {
    // Age first, always. A starred drill the age grade cannot do stays hidden.
    if (!isAvailableAt(drill, filter.ageGroup)) return false;
    if (filter.onlyFavourites && !filter.favourites?.has(drill.id)) return false;
    if (filter.smallSpace && !fitsSmallSpace(drill)) return false;
    if (filter.hardGround && !fitsHardGround(drill)) return false;
    if (filter.kind && drill.kind !== filter.kind) return false;
    if (filter.theme && !drill.themes.includes(filter.theme)) return false;
    if (search.length === 0) return true;

    const haystack = [
      drill.title,
      drill.setup,
      drill.howItRuns,
      ...drill.themes,
      ...drill.coachingPoints,
      // A coach does not search for a drill, they search for the thing going
      // wrong in front of them. "dropping", "flat", "standing still" are all in
      // the faults and nowhere else, so leaving them out meant the one part of
      // the catalogue written for somebody who has never seen the drill go
      // right was the one part the search box could not reach.
      ...(drill.faults ?? []).flatMap((fault) => [fault.looks, fault.say]),
      ...drill.equipment.map((kit) => kit.item),
    ]
      .join(" ")
      .toLowerCase();
    return search.every((word) => haystack.includes(word));
  });
}

export function findDrill(id: string): Drill | undefined {
  return DRILLS.find((drill) => drill.id === id);
}

/**
 * A drill's own address on the public site.
 *
 * It lives here rather than in `src/seo/` because both halves need it now. The
 * generator writes the page. The hub links a coach to it. Importing it from
 * `seo/` would pull the whole static page builder into a bundle a coach
 * downloads at a pitch.
 *
 * Built off `drill.id`, which saved session plans reference and which is
 * therefore never renamed, so an address published here is one that keeps
 * working. The `drill-` and `warmup-` prefixes come off, because they say which
 * half of the catalogue a drill sits in and that is the one thing an address
 * does not need to carry.
 */
export function drillPath(drill: Drill): string {
  return `/rugby-drill-${drill.id.replace(/^(?:drill|warmup)-/, "")}`;
}
