import { isAvailableAt, type AgeGroup, type Drill, type DrillKind, type Theme } from "./types.js";
import { WARMUPS } from "./catalogue/warmups.js";
import { HANDLING } from "./catalogue/handling.js";
import { EVASION } from "./catalogue/evasion.js";
import { GAMESENSE } from "./catalogue/gamesense.js";
import { TACKLE } from "./catalogue/tackle.js";
import { BREAKDOWN } from "./catalogue/breakdown.js";
import { SETPIECE } from "./catalogue/setpiece.js";

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
}

/**
 * Age is a hard filter rather than a preference. A drill the age grade is not
 * allowed to do never appears, whatever else the coach has typed.
 */
export function filterDrills(drills: Drill[], filter: DrillFilter): Drill[] {
  const search = filter.search?.trim().toLowerCase();

  return drills.filter((drill) => {
    // Age first, always. A starred drill the age grade cannot do stays hidden.
    if (!isAvailableAt(drill, filter.ageGroup)) return false;
    if (filter.onlyFavourites && !filter.favourites?.has(drill.id)) return false;
    if (filter.smallSpace && !fitsSmallSpace(drill)) return false;
    if (filter.kind && drill.kind !== filter.kind) return false;
    if (filter.theme && !drill.themes.includes(filter.theme)) return false;
    if (!search) return true;

    const haystack = [
      drill.title,
      drill.setup,
      drill.howItRuns,
      ...drill.themes,
      ...drill.coachingPoints,
      ...drill.equipment.map((kit) => kit.item),
    ]
      .join(" ")
      .toLowerCase();
    return search.split(/\s+/).every((word) => haystack.includes(word));
  });
}

export function findDrill(id: string): Drill | undefined {
  return DRILLS.find((drill) => drill.id === id);
}
