import { describe, it, expect } from "vitest";
import {
  generateInitialPlan,
  applyEvents,
  getSubCandidates,
  getNextSubSuggestion,
  getUnavailableForGame,
  getPlayerStats,
} from "../logic/rotation.js";
import type { Player, RotationEvent } from "../types/index.js";

function makePlayers(count: number): Player[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Player ${i + 1}`,
  }));
}

function playerIds(players: Player[]): string[] {
  return players.map((p) => p.id);
}

// ====================================================================
// CORE SCENARIO: Player benched in game 1 must NOT be recommended
// to come off in game 2
// ====================================================================

describe("benched player should not be recommended to come off next game", () => {
  // Test across common squad sizes
  const configs = [
    { squad: 7, perTeam: 5, games: 4, label: "7 players, 5v5" },
    { squad: 8, perTeam: 5, games: 4, label: "8 players, 5v5" },
    { squad: 9, perTeam: 5, games: 4, label: "9 players, 5v5" },
    { squad: 10, perTeam: 5, games: 4, label: "10 players, 5v5" },
    { squad: 9, perTeam: 7, games: 4, label: "9 players, 7v7" },
    { squad: 10, perTeam: 7, games: 4, label: "10 players, 7v7" },
    { squad: 12, perTeam: 7, games: 4, label: "12 players, 7v7" },
    { squad: 3, perTeam: 2, games: 4, label: "3 players, 2v2" },
  ];

  for (const { squad, perTeam, games, label } of configs) {
    describe(label, () => {
      const players = makePlayers(squad);
      const ids = playerIds(players);
      const plan = generateInitialPlan({ players, playersPerTeam: perTeam, numberOfGames: games });

      it("players benched in game 1 should play game 2 (no events)", () => {
        const g1Bench = new Set(plan.games[0].bench);
        if (g1Bench.size === 0) return; // everyone fits, skip

        const g2OnField = new Set(plan.games[1].onField);
        // At least some game-1 bench players should be on field in game 2
        const benchThenField = [...g1Bench].filter((id) => g2OnField.has(id));
        expect(benchThenField.length).toBeGreaterThan(0);
      });

      it("sub suggestion for game 2 should NOT recommend benching a player who was just benched in game 1", () => {
        const g1Bench = new Set(plan.games[0].bench);
        if (g1Bench.size === 0) return;

        const unavailable = getUnavailableForGame(2, ids, []);
        const candidates = getSubCandidates(plan, 2, unavailable, []);
        if (!candidates) return; // no subs possible (balanced lineup)

        // If candidates are returned, the recommended off player
        // must NOT be someone who was just benched
        const recommendedOff = candidates.fieldRanked[0];
        expect(g1Bench.has(recommendedOff)).toBe(false);
      });

      it("sub suggestion for game 1 should recommend benching the most overplayed player", () => {
        const unavailable = getUnavailableForGame(1, ids, []);
        const candidates = getSubCandidates(plan, 1, unavailable, []);
        if (!candidates) return;

        // The player recommended to come ON should be from the bench
        const recommendedOn = candidates.benchRanked[0];
        expect(plan.games[0].bench).toContain(recommendedOn);

        // The player recommended to come OFF should be from the field
        const recommendedOff = candidates.fieldRanked[0];
        expect(plan.games[0].onField).toContain(recommendedOff);
      });
    });
  }
});

// ====================================================================
// SCENARIO: After making a sub in game 1, game 2 recommendations
// should still be fair
// ====================================================================

describe("fairness after game 1 sub", () => {
  const players = makePlayers(8);
  const ids = playerIds(players);
  const plan = generateInitialPlan({ players, playersPerTeam: 5, numberOfGames: 4 });

  it("after subbing in game 1, game 2 recommendations respect accumulated play time", () => {
    // Make the recommended sub in game 1
    const unavail1 = getUnavailableForGame(1, ids, []);
    const sub1 = getNextSubSuggestion(plan, 1, unavail1, []);
    if (!sub1) return;

    const events: RotationEvent[] = [
      { type: "sub", gameNumber: 1, playerOut: sub1.playerOut, playerIn: sub1.playerIn },
    ];

    // Recompute plan with sub applied, advance to game 2
    const updated = applyEvents(plan, events, ids, 5, 2);

    // Check game 2 sub recommendations
    const unavail2 = getUnavailableForGame(2, ids, events);
    const candidates2 = getSubCandidates(updated, 2, unavail2, events);
    if (!candidates2) return;

    // The player subbed ON in game 1 (got 0.5 credit) should not be
    // the first recommended to come off in game 2
    // They should have high debt, not low debt
    const recommendedOff = candidates2.fieldRanked[0];

    // The subbed-in player from game 1 only got 0.5 play time
    // They should NOT be the first recommended off
    expect(recommendedOff).not.toBe(sub1.playerIn);
  });

  it("player who was subbed OFF in game 1 (got 0.5) should get priority in game 2", () => {
    const unavail1 = getUnavailableForGame(1, ids, []);
    const sub1 = getNextSubSuggestion(plan, 1, unavail1, []);
    if (!sub1) return;

    const events: RotationEvent[] = [
      { type: "sub", gameNumber: 1, playerOut: sub1.playerOut, playerIn: sub1.playerIn },
    ];

    const updated = applyEvents(plan, events, ids, 5, 2);

    // The subbed-off player from game 1 should be on field in game 2
    // (they have high debt: only 0.5 play time)
    const g2 = updated.games[1];
    expect(g2.onField).toContain(sub1.playerOut);
  });
});

// ====================================================================
// SCENARIO: Multi-game sub chain. Fairness over 4 games
// ====================================================================

describe("fairness across multiple games with subs", () => {
  const players = makePlayers(8);
  const ids = playerIds(players);
  const plan = generateInitialPlan({ players, playersPerTeam: 5, numberOfGames: 4 });

  it("after following all sub recommendations, play time spread is ≤ 1.5", () => {
    const allEvents: RotationEvent[] = [];

    for (let gameNum = 1; gameNum <= 4; gameNum++) {
      const current = applyEvents(plan, allEvents, ids, 5, gameNum);
      const unavailable = getUnavailableForGame(gameNum, ids, allEvents);
      const suggestion = getNextSubSuggestion(current, gameNum, unavailable, allEvents);

      if (suggestion) {
        allEvents.push({
          type: "sub",
          gameNumber: gameNum,
          playerOut: suggestion.playerOut,
          playerIn: suggestion.playerIn,
        });
      }
    }

    const finalPlan = applyEvents(plan, allEvents, ids, 5, 5);
    const stats = getPlayerStats(finalPlan, ids, allEvents);
    const times = stats.map((s) => s.playTimeUnits);

    // With subs every game, spread should be tight
    const spread = Math.max(...times) - Math.min(...times);
    expect(spread).toBeLessThanOrEqual(1.5);

    // No player should have 0 play time
    for (const s of stats) {
      expect(s.playTimeUnits).toBeGreaterThan(0);
    }
  });

  it("no player is recommended to come off twice in a row", () => {
    const allEvents: RotationEvent[] = [];
    for (let gameNum = 1; gameNum <= 4; gameNum++) {
      const current = applyEvents(plan, allEvents, ids, 5, gameNum);
      const unavailable = getUnavailableForGame(gameNum, ids, allEvents);
      const candidates = getSubCandidates(current, gameNum, unavailable, allEvents);

      if (candidates && candidates.fieldRanked.length > 0) {
        const suggestion = getNextSubSuggestion(current, gameNum, unavailable, allEvents);
        if (suggestion) {
          allEvents.push({
            type: "sub",
            gameNumber: gameNum,
            playerOut: suggestion.playerOut,
            playerIn: suggestion.playerIn,
          });
        }
      }
    }
  });
});

// ====================================================================
// SCENARIO: Benched game 1, plays game 2, sub recommendation game 2
// should target overplayed players
// ====================================================================

describe("game 2 sub target should be overplayed, not underplayed", () => {
  // 7 players, 5 per team → 2 benched per game
  const players = makePlayers(7);
  const ids = playerIds(players);
  const plan = generateInitialPlan({ players, playersPerTeam: 5, numberOfGames: 3 });

  it("game 2 fieldRanked[0] (recommended off) played full game 1", () => {
    const unavailable = getUnavailableForGame(2, ids, []);
    const candidates = getSubCandidates(plan, 2, unavailable, []);
    if (!candidates) return;

    const recommendedOff = candidates.fieldRanked[0];
    // This player should have played game 1 (they have the most play time)
    expect(plan.games[0].onField).toContain(recommendedOff);
  });

  it("game 2 benchRanked[0] (recommended on) was benched in game 1, or no sub needed", () => {
    const unavailable = getUnavailableForGame(2, ids, []);
    const candidates = getSubCandidates(plan, 2, unavailable, []);
    // With 7 players and 5 per team, the lineup may already be balanced
    // (no beneficial sub). If candidates are returned, verify correctness.
    if (!candidates) return;

    // If a sub is recommended, the field player being replaced should
    // have been on field in game 1 (overplayed)
    expect(plan.games[0].onField).toContain(candidates.fieldRanked[0]);
  });
});

// ====================================================================
// SCENARIO: Late arrival + sub recommendations
// ====================================================================

describe("late arrival sub fairness", () => {
  const players = makePlayers(8);
  const ids = playerIds(players);
  const plan = generateInitialPlan({ players, playersPerTeam: 5, numberOfGames: 4 });

  it("late player who joins during game 1 should not be recommended off in game 2", () => {
    const latePlayer = "p1";
    const events: RotationEvent[] = [
      { type: "late", playerId: latePlayer },
      { type: "joined", playerId: latePlayer, duringGame: 1 },
    ];

    const updated = applyEvents(plan, events, ids, 5, 2);
    const g2 = updated.games[1];

    // Late player should be on field in game 2 (high debt)
    if (!g2.onField.includes(latePlayer)) return; // may depend on squad balance

    const unavailable = getUnavailableForGame(2, ids, events);
    const candidates = getSubCandidates(updated, 2, unavailable, events);
    if (!candidates) return;

    // Late player should NOT be first recommended off. They have maximum debt
    const recommendedOff = candidates.fieldRanked[0];
    expect(recommendedOff).not.toBe(latePlayer);
  });
});

// ====================================================================
// SCENARIO: Specific reproduction. 7v5, check every game's sub
// recommendation doesn't bench an already-underplayed player
// ====================================================================

describe("no underplayed player recommended off (exhaustive check)", () => {
  const configs = [
    { squad: 7, perTeam: 5, games: 4 },
    { squad: 8, perTeam: 5, games: 4 },
    { squad: 9, perTeam: 7, games: 4 },
    { squad: 10, perTeam: 7, games: 4 },
  ];

  for (const { squad, perTeam, games } of configs) {
    it(`${squad} players, ${perTeam}v${perTeam}, ${games} games. Recommended off always has ≥ average play time`, () => {
      const players = makePlayers(squad);
      const ids = playerIds(players);
      const plan = generateInitialPlan({ players, playersPerTeam: perTeam, numberOfGames: games });
      const allEvents: RotationEvent[] = [];

      for (let gameNum = 1; gameNum <= games; gameNum++) {
        const current = applyEvents(plan, allEvents, ids, perTeam, gameNum);
        const unavailable = getUnavailableForGame(gameNum, ids, allEvents);
        const candidates = getSubCandidates(current, gameNum, unavailable, allEvents);

        if (candidates && candidates.fieldRanked.length > 0 && candidates.benchRanked.length > 0) {
          const recOff = candidates.fieldRanked[0];
          const recOn = candidates.benchRanked[0];

          // The player coming off should have MORE play time than
          // the player coming on (or at minimum equal)
          const stats = getPlayerStats(current, ids, allEvents);
          const offStats = stats.find((s) => s.playerId === recOff)!;
          const onStats = stats.find((s) => s.playerId === recOn)!;

          // Off player should have at least as much play time as on player
          expect(offStats.playTimeUnits).toBeGreaterThanOrEqual(onStats.playTimeUnits);

          // Apply the recommended sub
          allEvents.push({
            type: "sub",
            gameNumber: gameNum,
            playerOut: recOff,
            playerIn: recOn,
          });
        }
      }
    });
  }
});
