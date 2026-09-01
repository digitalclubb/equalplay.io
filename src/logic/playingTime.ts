import type { PlayerStats, RotationPlan } from "../types/index.js";

/**
 * The RFU's Half Game Rule, checked against a rotation.
 *
 * Every player in the match day squad plays at least half of the available
 * playing time. It applies at every age grade, contact or not, festivals and
 * tournaments included. Unlike the daily maximum it does not change with the
 * grade. Regulation 15 states it in minutes, which is why the planner asks
 * for them.
 *
 * Two things this is careful about.
 *
 * The denominator is per player. A child who arrived for the last two games of
 * four cannot reach half of the morning. Flagging them every week would train a
 * coach to ignore the flag. Available playing time means available to
 * them, so it is measured against the games they were actually around for.
 *
 * The numerator is an estimate. `playTimeUnits` counts a full game as one and a
 * player who came on or went off part way as a half, because the planner knows
 * the order of substitutions rather than the clock. So this reports who is
 * short and never certifies that a squad complied.
 */

export interface Shortfall {
  playerId: string;
  /** Games played, where a part game counts as a half. */
  played: number;
  /** Half of what was available to this player. */
  needed: number;
  /** Both in minutes, when the coach has said how long a match is. */
  minutesPlayed: number | null;
  minutesNeeded: number | null;
}

export interface HalfGameCheck {
  /** Players under half of the rugby available to them, furthest short first. */
  short: Shortfall[];
  /** How many players the rule was checked against. */
  checked: number;
  /**
   * The pitch cannot supply half a game to everybody, so no rotation gets the
   * whole squad there. A fixture problem rather than a rotation one. It does
   * not mean nobody reaches the floor: most of a squad usually does, which is
   * why the short list is still worth naming underneath it.
   */
  everyoneUnreachable: boolean;
  /**
   * Every player was around for the same number of games, so the floor can be
   * stated as one figure. When they were not, half of the morning is not what
   * the child who arrived at ten needs.
   */
  sameForEveryone: boolean;
  /** Minutes the whole day is worth, when they are known. */
  availableMinutes: number | null;
  /** Half of that, which is what each player needs. */
  floorMinutes: number | null;
}

/** Minutes a match may run to. Outside this it is a typo rather than a match. */
export const MIN_MATCH_MINUTES = 1;
export const MAX_MATCH_MINUTES = 200;

export function checkHalfGame(
  stats: PlayerStats[],
  plan: RotationPlan,
  minutesPerMatch: number | null = null,
): HalfGameCheck {
  const minutes = isMatchLength(minutesPerMatch) ? minutesPerMatch : null;

  // Only players who were there for something. Somebody marked absent all day
  // is not in the match day squad, so the rule has nothing to say about them.
  const present = stats.filter((stat) => stat.gamesAvailable > 0);

  const short: Shortfall[] = [];
  for (const stat of present) {
    const needed = stat.gamesAvailable / 2;
    if (stat.playTimeUnits >= needed) continue;
    short.push({
      playerId: stat.playerId,
      played: stat.playTimeUnits,
      needed,
      minutesPlayed: minutes === null ? null : stat.playTimeUnits * minutes,
      minutesNeeded: minutes === null ? null : needed * minutes,
    });
  }
  // Furthest short first, which is the gap rather than the games played. A
  // player there all day who played one of four is further short than one who
  // arrived for the last two and played none of them.
  short.sort(
    (a, b) => b.needed - b.played - (a.needed - a.played) || a.playerId.localeCompare(b.playerId),
  );

  // What the pitch has to give against what the rule asks for. Summed over the
  // games rather than taken from one number on the pitch, so a squad size that
  // changes between games is counted as it was actually played.
  const supply = plan.games.reduce((total, game) => total + game.onField.length, 0);
  const demand = present.reduce((total, stat) => total + stat.gamesAvailable / 2, 0);

  return {
    short,
    checked: present.length,
    everyoneUnreachable: supply < demand,
    sameForEveryone: present.every((stat) => stat.gamesAvailable === present[0].gamesAvailable),
    availableMinutes: minutes === null ? null : plan.games.length * minutes,
    floorMinutes: minutes === null ? null : (plan.games.length * minutes) / 2,
  };
}

/** A match length the planner will work with, or nothing. */
export function isMatchLength(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= MIN_MATCH_MINUTES &&
    value <= MAX_MATCH_MINUTES
  );
}

/**
 * Minutes for one player, rounded to something you would say out loud.
 *
 * Half units against an odd match length give a half minute, which is more
 * precision than the estimate behind it deserves.
 */
export function minutesLabel(units: number, minutesPerMatch: number): string {
  return `${Math.round(units * minutesPerMatch)} min`;
}
