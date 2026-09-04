/**
 * How many a side each RFU age grade plays, plus the grade this browser is on.
 *
 * Match day is its own entry and may import nothing from `hub/`, which is where
 * both of those already lived: the grade in `hub/ageChoice.ts` and the numbers
 * in the guides. So they sit here, where the planner and the hub can both have
 * them. `ARRIVALS` in `hub/content/guides.ts` builds its Players column off this
 * map rather than restating it, because a Regulation 15 number written twice is
 * a Regulation 15 number that goes stale in one of the two places.
 *
 * Source: Reg 15 rules of play, checked August 2026. Reissued every summer, so
 * re-read the appendices each season.
 */
const KEY = "equalplay_age_group";

export const PLAYERS_A_SIDE: Record<string, number> = {
  u7: 4,
  u8: 6,
  u9: 7,
  u10: 8,
  u11: 9,
  u12: 12,
};

/**
 * What match day starts on when it has no grade to go by. Somebody who has
 * never opened the hub, or who registered without the age picker, gets this.
 * It is U9's number, which is the middle of the six and the one a coach is
 * least far from whichever grade they actually take.
 */
export const DEFAULT_PLAYERS_A_SIDE = 7;

/** The grade this browser last picked or signed in as. Null if it has none. */
export function storedAgeGroup(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    // Private mode with storage off
    return null;
  }
}

export function storeAgeGroup(age: string): void {
  try {
    localStorage.setItem(KEY, age);
  } catch {
    // Nothing to do. The picker simply reappears next time.
  }
}

/** Players a side for the grade this browser is on, or the default. */
export function playersASide(): number {
  return PLAYERS_A_SIDE[storedAgeGroup() ?? ""] ?? DEFAULT_PLAYERS_A_SIDE;
}
