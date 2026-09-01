import { describe, it, expect } from "vitest";
import {
  checkHalfGame,
  isMatchLength,
  minutesLabel,
  MAX_MATCH_MINUTES,
} from "../logic/playingTime.js";
import { generateInitialPlan, applyEvents, getPlayerStats } from "../logic/rotation.js";
import type { Player, RotationEvent, RotationPlan, PlayerStats } from "../types/index.js";

/**
 * The Half Game Rule check.
 *
 * This is the only thing in the product that gives a verdict against an RFU
 * regulation, so the cases that matter are the ones where a plausible reading
 * of the rule would flag the wrong child: somebody who arrived late, somebody
 * who never turned up, and a squad so big that no rotation can clear the floor.
 */

const squad = (n: number): Player[] =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, name: `Player ${i + 1}` }));

function planFor(players: Player[], playersPerTeam: number, numberOfGames: number) {
  return generateInitialPlan({ players, playersPerTeam, numberOfGames });
}

function statsFor(plan: RotationPlan, players: Player[], events: RotationEvent[] = []) {
  return getPlayerStats(plan, players.map((p) => p.id), events);
}

describe("the Half Game Rule check", () => {
  it("clears a squad that divides into the pitch", () => {
    // Ten players, five on, four games. Everybody gets two of four.
    const players = squad(10);
    const plan = planFor(players, 5, 4);
    const result = checkHalfGame(statsFor(plan, players), plan);

    expect(result.checked).toBe(10);
    expect(result.short).toEqual([]);
    expect(result.everyoneUnreachable).toBe(false);
  });

  it("says so when the squad is more than twice the pitch", () => {
    // Seven a side with sixteen available is an even split of just under 44%,
    // so somebody finishes under the floor however well the rotation works.
    // The pages say this in words. This is the same claim in code.
    const players = squad(16);
    const plan = planFor(players, 7, 4);
    const result = checkHalfGame(statsFor(plan, players), plan);

    expect(result.everyoneUnreachable).toBe(true);
    expect(result.short.length).toBeGreaterThan(0);
  });

  it("stops being unreachable at exactly twice the pitch", () => {
    const players = squad(14);
    const plan = planFor(players, 7, 4);
    expect(checkHalfGame(statsFor(plan, players), plan).everyoneUnreachable).toBe(false);
  });

  it("counts a changed pitch size as it was actually played", () => {
    // Five a side for one game and seven for the rest is not seven a side. The
    // supply is summed over the games rather than taken off one number.
    const players = squad(13);
    const plan = planFor(players, 7, 2);
    const shrunk: RotationPlan = {
      games: [
        { ...plan.games[0], onField: plan.games[0].onField.slice(0, 2) },
        plan.games[1],
      ],
    };
    expect(checkHalfGame(statsFor(plan, players), shrunk).everyoneUnreachable).toBe(true);
  });

  it("measures a late arrival against the rugby they were there for", () => {
    // The failure that would make a coach ignore the warning. Somebody who
    // turned up for the last two of four games cannot reach half of the
    // morning, and flagging them every week teaches you to stop reading it.
    const players = squad(8);
    const plan = planFor(players, 4, 4);
    const events: RotationEvent[] = [
      { type: "late", playerId: "p8" },
      { type: "joined", playerId: "p8", duringGame: 3 },
    ];
    const applied = applyEvents(plan, events, players.map((p) => p.id), 4, 3);
    const stats = statsFor(applied, players, events);

    const late = stats.find((s) => s.playerId === "p8")!;
    expect(late.gamesAvailable).toBeLessThan(4);

    const result = checkHalfGame(stats, applied);
    expect(result.short.map((s) => s.playerId)).not.toContain("p8");
  });

  it("says nothing about a player who never turned up", () => {
    const stats: PlayerStats[] = [
      { playerId: "here", playTimeUnits: 2, gamesAvailable: 4, gamesBenched: 2, fairnessScore: 0 },
      { playerId: "absent", playTimeUnits: 0, gamesAvailable: 0, gamesBenched: 0, fairnessScore: 0 },
    ];
    const plan: RotationPlan = {
      games: [1, 2, 3, 4].map((gameNumber) => ({ gameNumber, onField: ["here"], bench: [] })),
    };
    const result = checkHalfGame(stats, plan);

    expect(result.checked).toBe(1);
    expect(result.short).toEqual([]);
  });

  it("names who is short, furthest short first", () => {
    const stats: PlayerStats[] = [
      { playerId: "half", playTimeUnits: 2, gamesAvailable: 4, gamesBenched: 2, fairnessScore: 0 },
      { playerId: "one", playTimeUnits: 1, gamesAvailable: 4, gamesBenched: 3, fairnessScore: 0 },
      { playerId: "none", playTimeUnits: 0, gamesAvailable: 4, gamesBenched: 4, fairnessScore: 0 },
    ];
    const plan: RotationPlan = {
      games: [1, 2, 3, 4].map((gameNumber) => ({ gameNumber, onField: ["half", "one"], bench: [] })),
    };
    const result = checkHalfGame(stats, plan);

    expect(result.short.map((s) => s.playerId)).toEqual(["none", "one"]);
    expect(result.short[0].needed).toBe(2);
  });

  it("puts it in minutes when it has been told the match length", () => {
    const stats: PlayerStats[] = [
      { playerId: "short", playTimeUnits: 1, gamesAvailable: 4, gamesBenched: 3, fairnessScore: 0 },
    ];
    const plan: RotationPlan = {
      games: [1, 2, 3, 4].map((gameNumber) => ({ gameNumber, onField: ["short"], bench: [] })),
    };
    const result = checkHalfGame(stats, plan, 20);

    expect(result.availableMinutes).toBe(80);
    expect(result.floorMinutes).toBe(40);
    expect(result.short[0].minutesPlayed).toBe(20);
    expect(result.short[0].minutesNeeded).toBe(40);
  });

  it("works with no match length at all, because that is the default", () => {
    const players = squad(10);
    const plan = planFor(players, 5, 4);
    const result = checkHalfGame(statsFor(plan, players), plan);

    expect(result.availableMinutes).toBeNull();
    expect(result.floorMinutes).toBeNull();
    expect(result.short.every((s) => s.minutesPlayed === null)).toBe(true);
  });

  it("ignores a match length that is not one", () => {
    const players = squad(10);
    const plan = planFor(players, 5, 4);
    for (const bad of [0, -10, NaN, Infinity, MAX_MATCH_MINUTES + 1, "20" as unknown as number]) {
      expect(checkHalfGame(statsFor(plan, players), plan, bad).availableMinutes, String(bad)).toBeNull();
    }
  });

  it("does not divide by nothing when there is no plan", () => {
    const result = checkHalfGame([], { games: [] }, 20);
    expect(result.checked).toBe(0);
    expect(result.everyoneUnreachable).toBe(false);
    expect(result.availableMinutes).toBe(0);
  });
});

describe("match length validation", () => {
  it("takes a match, refuses a typo", () => {
    expect(isMatchLength(20)).toBe(true);
    expect(isMatchLength(1)).toBe(true);
    expect(isMatchLength(MAX_MATCH_MINUTES)).toBe(true);
    expect(isMatchLength(0)).toBe(false);
    expect(isMatchLength(MAX_MATCH_MINUTES + 1)).toBe(false);
    expect(isMatchLength(null)).toBe(false);
    expect(isMatchLength(NaN)).toBe(false);
    expect(isMatchLength("20")).toBe(false);
  });
});

describe("minutes on screen", () => {
  it("rounds to something you would say out loud", () => {
    expect(minutesLabel(1.5, 15)).toBe("23 min");
    expect(minutesLabel(2, 20)).toBe("40 min");
    expect(minutesLabel(0, 20)).toBe("0 min");
  });
});

describe("who is furthest short", () => {
  it("ranks by the gap rather than by games played", () => {
    // A player there all morning who played one of four is two short. One who
    // arrived for the last two and played none of them is one short. Sorting on
    // games played would put them the other way round.
    const stats: PlayerStats[] = [
      { playerId: "allDay", playTimeUnits: 1, gamesAvailable: 4, gamesBenched: 3, fairnessScore: 0 },
      { playerId: "arrivedLate", playTimeUnits: 0, gamesAvailable: 2, gamesBenched: 2, fairnessScore: 0 },
    ];
    const plan: RotationPlan = {
      games: [1, 2, 3, 4].map((gameNumber) => ({ gameNumber, onField: ["allDay"], bench: [] })),
    };
    expect(checkHalfGame(stats, plan).short.map((s) => s.playerId)).toEqual([
      "allDay",
      "arrivedLate",
    ]);
  });

  it("knows when the floor is one figure for the whole squad", () => {
    const same: PlayerStats[] = [
      { playerId: "a", playTimeUnits: 2, gamesAvailable: 4, gamesBenched: 2, fairnessScore: 0 },
      { playerId: "b", playTimeUnits: 2, gamesAvailable: 4, gamesBenched: 2, fairnessScore: 0 },
    ];
    const plan: RotationPlan = {
      games: [1, 2, 3, 4].map((gameNumber) => ({ gameNumber, onField: ["a", "b"], bench: [] })),
    };
    expect(checkHalfGame(same, plan).sameForEveryone).toBe(true);

    const mixed = [...same, {
      playerId: "late", playTimeUnits: 1, gamesAvailable: 1, gamesBenched: 0, fairnessScore: 0,
    }];
    expect(checkHalfGame(mixed, plan).sameForEveryone).toBe(false);
  });

  it("still names who is short when the whole squad cannot be covered", () => {
    // One late arrival can tip the sums past what the pitch can give, while
    // most of the squad is comfortably over the floor. Saying nobody can reach
    // it would be false, and dropping the names would lose the one child who
    // actually is short.
    const players = squad(9);
    const plan = planFor(players, 4, 4);
    const events: RotationEvent[] = [
      { type: "late", playerId: "p9" },
      { type: "joined", playerId: "p9", duringGame: 4 },
    ];
    const applied = applyEvents(plan, events, players.map((p) => p.id), 4, 4);
    const result = checkHalfGame(statsFor(applied, players, events), applied);

    expect(result.everyoneUnreachable).toBe(true);
    expect(result.sameForEveryone).toBe(false);
  });
});

describe("the headline figure and the shortfalls agree", () => {
  it("states the floor for what the squad was there for, not for the plan", () => {
    // Everybody left after game two of three. The per-player floor was already
    // one game, while the headline said half of three, so the notice and the
    // names under it disagreed on screen.
    const stats: PlayerStats[] = [
      { playerId: "a", playTimeUnits: 1, gamesAvailable: 2, gamesBenched: 1, fairnessScore: 0 },
      { playerId: "b", playTimeUnits: 1, gamesAvailable: 2, gamesBenched: 1, fairnessScore: 0 },
    ];
    const plan: RotationPlan = {
      games: [1, 2, 3].map((gameNumber) => ({ gameNumber, onField: ["a", "b"], bench: [] })),
    };
    const result = checkHalfGame(stats, plan, 20);

    expect(result.sameForEveryone).toBe(true);
    expect(result.availableMinutes).toBe(40);
    expect(result.floorMinutes).toBe(20);
    expect(result.short).toEqual([]);
  });
});
