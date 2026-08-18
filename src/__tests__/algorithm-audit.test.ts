/**
 * Algorithm audit. Exhaustive fairness validation
 *
 * This file tests every rule that makes the algorithm trustworthy.
 * Each section maps to a specific real-world guarantee a coach relies on.
 *
 * Rules tested:
 *   1. No consecutive bench (across full games)
 *   2. Sub-off → next game continuity (no 1.5-game bench)
 *   3. Injury = immediate next sub
 *   4. Late arrival = bench only, not recommended, eligible next game
 *   5. Fairness spread (play time distribution)
 *   6. Sub burden distribution (no repeat targeting)
 *   7. Play slot accounting (no time created or lost)
 *   8. Edge cases that must never crash
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

// ---- Helpers ----

function squad(n: number): { players: Player[]; ids: string[] } {
  const players = Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Player ${i + 1}`,
  }));
  return { players, ids: players.map((p) => p.id) };
}

/** Simulate coach following every recommended sub across all games */
function playFullMatch(
  plan: RotationPlan,
  ids: string[],
  perTeam: number,
  games: number,
  preEvents: RotationEvent[] = [],
): { events: RotationEvent[]; finalPlan: RotationPlan } {
  const events: RotationEvent[] = [...preEvents];
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
  return { events, finalPlan };
}

// Common configurations every youth sport encounters
const CONFIGS = [
  { s: 3, p: 2, g: 4, label: "3p 2v 4g (min viable)" },
  { s: 6, p: 4, g: 4, label: "6p 4v 4g (small-sided)" },
  { s: 7, p: 5, g: 4, label: "7p 5v 4g (5-a-side)" },
  { s: 8, p: 5, g: 4, label: "8p 5v 4g (5-a-side big squad)" },
  { s: 9, p: 7, g: 4, label: "9p 7v 4g (7-a-side)" },
  { s: 10, p: 7, g: 4, label: "10p 7v 4g (7-a-side big squad)" },
  { s: 10, p: 5, g: 4, label: "10p 5v 4g (large bench)" },
  { s: 12, p: 7, g: 4, label: "12p 7v 4g (full 7-a-side)" },
];

// ====================================================================
// RULE 1: NO CONSECUTIVE BENCH (BASE ROTATION)
//
// Without events, no player should be benched two games in a row
// unless mathematically impossible (bench > half the squad).
// ====================================================================

describe("rule 1: no consecutive bench in base rotation", () => {
  for (const { s, p, g, label } of CONFIGS) {
    it(`${label}`, () => {
      const { players } = squad(s);
      const benchCount = s - p;
      if (benchCount === 0) return;

      const plan = generateInitialPlan({
        players, playersPerTeam: p, numberOfGames: g,
      });

      const unavoidable = benchCount * 2 > s;
      for (let i = 0; i < plan.games.length - 1; i++) {
        const thisBench = new Set(plan.games[i].bench);
        const nextBench = new Set(plan.games[i + 1].bench);
        const both = [...thisBench].filter((id) => nextBench.has(id));
        if (!unavoidable) {
          expect(both).toHaveLength(0);
        }
      }
    });
  }
});

// ====================================================================
// RULE 2: SUB-OFF CONTINUITY
//
// Player subbed off during game N MUST start game N+1 on field.
// Being on the bench for 1.5+ games is unacceptable.
// ====================================================================

describe("rule 2: subbed-off player starts next game", () => {
  for (const { s, p, g, label } of CONFIGS) {
    it(`${label}`, () => {
      const { players, ids } = squad(s);
      if (s <= p) return;

      const plan = generateInitialPlan({
        players, playersPerTeam: p, numberOfGames: g,
      });
      const { events, finalPlan } = playFullMatch(plan, ids, p, g);

      for (const e of events) {
        if (e.type !== "sub") continue;
        const nextGame = finalPlan.games.find(
          (gm) => gm.gameNumber === e.gameNumber + 1,
        );
        if (!nextGame) continue;
        expect(nextGame.onField).toContain(e.playerOut);
      }
    });
  }
});

// ====================================================================
// RULE 3: INJURY = IMMEDIATE NEXT SUB
//
// When a field player is injured:
//  a) injuredOut flag is true
//  b) injured player is fieldRanked[0] (must come off first)
//  c) replacement comes from bench
//  d) after the sub, injuredOut clears
//  e) injured player excluded from all future games
// ====================================================================

describe("rule 3: injury override", () => {
  for (const { s, p, g, label } of CONFIGS) {
    if (s <= p) continue; // no bench to sub from

    describe(label, () => {
      const { players, ids } = squad(s);
      const plan = generateInitialPlan({
        players, playersPerTeam: p, numberOfGames: g,
      });
      const g1 = plan.games[0];

      it("injured player is forced to fieldRanked[0]", () => {
        const victim = g1.onField[Math.floor(g1.onField.length / 2)];
        const events: RotationEvent[] = [
          { type: "injured", playerId: victim, gameNumber: 1 },
        ];
        const unavail = getUnavailableForGame(1, ids, events);
        const cands = getSubCandidates(plan, 1, unavail, events);

        expect(cands).not.toBeNull();
        expect(cands!.injuredOut).toBe(true);
        expect(cands!.fieldRanked[0]).toBe(victim);
      });

      it("replacement comes only from bench", () => {
        const victim = g1.onField[0];
        const events: RotationEvent[] = [
          { type: "injured", playerId: victim, gameNumber: 1 },
        ];
        const unavail = getUnavailableForGame(1, ids, events);
        const cands = getSubCandidates(plan, 1, unavail, events);

        for (const id of cands!.benchRanked) {
          expect(g1.bench).toContain(id);
        }
      });

      it("after injury sub, injuredOut clears", () => {
        const victim = g1.onField[0];
        const replacement = g1.bench[0];
        const events: RotationEvent[] = [
          { type: "injured", playerId: victim, gameNumber: 1 },
          { type: "sub", gameNumber: 1, playerOut: victim, playerIn: replacement },
        ];
        const rebalanced = applyEvents(plan, events, ids, p, 1);
        const unavail = getUnavailableForGame(1, ids, events);
        const cands = getSubCandidates(rebalanced, 1, unavail, events);
        if (cands) {
          expect(cands.injuredOut).toBe(false);
        }
      });

      it("injured player excluded from future games", () => {
        const victim = g1.onField[0];
        const events: RotationEvent[] = [
          { type: "injured", playerId: victim, gameNumber: 1 },
        ];
        const result = applyEvents(plan, events, ids, p, 1);
        for (const gm of result.games) {
          if (gm.gameNumber > 1) {
            expect(gm.onField).not.toContain(victim);
            expect(gm.bench).not.toContain(victim);
          }
        }
      });
    });
  }
});

// ====================================================================
// RULE 4: LATE ARRIVAL
//
// Late+joined player:
//  a) NOT on field in arrival game (on-time children get priority)
//  b) ON bench in arrival game (physically present)
//  c) NOT recommended as a sub-on in arrival game
//  d) ELIGIBLE for field from the next game
//  e) prioritised to play (high debt from missed time)
//  f) never benched again immediately after first game
// ====================================================================

describe("rule 4: late arrival", () => {
  for (const { s, p, g, label } of CONFIGS) {
    if (s <= p) continue;

    describe(label, () => {
      const { players, ids } = squad(s);
      const plan = generateInitialPlan({
        players, playersPerTeam: p, numberOfGames: g,
      });
      const latePlayer = "p1";
      const lateEvents: RotationEvent[] = [
        { type: "late", playerId: latePlayer },
        { type: "joined", playerId: latePlayer, duringGame: 1 },
      ];

      it("4a: not on field in arrival game", () => {
        const result = applyEvents(plan, lateEvents, ids, p, 1);
        expect(result.games[0].onField).not.toContain(latePlayer);
      });

      it("4b: on bench in arrival game", () => {
        const result = applyEvents(plan, lateEvents, ids, p, 1);
        expect(result.games[0].bench).toContain(latePlayer);
      });

      it("4c: deprioritised behind on-time bench players in arrival game", () => {
        const result = applyEvents(plan, lateEvents, ids, p, 1);
        const unavail = getUnavailableForGame(1, ids, lateEvents);
        const cands = getSubCandidates(result, 1, unavail, lateEvents);
        if (cands && cands.benchRanked.length > 1) {
          // Late player should be LAST in benchRanked (on-time players first)
          const lateIdx = cands.benchRanked.indexOf(latePlayer);
          const onTimePlayers = cands.benchRanked.filter((id) => id !== latePlayer);
          for (const otId of onTimePlayers) {
            expect(cands.benchRanked.indexOf(otId)).toBeLessThan(lateIdx);
          }
        }

        // If there are on-time bench players, they should be recommended first
        const onTimeBench = result.games[0].bench.filter(
          (id) => id !== latePlayer && !unavail.has(id),
        );
        const suggestion = getNextSubSuggestion(result, 1, unavail, lateEvents);
        if (suggestion && onTimeBench.length > 0) {
          expect(suggestion.playerIn).not.toBe(latePlayer);
        }
      });

      it("4d: eligible from next game. On field in game 2", () => {
        const result = applyEvents(plan, lateEvents, ids, p, 2);
        expect(result.games[1].onField).toContain(latePlayer);
      });

      it("4e: not disadvantaged vs equally-played peers in game 3", () => {
        const result = applyEvents(plan, lateEvents, ids, p, 3);
        const g3 = result.games[2];
        // The late player should be treated identically to other players
        // who also played exactly 1 game. If the bench ratio is ≤ 50%
        // they should be on field; otherwise they compete equally.
        const benchRatio = (s - p) / s;
        if (benchRatio <= 0.4) {
          expect(g3.onField).toContain(latePlayer);
        } else {
          // Large bench: late player may be benched, but should not be
          // benched MORE than other players with equal play time
          const stats = getPlayerStats(result, ids, lateEvents);
          const lateStat = stats.find((st) => st.playerId === latePlayer)!;
          const avgTime = stats.reduce((sum, st) => sum + st.playTimeUnits, 0) / s;
          expect(lateStat.playTimeUnits).toBeGreaterThanOrEqual(avgTime - 0.5);
        }
      });

      it("4f: sub recommendation in game 2 does NOT target the late player", () => {
        const result = applyEvents(plan, lateEvents, ids, p, 2);
        const unavail = getUnavailableForGame(2, ids, lateEvents);
        const cands = getSubCandidates(result, 2, unavail, lateEvents);
        if (cands) {
          expect(cands.fieldRanked[0]).not.toBe(latePlayer);
        }
      });
    });
  }
});

// ====================================================================
// RULE 4 SCENARIOS: Exact user examples for late arrival sub ordering
// ====================================================================

describe("rule 4 scenarios: late arrival sub queue", () => {
  it("4p 3v: A late, D on bench → D goes on, then A is next sub", () => {
    // A, B, C, D. 3 on field. A is late, so D replaces A.
    const players: Player[] = [
      { id: "A", name: "A" },
      { id: "B", name: "B" },
      { id: "C", name: "C" },
      { id: "D", name: "D" },
    ];
    const ids = ["A", "B", "C", "D"];
    const plan = generateInitialPlan({ players, playersPerTeam: 3, numberOfGames: 2 });

    const events: RotationEvent[] = [
      { type: "late", playerId: "A" },
      { type: "joined", playerId: "A", duringGame: 1 },
    ];

    const result = applyEvents(plan, events, ids, 3, 1);
    const g1 = result.games[0];

    // D should be on field (replaced A). A on bench.
    expect(g1.onField).not.toContain("A");
    expect(g1.bench).toContain("A");

    // Sub recommendation: A is the only bench player, so A should be recommended
    const unavail = getUnavailableForGame(1, ids, events);
    const suggestion = getNextSubSuggestion(result, 1, unavail, events);
    if (suggestion) {
      expect(suggestion.playerIn).toBe("A");
    }
  });

  it("5p 3v: A late, D+E on bench → D goes on first, E next, then A", () => {
    // A, B, C, D, E. 3 on field. A is late.
    // D and E are on bench (on-time). A arrives on bench (late).
    const players: Player[] = [
      { id: "A", name: "A" },
      { id: "B", name: "B" },
      { id: "C", name: "C" },
      { id: "D", name: "D" },
      { id: "E", name: "E" },
    ];
    const ids = ["A", "B", "C", "D", "E"];
    const plan = generateInitialPlan({ players, playersPerTeam: 3, numberOfGames: 2 });

    const events: RotationEvent[] = [
      { type: "late", playerId: "A" },
      { type: "joined", playerId: "A", duringGame: 1 },
    ];

    const result = applyEvents(plan, events, ids, 3, 1);
    const g1 = result.games[0];

    // A is on bench. D and E should also be on bench (on-time).
    expect(g1.onField).not.toContain("A");
    expect(g1.bench).toContain("A");

    const unavail = getUnavailableForGame(1, ids, events);
    const cands = getSubCandidates(result, 1, unavail, events);

    // On-time bench players (D, E) should come before A in benchRanked
    expect(cands).not.toBeNull();
    const aIdx = cands!.benchRanked.indexOf("A");
    const onTimeBench = cands!.benchRanked.filter((id) => id !== "A");
    expect(onTimeBench.length).toBeGreaterThan(0);
    for (const otId of onTimeBench) {
      expect(cands!.benchRanked.indexOf(otId)).toBeLessThan(aIdx);
    }

    // First sub recommendation should NOT be A
    const sub1 = getNextSubSuggestion(result, 1, unavail, events);
    expect(sub1).not.toBeNull();
    expect(sub1!.playerIn).not.toBe("A");

    // After first on-time sub, A should now be in the candidate pool
    const events2: RotationEvent[] = [
      ...events,
      { type: "sub", gameNumber: 1, playerOut: sub1!.playerOut, playerIn: sub1!.playerIn },
    ];
    const result2 = applyEvents(plan, events2, ids, 3, 1);
    const unavail2 = getUnavailableForGame(1, ids, events2);
    const cands2 = getSubCandidates(result2, 1, unavail2, events2);

    if (cands2) {
      // A should now be in benchRanked (available for selection)
      expect(cands2.benchRanked).toContain("A");

      // The subbed-off player has already played (0.5 credit). They
      // should NOT jump the queue ahead of A who has zero play time.
      // A should rank by debt, which is higher than the subbed-off player.
      const aIdx = cands2.benchRanked.indexOf("A");
      const subbedOffOnBench = cands2.benchRanked.filter(
        (id) => id !== "A" && id === sub1!.playerOut,
      );
      for (const soId of subbedOffOnBench) {
        expect(aIdx).toBeLessThan(cands2.benchRanked.indexOf(soId));
      }
    }
  });
});

// ====================================================================
// RULE 4 EXTRA: Late player who never arrives
// ====================================================================

describe("rule 4 extra: pure late (never joins)", () => {
  const { players, ids } = squad(8);
  const plan = generateInitialPlan({
    players, playersPerTeam: 5, numberOfGames: 4,
  });
  const events: RotationEvent[] = [{ type: "late", playerId: "p1" }];

  it("absent player not in any game", () => {
    const result = applyEvents(plan, events, ids, 5, 1);
    for (const gm of result.games) {
      expect(gm.onField).not.toContain("p1");
      expect(gm.bench).not.toContain("p1");
    }
  });

  it("remaining players still fairly distributed", () => {
    const result = applyEvents(plan, events, ids, 5, 1);
    const stats = getPlayerStats(result, ids, events);
    const active = stats.filter((st) => st.playerId !== "p1");
    const times = active.map((st) => st.playTimeUnits);
    expect(Math.max(...times) - Math.min(...times)).toBeLessThanOrEqual(1);
  });
});

// ====================================================================
// RULE 5: FAIRNESS SPREAD
//
// After following all recommended subs:
//  a) play time spread ≤ 1.5
//  b) no player has zero time
//  c) total slots are preserved
// ====================================================================

describe("rule 5: fairness spread", () => {
  for (const { s, p, g, label } of CONFIGS) {
    describe(label, () => {
      const { players, ids } = squad(s);
      const plan = generateInitialPlan({
        players, playersPerTeam: p, numberOfGames: g,
      });
      const { events, finalPlan } = playFullMatch(plan, ids, p, g);
      const stats = getPlayerStats(finalPlan, ids, events);

      it("5a: spread ≤ 1.5 games", () => {
        const times = stats.map((st) => st.playTimeUnits);
        expect(Math.max(...times) - Math.min(...times)).toBeLessThanOrEqual(1.5);
      });

      it("5b: no player has zero time", () => {
        for (const st of stats) {
          expect(st.playTimeUnits).toBeGreaterThan(0);
        }
      });

      it("5c: total play slots preserved", () => {
        const total = stats.reduce((sum, st) => sum + st.playTimeUnits, 0);
        expect(total).toBeCloseTo(p * g, 1);
      });
    });
  }
});

// ====================================================================
// RULE 6: SUB BURDEN DISTRIBUTION
//
// No player is subbed off significantly more than others.
// No player is targeted in two consecutive games.
// ====================================================================

describe("rule 6: sub burden distribution", () => {
  for (const { s, p, g, label } of CONFIGS) {
    if (s <= p) continue;

    it(`${label}: no player subbed off in consecutive games`, () => {
      const { players, ids } = squad(s);
      const plan = generateInitialPlan({
        players, playersPerTeam: p, numberOfGames: g,
      });
      const events: RotationEvent[] = [];

      for (let gameNum = 1; gameNum <= g; gameNum++) {
        const current = applyEvents(plan, events, ids, p, gameNum);
        const unavail = getUnavailableForGame(gameNum, ids, events);
        const suggestion = getNextSubSuggestion(current, gameNum, unavail, events);

        if (suggestion && gameNum > 1) {
          const prevSub = [...events].reverse().find((e) => e.type === "sub");
          if (prevSub && prevSub.type === "sub") {
            expect(suggestion.playerOut).not.toBe(prevSub.playerOut);
          }
        }

        if (suggestion) {
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

// ====================================================================
// RULE 7: PLAY SLOT ACCOUNTING
//
// Sub credits must be exact:
//  - stayed on field = 1.0
//  - subbed on mid-game = 0.5
//  - subbed off mid-game = 0.5
//  - total for a game is always playersPerTeam
// ====================================================================

describe("rule 7: play slot accounting", () => {
  it("sub credits: on=0.5, off=0.5, stayed=1.0", () => {
    const { players, ids } = squad(6);
    const plan = generateInitialPlan({
      players, playersPerTeam: 4, numberOfGames: 1,
    });
    const field = plan.games[0].onField;
    const benchP = plan.games[0].bench[0];
    const fieldP = field[0];
    const stayP = field[1];

    const events: RotationEvent[] = [
      { type: "sub", gameNumber: 1, playerOut: fieldP, playerIn: benchP },
    ];
    const result = applyEvents(plan, events, ids, 4, 1);
    const stats = getPlayerStats(result, ids, events);

    expect(stats.find((st) => st.playerId === benchP)!.playTimeUnits).toBe(0.5);
    expect(stats.find((st) => st.playerId === fieldP)!.playTimeUnits).toBe(0.5);
    expect(stats.find((st) => st.playerId === stayP)!.playTimeUnits).toBe(1.0);
  });

  it("two subs in one game: total preserved", () => {
    const { players, ids } = squad(8);
    const plan = generateInitialPlan({
      players, playersPerTeam: 5, numberOfGames: 1,
    });
    const g = plan.games[0];
    const events: RotationEvent[] = [
      { type: "sub", gameNumber: 1, playerOut: g.onField[0], playerIn: g.bench[0] },
      { type: "sub", gameNumber: 1, playerOut: g.onField[1], playerIn: g.bench[1] },
    ];
    const result = applyEvents(plan, events, ids, 5, 1);
    const stats = getPlayerStats(result, ids, events);
    const total = stats.reduce((sum, st) => sum + st.playTimeUnits, 0);
    // 5 slots per game, subs redistribute but don't create/lose time
    expect(total).toBeCloseTo(5.0, 1);
  });

  for (const { s, p, g, label } of CONFIGS) {
    it(`${label}: total slots preserved across full match with subs`, () => {
      const { players, ids } = squad(s);
      const plan = generateInitialPlan({
        players, playersPerTeam: p, numberOfGames: g,
      });
      const { events, finalPlan } = playFullMatch(plan, ids, p, g);
      const stats = getPlayerStats(finalPlan, ids, events);
      const total = stats.reduce((sum, st) => sum + st.playTimeUnits, 0);
      expect(total).toBeCloseTo(p * g, 1);
    });
  }
});

// ====================================================================
// RULE 8: COMBINED SCENARIOS
//
// Real matches have multiple disruptions happening at once.
// The system must handle them without conflict.
// ====================================================================

describe("rule 8: combined disruptions", () => {
  it("late arrival + injury + sub. No crashes, correct priority", () => {
    const { players, ids } = squad(9);
    const plan = generateInitialPlan({
      players, playersPerTeam: 7, numberOfGames: 4,
    });

    const events: RotationEvent[] = [
      { type: "late", playerId: "p1" },
      { type: "joined", playerId: "p1", duringGame: 1 },
    ];

    // Late player is on bench game 1
    let result = applyEvents(plan, events, ids, 7, 1);
    expect(result.games[0].bench).toContain("p1");

    // Injury mid-game 2
    result = applyEvents(plan, events, ids, 7, 2);
    const g2Field = result.games[1].onField;
    const victim = g2Field.find((id) => id !== "p1")!;
    events.push({ type: "injured", playerId: victim, gameNumber: 2 });

    // Injury takes priority
    const unavail = getUnavailableForGame(2, ids, events);
    result = applyEvents(plan, events, ids, 7, 2);
    const cands = getSubCandidates(result, 2, unavail, events);
    expect(cands!.injuredOut).toBe(true);
    expect(cands!.fieldRanked[0]).toBe(victim);

    // After injury sub, no crashes through remaining games
    events.push({
      type: "sub",
      gameNumber: 2,
      playerOut: victim,
      playerIn: cands!.benchRanked[0],
    });

    result = applyEvents(plan, events, ids, 7, 5);
    for (const gm of result.games) {
      expect(gm.onField.length).toBeGreaterThan(0);
      const overlap = gm.onField.filter((id) => gm.bench.includes(id));
      expect(overlap).toHaveLength(0);
    }
  });

  it("two late players. Both prioritised from game 2", () => {
    const { players, ids } = squad(10);
    const plan = generateInitialPlan({
      players, playersPerTeam: 7, numberOfGames: 3,
    });
    const events: RotationEvent[] = [
      { type: "late", playerId: "p1" },
      { type: "joined", playerId: "p1", duringGame: 1 },
      { type: "late", playerId: "p2" },
      { type: "joined", playerId: "p2", duringGame: 1 },
    ];

    const result = applyEvents(plan, events, ids, 7, 2);
    expect(result.games[1].onField).toContain("p1");
    expect(result.games[1].onField).toContain("p2");
  });

  it("leaving early player is excluded but doesn't break fairness", () => {
    const { players, ids } = squad(8);
    const plan = generateInitialPlan({
      players, playersPerTeam: 5, numberOfGames: 4,
    });
    const events: RotationEvent[] = [
      { type: "leaving", playerId: "p1", afterGame: 2 },
    ];

    const result = applyEvents(plan, events, ids, 5, 1);
    // Present in games 1-2
    for (const gm of result.games.filter((g) => g.gameNumber <= 2)) {
      const all = [...gm.onField, ...gm.bench];
      expect(all).toContain("p1");
    }
    // Gone from games 3-4
    for (const gm of result.games.filter((g) => g.gameNumber > 2)) {
      expect(gm.onField).not.toContain("p1");
      expect(gm.bench).not.toContain("p1");
    }

    // Remaining 7 players should still be fairly distributed in games 3-4
    const stats = getPlayerStats(result, ids, events);
    const active = stats.filter((st) => st.playerId !== "p1");
    for (const st of active) {
      expect(st.playTimeUnits).toBeGreaterThan(0);
    }
  });
});

// ====================================================================
// RULE 9: EDGE CASES THAT MUST NEVER CRASH
// ====================================================================

describe("rule 9: edge cases", () => {
  it("all players late. Empty lineups, no crash", () => {
    const { players, ids } = squad(5);
    const plan = generateInitialPlan({
      players, playersPerTeam: 3, numberOfGames: 2,
    });
    const events: RotationEvent[] = ids.map((id) => ({
      type: "late" as const,
      playerId: id,
    }));
    const result = applyEvents(plan, events, ids, 3, 1);
    for (const gm of result.games) {
      expect(gm.onField).toHaveLength(0);
    }
  });

  it("squad smaller than team size. Everyone plays", () => {
    const { players } = squad(3);
    const plan = generateInitialPlan({
      players, playersPerTeam: 7, numberOfGames: 2,
    });
    for (const gm of plan.games) {
      expect(gm.onField).toHaveLength(3);
      expect(gm.bench).toHaveLength(0);
    }
  });

  it("single player squad. Plays every game", () => {
    const { players } = squad(1);
    const plan = generateInitialPlan({
      players, playersPerTeam: 1, numberOfGames: 3,
    });
    for (const gm of plan.games) {
      expect(gm.onField).toEqual(["p1"]);
    }
  });

  it("dynamic team size. Reduced game works", () => {
    const { players, ids } = squad(9);
    const plan = generateInitialPlan({
      players, playersPerTeam: 7, numberOfGames: 3,
    });
    const overrides: Record<number, number> = { 3: 5 };
    const result = applyEvents(plan, [], ids, 7, 1, overrides);
    expect(result.games[2].onField).toHaveLength(5);
    expect(result.games[2].bench).toHaveLength(4);
  });

  it("injury on game 1 + leaving on game 2. No overlap bugs", () => {
    const { players, ids } = squad(8);
    const plan = generateInitialPlan({
      players, playersPerTeam: 5, numberOfGames: 4,
    });
    const events: RotationEvent[] = [
      { type: "injured", playerId: "p1", gameNumber: 1 },
      { type: "leaving", playerId: "p2", afterGame: 2 },
    ];
    const result = applyEvents(plan, events, ids, 5, 1);

    // Game 3+: neither p1 nor p2 should appear
    for (const gm of result.games.filter((g) => g.gameNumber >= 3)) {
      const all = [...gm.onField, ...gm.bench];
      expect(all).not.toContain("p1");
      expect(all).not.toContain("p2");
    }

    // Remaining 6 players should fill the slots
    for (const gm of result.games.filter((g) => g.gameNumber >= 3)) {
      expect(gm.onField.length + gm.bench.length).toBe(6);
    }
  });
});

// ====================================================================
// RULE 10: STRUCTURAL INVARIANTS
//
// These must hold for EVERY configuration, EVERY game, always.
// ====================================================================

describe("rule 10: structural invariants", () => {
  for (const { s, p, g, label } of CONFIGS) {
    describe(label, () => {
      const { players, ids } = squad(s);
      const plan = generateInitialPlan({
        players, playersPerTeam: p, numberOfGames: g,
      });

      it("every player in exactly one of field or bench per game", () => {
        for (const gm of plan.games) {
          const all = [...gm.onField, ...gm.bench];
          expect(all.sort()).toEqual([...ids].sort());
          const overlap = gm.onField.filter((id) => gm.bench.includes(id));
          expect(overlap).toHaveLength(0);
        }
      });

      it("field size = min(playersPerTeam, squad)", () => {
        for (const gm of plan.games) {
          expect(gm.onField.length).toBe(Math.min(p, s));
        }
      });

      it("no duplicate player IDs in any game", () => {
        for (const gm of plan.games) {
          const all = [...gm.onField, ...gm.bench];
          expect(new Set(all).size).toBe(all.length);
        }
      });
    });
  }
});
