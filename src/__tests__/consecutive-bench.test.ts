/**
 * Consecutive bench fairness tests
 *
 * These validate that no player is stuck on the bench across game boundaries.
 *
 * "Consecutive bench" means:
 *   - Benched full game N → benched start of game N+1
 *   - Subbed off second half of game N → benched start of game N+1
 *
 * Both are bad UX. A coach watching one child sit for 1.5+ games
 * would lose trust in the system.
 */

import { describe, it, expect } from "vitest";
import {
  generateInitialPlan,
  applyEvents,
  getNextSubSuggestion,
  getUnavailableForGame,
  getPlayerStats,
} from "../logic/rotation.js";
import type { Player, RotationEvent } from "../types/index.js";

function squad(count: number): { players: Player[]; ids: string[] } {
  const players = Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Player ${i + 1}`,
  }));
  return { players, ids: players.map((p) => p.id) };
}

// ====================================================================
// RULE 1: BASE ROTATION — NO CONSECUTIVE BENCH
//
// Without any events or subs, the generated plan should never bench
// the same player in two consecutive games.
// ====================================================================

describe("base rotation: no consecutive bench across games", () => {
  const configs = [
    { squad: 6, perTeam: 4, games: 6, label: "6p 4v" },
    { squad: 7, perTeam: 5, games: 6, label: "7p 5v" },
    { squad: 8, perTeam: 5, games: 6, label: "8p 5v" },
    { squad: 9, perTeam: 7, games: 6, label: "9p 7v" },
    { squad: 10, perTeam: 7, games: 6, label: "10p 7v" },
    { squad: 12, perTeam: 7, games: 6, label: "12p 7v" },
    { squad: 3, perTeam: 2, games: 6, label: "3p 2v" },
    { squad: 10, perTeam: 5, games: 6, label: "10p 5v" },
  ];

  for (const { squad: s, perTeam, games, label } of configs) {
    it(`${label} ${games} games: no player benched two games in a row`, () => {
      const { players } = squad(s);
      const benchCount = s - perTeam;
      if (benchCount === 0) return; // everyone fits

      const plan = generateInitialPlan({
        players, playersPerTeam: perTeam, numberOfGames: games,
      });

      for (let i = 0; i < plan.games.length - 1; i++) {
        const thisBench = new Set(plan.games[i].bench);
        const nextBench = new Set(plan.games[i + 1].bench);
        const consecutive = [...thisBench].filter((id) => nextBench.has(id));

        // Allow consecutive bench ONLY when mathematically unavoidable:
        // bench size > half the squad (everyone must bench eventually)
        const unavoidable = benchCount * 2 > s;
        if (!unavoidable) {
          expect(consecutive).toHaveLength(0);
        }
      }
    });
  }
});

// ====================================================================
// RULE 2: SUB-OFF → NEXT GAME BENCH
//
// If a player is subbed off during game N, they should NOT be benched
// at the start of game N+1. Being on the bench for 1.5+ games is
// unacceptable.
// ====================================================================

describe("sub-off continuity: subbed-off players must start next game", () => {
  const configs = [
    { squad: 6, perTeam: 4, games: 4, label: "6p 4v" },
    { squad: 7, perTeam: 5, games: 4, label: "7p 5v" },
    { squad: 8, perTeam: 5, games: 4, label: "8p 5v" },
    { squad: 9, perTeam: 7, games: 4, label: "9p 7v" },
    { squad: 10, perTeam: 7, games: 4, label: "10p 7v" },
    { squad: 12, perTeam: 7, games: 4, label: "12p 7v" },
    { squad: 3, perTeam: 2, games: 4, label: "3p 2v" },
    { squad: 10, perTeam: 5, games: 4, label: "10p 5v" },
  ];

  for (const { squad: s, perTeam, games, label } of configs) {
    it(`${label} ${games} games: player subbed off in game N starts game N+1`, () => {
      const { players, ids } = squad(s);
      if (s <= perTeam) return; // no bench

      const plan = generateInitialPlan({
        players, playersPerTeam: perTeam, numberOfGames: games,
      });

      const events: RotationEvent[] = [];

      for (let gameNum = 1; gameNum <= games; gameNum++) {
        const current = applyEvents(plan, events, ids, perTeam, gameNum);
        const unavail = getUnavailableForGame(gameNum, ids, events);
        const suggestion = getNextSubSuggestion(current, gameNum, unavail, events);

        if (suggestion) {
          events.push({
            type: "sub",
            gameNumber: gameNum,
            playerOut: suggestion.playerOut,
            playerIn: suggestion.playerIn,
          });
        }
      }

      // Now verify: every player subbed off should be on field next game
      const finalPlan = applyEvents(plan, events, ids, perTeam, games + 1);
      for (const e of events) {
        if (e.type !== "sub") continue;
        const nextGame = finalPlan.games.find(
          (g) => g.gameNumber === e.gameNumber + 1,
        );
        if (!nextGame) continue;

        expect(nextGame.onField).toContain(e.playerOut);
      }
    });
  }
});

// ====================================================================
// RULE 3: SUB BURDEN DISTRIBUTION
//
// No single player should be subbed off significantly more than others.
// The "burden" of coming off should be shared across the squad.
// ====================================================================

describe("sub burden: no player repeatedly targeted as sub-off", () => {
  const configs = [
    { squad: 7, perTeam: 5, games: 6, label: "7p 5v" },
    { squad: 8, perTeam: 5, games: 6, label: "8p 5v" },
    { squad: 9, perTeam: 7, games: 6, label: "9p 7v" },
    { squad: 10, perTeam: 7, games: 6, label: "10p 7v" },
    { squad: 10, perTeam: 5, games: 6, label: "10p 5v" },
  ];

  for (const { squad: s, perTeam, games, label } of configs) {
    it(`${label} ${games} games: max sub-off count per player ≤ ceil(games / squad_bench) + 1`, () => {
      const { players, ids } = squad(s);
      const benchSize = s - perTeam;
      if (benchSize === 0) return;

      const plan = generateInitialPlan({
        players, playersPerTeam: perTeam, numberOfGames: games,
      });

      const events: RotationEvent[] = [];
      const offCounts = new Map<string, number>();

      for (let gameNum = 1; gameNum <= games; gameNum++) {
        const current = applyEvents(plan, events, ids, perTeam, gameNum);
        const unavail = getUnavailableForGame(gameNum, ids, events);
        const suggestion = getNextSubSuggestion(current, gameNum, unavail, events);

        if (suggestion) {
          events.push({
            type: "sub",
            gameNumber: gameNum,
            playerOut: suggestion.playerOut,
            playerIn: suggestion.playerIn,
          });
          offCounts.set(
            suggestion.playerOut,
            (offCounts.get(suggestion.playerOut) ?? 0) + 1,
          );
        }
      }

      // The burden should be spread. No player should be subbed off
      // more than roughly their fair share + 1.
      const maxAllowed = Math.ceil(games / s) + 1;
      for (const [, count] of offCounts) {
        expect(count).toBeLessThanOrEqual(maxAllowed);
      }
    });
  }
});

// ====================================================================
// RULE 4: OVERALL FAIRNESS WITH SUBS
//
// After following all recommended subs, the play time spread should
// remain tight and no player should have zero time.
// ====================================================================

describe("overall fairness with recommended subs", () => {
  const configs = [
    { squad: 7, perTeam: 5, games: 4, label: "7p 5v 4g" },
    { squad: 8, perTeam: 5, games: 4, label: "8p 5v 4g" },
    { squad: 9, perTeam: 7, games: 4, label: "9p 7v 4g" },
    { squad: 10, perTeam: 7, games: 6, label: "10p 7v 6g" },
    { squad: 10, perTeam: 5, games: 6, label: "10p 5v 6g" },
  ];

  for (const { squad: s, perTeam, games, label } of configs) {
    it(`${label}: play time spread ≤ 1.5 and no player has zero`, () => {
      const { players, ids } = squad(s);
      const plan = generateInitialPlan({
        players, playersPerTeam: perTeam, numberOfGames: games,
      });

      const events: RotationEvent[] = [];

      for (let gameNum = 1; gameNum <= games; gameNum++) {
        const current = applyEvents(plan, events, ids, perTeam, gameNum);
        const unavail = getUnavailableForGame(gameNum, ids, events);
        const suggestion = getNextSubSuggestion(current, gameNum, unavail, events);
        if (suggestion) {
          events.push({
            type: "sub",
            gameNumber: gameNum,
            playerOut: suggestion.playerOut,
            playerIn: suggestion.playerIn,
          });
        }
      }

      const finalPlan = applyEvents(plan, events, ids, perTeam, games + 1);
      const stats = getPlayerStats(finalPlan, ids, events);

      for (const st of stats) {
        expect(st.playTimeUnits).toBeGreaterThan(0);
      }

      const times = stats.map((st) => st.playTimeUnits);
      const spread = Math.max(...times) - Math.min(...times);
      expect(spread).toBeLessThanOrEqual(1.5);
    });
  }
});

// ====================================================================
// RULE 5: SUB-OFF THEN SUB-TARGET NEXT GAME
//
// A player subbed off in game N should NOT be the first sub-off
// recommendation in game N+1. They just sat down — give someone
// else a turn.
// ====================================================================

describe("sub-off player not immediately targeted again", () => {
  const configs = [
    { squad: 7, perTeam: 5, games: 4, label: "7p 5v" },
    { squad: 8, perTeam: 5, games: 4, label: "8p 5v" },
    { squad: 9, perTeam: 7, games: 4, label: "9p 7v" },
    { squad: 10, perTeam: 7, games: 4, label: "10p 7v" },
  ];

  for (const { squad: s, perTeam, games, label } of configs) {
    it(`${label}: player subbed off in game N is not first fieldRanked in game N+1`, () => {
      const { players, ids } = squad(s);
      if (s <= perTeam) return;

      const plan = generateInitialPlan({
        players, playersPerTeam: perTeam, numberOfGames: games,
      });

      const events: RotationEvent[] = [];

      for (let gameNum = 1; gameNum <= games; gameNum++) {
        const current = applyEvents(plan, events, ids, perTeam, gameNum);
        const unavail = getUnavailableForGame(gameNum, ids, events);
        const suggestion = getNextSubSuggestion(current, gameNum, unavail, events);

        if (suggestion) {
          // Check: if this player was subbed off LAST game, fail
          const lastSub = [...events].reverse().find((e) => e.type === "sub");
          if (lastSub && lastSub.type === "sub" && gameNum > 1) {
            expect(suggestion.playerOut).not.toBe(lastSub.playerOut);
          }

          events.push({
            type: "sub",
            gameNumber: gameNum,
            playerOut: suggestion.playerOut,
            playerIn: suggestion.playerIn,
          });
        }
      }
    });
  }
});
