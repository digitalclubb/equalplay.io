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

export interface DrillFilter {
  ageGroup: AgeGroup;
  kind?: DrillKind;
  theme?: Theme;
  search?: string;
  /** Narrow to starred drills. Needs `favourites` to mean anything. */
  onlyFavourites?: boolean;
  /** Starred drill ids. Passed in so this stays a pure function. */
  favourites?: ReadonlySet<string>;
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
