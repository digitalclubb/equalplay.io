/**
 * How many players a side each RFU minis grade plays.
 *
 * Here rather than in `hub/content/` because the match-day planner needs it and
 * the planner must not import from the hub: `@supabase/supabase-js` is ~220 kB
 * and one import is all it would take. This module imports nothing, the way
 * `lib/nav.ts` does.
 *
 * Source: the Regulation 15 rules of play, one appendix per grade, read in
 * August 2026 alongside the rest of the age grade claims here. `guides.test.ts`
 * holds the guide's own table to these numbers, so the two cannot drift.
 */
export const PLAYERS_A_SIDE = {
  u7: 4,
  u8: 6,
  u9: 7,
  u10: 8,
  u11: 9,
  u12: 12,
} as const;

export type MinisGrade = keyof typeof PLAYERS_A_SIDE;

export const MINIS_GRADES = Object.keys(PLAYERS_A_SIDE) as MinisGrade[];

/** "U10", for a label. */
export const gradeLabel = (grade: MinisGrade): string => grade.toUpperCase();
