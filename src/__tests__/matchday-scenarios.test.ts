/**
 * Matchday scenario tests
 *
 * These simulate how a real coach uses the app during a match.
 * Each test walks through a sequence of observable actions
 * (generate plan → view lineup → make sub → advance game)
 * and asserts only on what the coach would see on screen.
 *
 * No internal state is inspected. If a coach would trust the result,
 * the test passes.
 */

import { describe, it, expect } from "vitest";
import {
  generateInitialPlan,
  applyEvents,
  getSubCandidates,
  getNextSubSuggestion,
  getUnavailableForGame,
  getPlayerStats,
} from "../logic/rotation.js";
import type { Player, RotationEvent, RotationPlan } from "../types/index.js";

// ---- Helpers (simulate what the app does) ----

function squad(count: number): { players: Player[]; ids: string[] } {
  const players = Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Player ${i + 1}`,
  }));
  return { players, ids: players.map((p) => p.id) };
}

/** Simulate the coach tapping "Make sub" with whatever the app recommends */
function applyRecommendedSub(
  plan: RotationPlan,
  gameNum: number,
  ids: string[],
  events: RotationEvent[],
): { type: "sub"; gameNumber: number; playerOut: string; playerIn: string } | null {
  const current = applyEvents(plan, events, ids, plan.games[0].onField.length, gameNum);
  const unavailable = getUnavailableForGame(gameNum, ids, events);
  const suggestion = getNextSubSuggestion(current, gameNum, unavailable, events);
  if (!suggestion) return null;
  return {
    type: "sub",
    gameNumber: gameNum,
    playerOut: suggestion.playerOut,
    playerIn: suggestion.playerIn,
  };
}


// ====================================================================
// SCENARIO 1: HALF-TIME BEHAVIOUR
//
// Coach sets up 6 players, 4 on field. Two sit out the first half.
// At half time the coach expects those two to start, not be suggested
// as substitutes.
// ====================================================================

describe("scenario 1: half-time behaviour (6 players, 4 on field)", () => {
  const { players, ids } = squad(6);
  const perTeam = 4;
  const plan = generateInitialPlan({ players, playersPerTeam: perTeam, numberOfGames: 2 });

  it("two players are benched in the first half", () => {
    const g1 = plan.games[0];
    expect(g1.onField).toHaveLength(4);
    expect(g1.bench).toHaveLength(2);
  });

  it("previously benched players start the second half", () => {
    const g1Bench = new Set(plan.games[0].bench);
    const g2OnField = new Set(plan.games[1].onField);

    // Both benched players from game 1 must be on field in game 2
    for (const id of g1Bench) {
      expect(g2OnField.has(id)).toBe(true);
    }
  });

  it("benched players are NOT the first sub recommendation in the second half", () => {
    const g1Bench = new Set(plan.games[0].bench);
    const unavailable = getUnavailableForGame(2, ids, []);
    const candidates = getSubCandidates(plan, 2, unavailable, []);

    // If the system suggests a sub at all, the player coming off
    // must NOT be someone who just sat out the first half
    if (candidates) {
      const recommendedOff = candidates.fieldRanked[0];
      expect(g1Bench.has(recommendedOff)).toBe(false);
    }
  });

  it("second-half sub targets someone who played the entire first half", () => {
    const g1OnField = new Set(plan.games[0].onField);
    const unavailable = getUnavailableForGame(2, ids, []);
    const candidates = getSubCandidates(plan, 2, unavailable, []);

    if (candidates) {
      const recommendedOff = candidates.fieldRanked[0];
      // The player recommended off should have played the first half
      expect(g1OnField.has(recommendedOff)).toBe(true);
    }
  });
});

// ====================================================================
// SCENARIO 2: BENCH ROTATION
//
// 7 players, 5 on field, 4 games. Two players sit out each game.
// No player should sit out two games in a row.
// ====================================================================

describe("scenario 2: bench rotation (7 players, 5 on field, 4 games)", () => {
  const { players, ids } = squad(7);
  const perTeam = 5;
  const plan = generateInitialPlan({ players, playersPerTeam: perTeam, numberOfGames: 4 });

  it("no player is benched in two consecutive games", () => {
    for (let i = 0; i < plan.games.length - 1; i++) {
      const thisBench = new Set(plan.games[i].bench);
      const nextBench = new Set(plan.games[i + 1].bench);

      const benchedTwice = [...thisBench].filter((id) => nextBench.has(id));
      expect(benchedTwice).toHaveLength(0);
    }
  });

  it("every player is on field at least once across 4 games", () => {
    const playedAtLeastOnce = new Set<string>();
    for (const game of plan.games) {
      for (const id of game.onField) playedAtLeastOnce.add(id);
    }
    expect(playedAtLeastOnce.size).toBe(7);
  });

  it("bench rotation holds even after events are applied", () => {
    // Simulate the coach advancing through all 4 games with no events
    const result = applyEvents(plan, [], ids, perTeam, 1);

    for (let i = 0; i < result.games.length - 1; i++) {
      const thisBench = new Set(result.games[i].bench);
      const nextBench = new Set(result.games[i + 1].bench);

      const benchedTwice = [...thisBench].filter((id) => nextBench.has(id));
      expect(benchedTwice).toHaveLength(0);
    }
  });
});

// ====================================================================
// SCENARIO 3: FAIR DISTRIBUTION
//
// 10 players, 7 on field, 5 games. A larger squad where the coach
// wants to see everyone get a fair go.
// ====================================================================

describe("scenario 3: fair distribution (10 players, 7 on field, 5 games)", () => {
  const { players, ids } = squad(10);
  const perTeam = 7;
  const numGames = 5;
  const plan = generateInitialPlan({ players, playersPerTeam: perTeam, numberOfGames: numGames });

  it("every player appears on field in at least one game", () => {
    const everPlayed = new Set<string>();
    for (const game of plan.games) {
      for (const id of game.onField) everPlayed.add(id);
    }
    expect(everPlayed.size).toBe(10);
  });

  it("play time spread is at most 1 game without subs", () => {
    const stats = getPlayerStats(plan, ids);
    const times = stats.map((s) => s.playTimeUnits);
    const spread = Math.max(...times) - Math.min(...times);
    expect(spread).toBeLessThanOrEqual(1);
  });

  it("total play slots are preserved (7 × 5 = 35)", () => {
    const stats = getPlayerStats(plan, ids);
    const total = stats.reduce((sum, s) => sum + s.playTimeUnits, 0);
    expect(total).toBeCloseTo(35, 1);
  });

  it("following recommended subs each game keeps spread ≤ 1.5", () => {
    const events: RotationEvent[] = [];

    for (let gameNum = 1; gameNum <= numGames; gameNum++) {
      const sub = applyRecommendedSub(plan, gameNum, ids, events);
      if (sub) events.push(sub);
    }

    const finalPlan = applyEvents(plan, events, ids, perTeam, numGames + 1);
    const stats = getPlayerStats(finalPlan, ids, events);
    const times = stats.map((s) => s.playTimeUnits);
    const spread = Math.max(...times) - Math.min(...times);
    expect(spread).toBeLessThanOrEqual(1.5);
  });

  it("no player has zero playing time after all games", () => {
    const stats = getPlayerStats(plan, ids);
    for (const s of stats) {
      expect(s.playTimeUnits).toBeGreaterThan(0);
    }
  });
});

// ====================================================================
// SCENARIO 4: INJURY OVERRIDE
//
// Coach generates a game, then marks a field player as injured mid-game.
// The system must immediately recommend that player to come off,
// overriding any fairness-based suggestion.
// ====================================================================

describe("scenario 4: injury override", () => {
  const { players, ids } = squad(7);
  const perTeam = 5;
  const plan = generateInitialPlan({ players, playersPerTeam: perTeam, numberOfGames: 3 });
  const g1 = plan.games[0];

  it("before injury: sub suggestion is based on fairness (not injury)", () => {
    const unavailable = getUnavailableForGame(1, ids, []);
    const candidates = getSubCandidates(plan, 1, unavailable, []);

    if (candidates) {
      expect(candidates.injuredOut).toBe(false);
    }
  });

  it("after injury: injured player is FIRST in fieldRanked", () => {
    // Coach taps a field player and marks them injured
    const injuredPlayer = g1.onField[2];
    const events: RotationEvent[] = [
      { type: "injured", playerId: injuredPlayer, gameNumber: 1 },
    ];

    const unavailable = getUnavailableForGame(1, ids, events);
    const candidates = getSubCandidates(plan, 1, unavailable, events);

    expect(candidates).not.toBeNull();
    expect(candidates!.injuredOut).toBe(true);
    expect(candidates!.fieldRanked[0]).toBe(injuredPlayer);
  });

  it("after injury: replacement comes from the bench", () => {
    const injuredPlayer = g1.onField[2];
    const events: RotationEvent[] = [
      { type: "injured", playerId: injuredPlayer, gameNumber: 1 },
    ];

    const unavailable = getUnavailableForGame(1, ids, events);
    const candidates = getSubCandidates(plan, 1, unavailable, events);

    expect(candidates).not.toBeNull();
    // Every player in benchRanked must actually be on the bench
    for (const id of candidates!.benchRanked) {
      expect(g1.bench).toContain(id);
    }
  });

  it("after injury sub is made: injuredOut flag clears", () => {
    const injuredPlayer = g1.onField[2];
    const replacement = g1.bench[0];
    const events: RotationEvent[] = [
      { type: "injured", playerId: injuredPlayer, gameNumber: 1 },
      { type: "sub", gameNumber: 1, playerOut: injuredPlayer, playerIn: replacement },
    ];

    const rebalanced = applyEvents(plan, events, ids, perTeam, 1);
    const unavailable = getUnavailableForGame(1, ids, events);
    const candidates = getSubCandidates(rebalanced, 1, unavailable, events);

    // After the injury sub, no more injury flag
    if (candidates) {
      expect(candidates.injuredOut).toBe(false);
    }
  });

  it("injured player is excluded from all future games", () => {
    const injuredPlayer = g1.onField[0];
    const events: RotationEvent[] = [
      { type: "injured", playerId: injuredPlayer, gameNumber: 1 },
    ];

    const result = applyEvents(plan, events, ids, perTeam, 1);
    for (const game of result.games) {
      if (game.gameNumber > 1) {
        expect(game.onField).not.toContain(injuredPlayer);
        expect(game.bench).not.toContain(injuredPlayer);
      }
    }
  });
});

// ====================================================================
// SCENARIO 5: COMBINED CHAOS
//
// Matchday with multiple simultaneous disruptions:
// - Player A was benched first half
// - Player B gets injured during game 2
// - Player C was underplayed due to late arrival
//
// The system must handle injury first, then continue with fairness.
// ====================================================================

describe("scenario 5: combined chaos — bench + injury + late arrival", () => {
  const { players, ids } = squad(8);
  const perTeam = 5;
  const plan = generateInitialPlan({ players, playersPerTeam: perTeam, numberOfGames: 4 });

  it("handles injury priority while maintaining fairness for others", () => {
    const g1 = plan.games[0];
    const benchedFirstHalf = g1.bench[0]; // Player A: sat out game 1
    const latePlayer = g1.onField[0];      // Player C: will be late

    // Step 1: Mark player C as late (coach realises they're not here)
    const events: RotationEvent[] = [
      { type: "late", playerId: latePlayer },
    ];

    // Verify: late player is excluded from game 1
    let result = applyEvents(plan, events, ids, perTeam, 1);
    expect(result.games[0].onField).not.toContain(latePlayer);

    // Step 2: Player C arrives during game 1
    events.push({ type: "joined", playerId: latePlayer, duringGame: 1 });

    // Verify: late player is on bench for game 1 (available for emergency)
    result = applyEvents(plan, events, ids, perTeam, 1);
    expect(result.games[0].bench).toContain(latePlayer);

    // Step 3: Advance to game 2. Pick a field player from game 2 to injure.
    result = applyEvents(plan, events, ids, perTeam, 2);
    const g2Field = result.games[1].onField;
    const injuredPlayer = g2Field.find(
      (id) => id !== benchedFirstHalf && id !== latePlayer,
    )!;

    events.push({ type: "injured", playerId: injuredPlayer, gameNumber: 2 });

    // Step 4: Check sub recommendation — injury MUST take priority
    const unavailable2 = getUnavailableForGame(2, ids, events);
    result = applyEvents(plan, events, ids, perTeam, 2);
    const candidates = getSubCandidates(result, 2, unavailable2, events);

    expect(candidates).not.toBeNull();
    expect(candidates!.injuredOut).toBe(true);
    expect(candidates!.fieldRanked[0]).toBe(injuredPlayer);

    // Step 5: Make the injury sub
    const replacement = candidates!.benchRanked[0];
    events.push({
      type: "sub",
      gameNumber: 2,
      playerOut: injuredPlayer,
      playerIn: replacement,
    });

    // Step 6: Advance to game 3 — verify fairness continues
    result = applyEvents(plan, events, ids, perTeam, 3);

    // Injured player must be gone from future games
    expect(result.games[2].onField).not.toContain(injuredPlayer);
    expect(result.games[2].bench).not.toContain(injuredPlayer);

    // Late player should have got field time by now
    const lateOnFieldCount = result.games
      .filter((g) => g.gameNumber >= 2)
      .filter((g) => g.onField.includes(latePlayer))
      .length;
    expect(lateOnFieldCount).toBeGreaterThan(0);

    // No player has zero time after 4 games (except the injured one)
    const finalResult = applyEvents(plan, events, ids, perTeam, 5);
    const stats = getPlayerStats(finalResult, ids, events);
    for (const s of stats) {
      if (s.playerId === injuredPlayer) continue; // injured, partial time is OK
      expect(s.playTimeUnits).toBeGreaterThan(0);
    }
  });

  it("no rules conflict — system does not crash or produce empty lineups", () => {
    const g1 = plan.games[0];
    const latePlayer = g1.onField[1];

    const events: RotationEvent[] = [
      { type: "late", playerId: latePlayer },
      { type: "joined", playerId: latePlayer, duringGame: 1 },
    ];

    // Advance through all 4 games — nothing should crash
    for (let gameNum = 1; gameNum <= 4; gameNum++) {
      const result = applyEvents(plan, events, ids, perTeam, gameNum);
      const game = result.games[gameNum - 1];

      // Field should never be empty (we have enough players)
      expect(game.onField.length).toBeGreaterThan(0);
      // No player should be in both field and bench
      const overlap = game.onField.filter((id) => game.bench.includes(id));
      expect(overlap).toHaveLength(0);
    }
  });
});

// ====================================================================
// SCENARIO 6: EDGE CASE — LIMITED PLAYERS
//
// Small squad (4 players, 3 on field, 4 games) where perfect rotation
// is mathematically impossible. The system should still distribute
// fairly — no player should be excessively disadvantaged.
// ====================================================================

describe("scenario 6: limited squad — imperfect rotation (4 players, 3 on field)", () => {
  const { players, ids } = squad(4);
  const perTeam = 3;
  const numGames = 4;
  const plan = generateInitialPlan({ players, playersPerTeam: perTeam, numberOfGames: numGames });

  it("every player gets on field at least twice in 4 games", () => {
    const fieldCounts = new Map<string, number>();
    for (const id of ids) fieldCounts.set(id, 0);

    for (const game of plan.games) {
      for (const id of game.onField) {
        fieldCounts.set(id, (fieldCounts.get(id) ?? 0) + 1);
      }
    }

    for (const [, count] of fieldCounts) {
      expect(count).toBeGreaterThanOrEqual(2);
    }
  });

  it("play time spread is at most 1 game", () => {
    const stats = getPlayerStats(plan, ids);
    const times = stats.map((s) => s.playTimeUnits);
    expect(Math.max(...times) - Math.min(...times)).toBeLessThanOrEqual(1);
  });

  it("total slots are preserved (3 × 4 = 12)", () => {
    const stats = getPlayerStats(plan, ids);
    const total = stats.reduce((sum, s) => sum + s.playTimeUnits, 0);
    expect(total).toBeCloseTo(12, 1);
  });

  it("following recommended subs maintains fairness", () => {
    const events: RotationEvent[] = [];

    for (let gameNum = 1; gameNum <= numGames; gameNum++) {
      const sub = applyRecommendedSub(plan, gameNum, ids, events);
      if (sub) events.push(sub);
    }

    const finalPlan = applyEvents(plan, events, ids, perTeam, numGames + 1);
    const stats = getPlayerStats(finalPlan, ids, events);

    // Every player should have got time
    for (const s of stats) {
      expect(s.playTimeUnits).toBeGreaterThan(0);
    }

    // With subs, spread should still be ≤ 1.0
    const times = stats.map((s) => s.playTimeUnits);
    expect(Math.max(...times) - Math.min(...times)).toBeLessThanOrEqual(1.0);
  });
});

// ====================================================================
// SCENARIO 7: FULL MATCHDAY WALKTHROUGH
//
// Simulates a realistic full match from a coach's perspective:
// generate → review → start → sub → advance → sub → advance → finish.
// This is the "golden path" integration test.
// ====================================================================

describe("scenario 7: full matchday walkthrough (9 players, 7 on field, 3 games)", () => {
  const { players, ids } = squad(9);
  const perTeam = 7;
  const numGames = 3;
  const plan = generateInitialPlan({ players, playersPerTeam: perTeam, numberOfGames: numGames });

  it("complete match from first whistle to final stats", () => {
    const events: RotationEvent[] = [];

    // ---- GAME 1: Coach reviews lineup ----
    const g1 = plan.games[0];
    expect(g1.onField).toHaveLength(7);
    expect(g1.bench).toHaveLength(2);

    // Coach checks: everyone is accounted for
    const allG1 = [...g1.onField, ...g1.bench];
    expect(allG1.sort()).toEqual([...ids].sort());

    // Mid-game 1: coach makes the recommended sub
    const sub1 = applyRecommendedSub(plan, 1, ids, events);
    if (sub1) {
      events.push(sub1);

      // Verify the sub appears in the lineup
      const afterSub = applyEvents(plan, events, ids, perTeam, 1);
      expect(afterSub.games[0].onField).toContain(sub1.playerIn);
      expect(afterSub.games[0].bench).toContain(sub1.playerOut);
    }

    // ---- GAME 2: Coach advances ----
    const result2 = applyEvents(plan, events, ids, perTeam, 2);
    const g2 = result2.games[1];

    // Players benched in game 1 should be on field now
    const g1Bench = new Set(plan.games[0].bench);
    for (const id of g1Bench) {
      expect(g2.onField).toContain(id);
    }

    // Mid-game 2: coach makes another sub
    const sub2 = applyRecommendedSub(plan, 2, ids, events);
    if (sub2) events.push(sub2);

    // ---- GAME 3: Coach advances to final game ----
    const result3 = applyEvents(plan, events, ids, perTeam, 3);
    const g3 = result3.games[2];

    // Everyone should still be accounted for
    const allG3 = [...g3.onField, ...g3.bench];
    expect(allG3.sort()).toEqual([...ids].sort());

    // ---- POST-MATCH: Coach checks fairness ----
    const sub3 = applyRecommendedSub(plan, 3, ids, events);
    if (sub3) events.push(sub3);

    const finalResult = applyEvents(plan, events, ids, perTeam, numGames + 1);
    const stats = getPlayerStats(finalResult, ids, events);

    // No player excluded
    for (const s of stats) {
      expect(s.playTimeUnits).toBeGreaterThan(0);
    }

    // Play time spread is reasonable
    const times = stats.map((s) => s.playTimeUnits);
    const spread = Math.max(...times) - Math.min(...times);
    expect(spread).toBeLessThanOrEqual(1.5);

    // Total slots preserved (7 × 3 = 21, adjusted for sub half-credits)
    const total = stats.reduce((sum, s) => sum + s.playTimeUnits, 0);
    expect(total).toBeCloseTo(21, 1);
  });
});

// ====================================================================
// SCENARIO 8: LATE ARRIVAL MOMENTUM FAIRNESS
//
// A player misses the first half, then plays the second half.
// The system must prioritise them for the next game — they should
// NOT be immediately benched again if avoidable.
//
// This validates the "momentum fairness" rule: recent underplay
// must carry forward, not just total play time.
// ====================================================================

describe("scenario 8: late arrival momentum fairness", () => {

  // ---- 8a: Late player joins bench, plays next game onward ----

  describe("8a: late player (8 players, 5 on field, 4 games)", () => {
    const { players, ids } = squad(8);
    const perTeam = 5;
    const plan = generateInitialPlan({ players, playersPerTeam: perTeam, numberOfGames: 4 });
    const latePlayer = "p1";
    const events: RotationEvent[] = [
      { type: "late", playerId: latePlayer },
      { type: "joined", playerId: latePlayer, duringGame: 1 },
    ];

    it("late player is on bench (not field) for the game they arrive during", () => {
      const result = applyEvents(plan, events, ids, perTeam, 1);
      expect(result.games[0].onField).not.toContain(latePlayer);
      expect(result.games[0].bench).toContain(latePlayer);
    });

    it("late player is prioritised to start the next game", () => {
      const result = applyEvents(plan, events, ids, perTeam, 2);
      expect(result.games[1].onField).toContain(latePlayer);
    });

    it("late player is NOT immediately benched again in the game after that", () => {
      const result = applyEvents(plan, events, ids, perTeam, 3);
      // Game 2: played. Game 3: should still be on field (debt is still high)
      expect(result.games[2].onField).toContain(latePlayer);
    });

    it("sub recommendation never targets the late player as first off in game 2", () => {
      const result = applyEvents(plan, events, ids, perTeam, 2);
      const unavailable = getUnavailableForGame(2, ids, events);
      const candidates = getSubCandidates(result, 2, unavailable, events);

      if (candidates) {
        expect(candidates.fieldRanked[0]).not.toBe(latePlayer);
      }
    });

    it("sub recommendation never targets the late player as first off in game 3", () => {
      const result = applyEvents(plan, events, ids, perTeam, 3);
      const unavailable = getUnavailableForGame(3, ids, events);
      const candidates = getSubCandidates(result, 3, unavailable, events);

      if (candidates) {
        expect(candidates.fieldRanked[0]).not.toBe(latePlayer);
      }
    });

    it("across all 4 games, late player gets fair total time", () => {
      const result = applyEvents(plan, events, ids, perTeam, 5);
      const stats = getPlayerStats(result, ids, events);
      const lateStat = stats.find((s) => s.playerId === latePlayer)!;
      const otherTimes = stats
        .filter((s) => s.playerId !== latePlayer)
        .map((s) => s.playTimeUnits);
      const avgOther = otherTimes.reduce((a, b) => a + b, 0) / otherTimes.length;

      // Late player should not be more than 1 full game behind average
      expect(lateStat.playTimeUnits).toBeGreaterThanOrEqual(avgOther - 1.0);
    });
  });

  // ---- 8b: Late player subbed ON mid-game (gets 0.5 credit) ----

  describe("8b: late player subbed on mid-game 1 (7 players, 5 on field, 4 games)", () => {
    const { players, ids } = squad(7);
    const perTeam = 5;
    const plan = generateInitialPlan({ players, playersPerTeam: perTeam, numberOfGames: 4 });
    const latePlayer = "p1";

    it("after being subbed on in game 1, late player starts game 2", () => {
      // Get the game 1 lineup with late player on bench
      const lateEvents: RotationEvent[] = [
        { type: "late", playerId: latePlayer },
        { type: "joined", playerId: latePlayer, duringGame: 1 },
      ];
      const baseline = applyEvents(plan, lateEvents, ids, perTeam, 1);
      const subOut = baseline.games[0].onField[0]; // sub someone out for the late player

      const events: RotationEvent[] = [
        ...lateEvents,
        { type: "sub", gameNumber: 1, playerOut: subOut, playerIn: latePlayer },
      ];

      const result = applyEvents(plan, events, ids, perTeam, 2);
      // Late player got 0.5 credit from the sub — they should still start game 2
      expect(result.games[1].onField).toContain(latePlayer);
    });

    it("late player who was subbed on is not benched again until they have caught up", () => {
      const lateEvents: RotationEvent[] = [
        { type: "late", playerId: latePlayer },
        { type: "joined", playerId: latePlayer, duringGame: 1 },
      ];
      const baseline = applyEvents(plan, lateEvents, ids, perTeam, 1);
      const subOut = baseline.games[0].onField[0];

      const events: RotationEvent[] = [
        ...lateEvents,
        { type: "sub", gameNumber: 1, playerOut: subOut, playerIn: latePlayer },
      ];

      const result = applyEvents(plan, events, ids, perTeam, 1);

      // After sub in game 1 (0.5 credit) + game 2 (1.0) = 1.5 total
      // Others who played full game 1 have 1.0. So p1 may eventually
      // be benched when they've caught up — but NOT immediately in game 2.
      expect(result.games[1].onField).toContain(latePlayer);
    });
  });

  // ---- 8c: Tight squad — 6 players, 4 on field ----

  describe("8c: tight squad late arrival (6 players, 4 on field, 3 games)", () => {
    const { players, ids } = squad(6);
    const perTeam = 4;
    const plan = generateInitialPlan({ players, playersPerTeam: perTeam, numberOfGames: 3 });
    const latePlayer = "p1";
    const events: RotationEvent[] = [
      { type: "late", playerId: latePlayer },
      { type: "joined", playerId: latePlayer, duringGame: 1 },
    ];

    it("late player starts game 2 on field", () => {
      const result = applyEvents(plan, events, ids, perTeam, 2);
      expect(result.games[1].onField).toContain(latePlayer);
    });

    it("late player still on field in game 3 (still underplayed vs others)", () => {
      const result = applyEvents(plan, events, ids, perTeam, 3);
      expect(result.games[2].onField).toContain(latePlayer);
    });
  });

  // ---- 8d: Large squad — 10 players, 7 on field ----

  describe("8d: large squad late arrival (10 players, 7 on field, 4 games)", () => {
    const { players, ids } = squad(10);
    const perTeam = 7;
    const plan = generateInitialPlan({ players, playersPerTeam: perTeam, numberOfGames: 4 });
    const latePlayer = "p1";
    const events: RotationEvent[] = [
      { type: "late", playerId: latePlayer },
      { type: "joined", playerId: latePlayer, duringGame: 1 },
    ];

    it("late player is on field from game 2 through game 4", () => {
      const result = applyEvents(plan, events, ids, perTeam, 1);
      for (let g = 1; g < result.games.length; g++) {
        expect(result.games[g].onField).toContain(latePlayer);
      }
    });

    it("sub recommendations in game 2 and 3 never target the late player first", () => {
      const result = applyEvents(plan, events, ids, perTeam, 1);

      for (const gameNum of [2, 3]) {
        const unavailable = getUnavailableForGame(gameNum, ids, events);
        const candidates = getSubCandidates(result, gameNum, unavailable, events);
        if (candidates) {
          expect(candidates.fieldRanked[0]).not.toBe(latePlayer);
        }
      }
    });
  });

  // ---- 8e: Two late players — both should be prioritised ----

  describe("8e: two late players (9 players, 7 on field, 3 games)", () => {
    const { players, ids } = squad(9);
    const perTeam = 7;
    const plan = generateInitialPlan({ players, playersPerTeam: perTeam, numberOfGames: 3 });
    const late1 = "p1";
    const late2 = "p2";
    const events: RotationEvent[] = [
      { type: "late", playerId: late1 },
      { type: "joined", playerId: late1, duringGame: 1 },
      { type: "late", playerId: late2 },
      { type: "joined", playerId: late2, duringGame: 1 },
    ];

    it("both late players are on field in game 2", () => {
      const result = applyEvents(plan, events, ids, perTeam, 2);
      expect(result.games[1].onField).toContain(late1);
      expect(result.games[1].onField).toContain(late2);
    });

    it("neither late player is the first sub-off recommendation in game 2", () => {
      const result = applyEvents(plan, events, ids, perTeam, 2);
      const unavailable = getUnavailableForGame(2, ids, events);
      const candidates = getSubCandidates(result, 2, unavailable, events);

      if (candidates) {
        expect(candidates.fieldRanked[0]).not.toBe(late1);
        expect(candidates.fieldRanked[0]).not.toBe(late2);
      }
    });
  });
});
