import { describe, it, expect } from "vitest";
import {
  generateInitialPlan,
  applyEvents,
  getReplacements,
  getUnavailableForGame,
  getNextSubSuggestion,
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
// REAL-WORLD SCENARIO: Coach's matchday with 3 players, 2 per team
// This is the exact flow a coach follows in the app
// ====================================================================

describe("matchday scenario: A,B,C — 2 per team, 3 games", () => {
  const A = "p1", B = "p2", C = "p3";
  const players: Player[] = [
    { id: A, name: "A" },
    { id: B, name: "B" },
    { id: C, name: "C" },
  ];
  const ids = [A, B, C];
  const plan = generateInitialPlan({ players, playersPerTeam: 2, numberOfGames: 3 });

  describe("happy path: no events, complete all 3 games", () => {
    it("each player plays exactly 2 of 3 games", () => {
      const stats = getPlayerStats(plan, ids);
      for (const s of stats) {
        expect(s.playTimeUnits).toBe(2);
      }
    });

    it("total play slots = 6 (2 per team × 3 games)", () => {
      const stats = getPlayerStats(plan, ids);
      const total = stats.reduce((sum, s) => sum + s.playTimeUnits, 0);
      expect(total).toBe(6);
    });
  });

  describe("A is late, arrives during game 1", () => {
    const events: RotationEvent[] = [
      { type: "late", playerId: A },
      { type: "joined", playerId: A, duringGame: 1 },
    ];

    it("game 1: B and C play, A is on bench (not field)", () => {
      const result = applyEvents(plan, events, ids, 2, 1);
      expect(result.games[0].onField.sort()).toEqual([B, C].sort());
      expect(result.games[0].bench).toContain(A);
    });

    it("game 2 preview: A plays (they have the most debt)", () => {
      const result = applyEvents(plan, events, ids, 2, 1);
      expect(result.games[1].onField).toContain(A);
    });

    it("after advancing to game 2: A is STILL on field (not pushed back to bench)", () => {
      const result = applyEvents(plan, events, ids, 2, 2);
      expect(result.games[1].onField).toContain(A);
    });

    it("game 2 lineup is identical whether previewed or actually advanced to", () => {
      const preview = applyEvents(plan, events, ids, 2, 1);
      const actual = applyEvents(plan, events, ids, 2, 2);
      expect(preview.games[1].onField.sort()).toEqual(actual.games[1].onField.sort());
    });

    it("game 3 lineup is identical whether previewed from game 2 or advanced to", () => {
      const preview = applyEvents(plan, events, ids, 2, 2);
      const actual = applyEvents(plan, events, ids, 2, 3);
      expect(preview.games[2].onField.sort()).toEqual(actual.games[2].onField.sort());
    });

    it("after all 3 games complete: A played at least 1 game", () => {
      const result = applyEvents(plan, events, ids, 2, 4);
      const stats = getPlayerStats(result, ids);
      expect(stats.find((s) => s.playerId === A)!.playTimeUnits).toBeGreaterThanOrEqual(1);
    });

    it("game 1 always shows A on bench, regardless of which game is current", () => {
      for (let cg = 1; cg <= 4; cg++) {
        const result = applyEvents(plan, events, ids, 2, cg);
        expect(result.games[0].onField).not.toContain(A);
      }
    });
  });

  describe("subs every game: play time stays fair", () => {
    it("with recommended subs each game, max spread is ≤ 1.0", () => {
      const allEvents: RotationEvent[] = [];
      for (let gameNum = 1; gameNum <= 3; gameNum++) {
        const current = applyEvents(plan, allEvents, ids, 2, gameNum);
        const game = current.games[gameNum - 1];
        if (game.bench.length > 0) {
          allEvents.push({
            type: "sub",
            gameNumber: gameNum,
            playerOut: game.onField[0],
            playerIn: game.bench[0],
          });
        }
      }

      const finalPlan = applyEvents(plan, allEvents, ids, 2, 4);
      const stats = getPlayerStats(finalPlan, ids, allEvents);

      // Total slots must be preserved (6.0)
      const total = stats.reduce((sum, s) => sum + s.playTimeUnits, 0);
      expect(total).toBeCloseTo(6.0, 1);

      // No player left out
      for (const s of stats) {
        expect(s.playTimeUnits).toBeGreaterThan(0);
      }

      // Max spread ≤ 1.0 (half-game granularity)
      const times = stats.map((s) => s.playTimeUnits);
      expect(Math.max(...times) - Math.min(...times)).toBeLessThanOrEqual(1.0);
    });
  });
});

// ====================================================================
// generateInitialPlan — what a coach expects from the generated plan
// ====================================================================

describe("generateInitialPlan", () => {
  it("creates one game per requested match", () => {
    const plan = generateInitialPlan({
      players: makePlayers(8), playersPerTeam: 5, numberOfGames: 4,
    });
    expect(plan.games).toHaveLength(4);
  });

  it("puts the right number of players on field", () => {
    const plan = generateInitialPlan({
      players: makePlayers(10), playersPerTeam: 5, numberOfGames: 3,
    });
    for (const game of plan.games) {
      expect(game.onField).toHaveLength(5);
    }
  });

  it("everyone is either on field or on bench, no one missing", () => {
    const plan = generateInitialPlan({
      players: makePlayers(8), playersPerTeam: 5, numberOfGames: 3,
    });
    for (const game of plan.games) {
      expect(game.onField.length + game.bench.length).toBe(8);
    }
  });

  it("no player on field AND bench at the same time", () => {
    const plan = generateInitialPlan({
      players: makePlayers(10), playersPerTeam: 5, numberOfGames: 5,
    });
    for (const game of plan.games) {
      const overlap = game.onField.filter((id) => game.bench.includes(id));
      expect(overlap).toHaveLength(0);
    }
  });

  it("play time differs by at most 1 game across all players", () => {
    const players = makePlayers(8);
    const plan = generateInitialPlan({
      players, playersPerTeam: 5, numberOfGames: 4,
    });
    const counts = new Map<string, number>();
    for (const p of players) counts.set(p.id, 0);
    for (const game of plan.games) {
      for (const id of game.onField) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    const values = [...counts.values()];
    expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1);
  });

  it("when everyone fits on field, bench is empty", () => {
    const plan = generateInitialPlan({
      players: makePlayers(5), playersPerTeam: 5, numberOfGames: 3,
    });
    for (const game of plan.games) {
      expect(game.bench).toHaveLength(0);
    }
  });

  it("when squad is smaller than team size, puts everyone on field without crashing", () => {
    const plan = generateInitialPlan({
      players: makePlayers(3), playersPerTeam: 5, numberOfGames: 2,
    });
    for (const game of plan.games) {
      expect(game.onField).toHaveLength(3);
      expect(game.bench).toHaveLength(0);
    }
  });
});

// ====================================================================
// Late player (hasn't arrived at all)
// ====================================================================

describe("player marked late (never arrives)", () => {
  const players = makePlayers(5);
  const ids = playerIds(players);

  it("does not appear in any game (field or bench)", () => {
    const plan = generateInitialPlan({ players, playersPerTeam: 3, numberOfGames: 3 });
    const events: RotationEvent[] = [{ type: "late", playerId: "p1" }];
    const result = applyEvents(plan, events, ids, 3, 1);
    for (const game of result.games) {
      expect(game.onField).not.toContain("p1");
      expect(game.bench).not.toContain("p1");
    }
  });

  it("shows as unavailable", () => {
    const events: RotationEvent[] = [{ type: "late", playerId: "p1" }];
    expect(getUnavailableForGame(1, ids, events).has("p1")).toBe(true);
    expect(getUnavailableForGame(3, ids, events).has("p1")).toBe(true);
  });
});

// ====================================================================
// Late then joined — the arrival flow
// ====================================================================

describe("player arrives late (late then joined)", () => {
  const players = makePlayers(5);
  const ids = playerIds(players);
  const plan = generateInitialPlan({ players, playersPerTeam: 3, numberOfGames: 4 });
  const events: RotationEvent[] = [
    { type: "late", playerId: "p1" },
    { type: "joined", playerId: "p1", duringGame: 1 },
  ];

  it("is NOT on field for the game they arrived during", () => {
    const result = applyEvents(plan, events, ids, 3, 1);
    expect(result.games[0].onField).not.toContain("p1");
  });

  it("IS on bench for the game they arrived during (available for emergency sub)", () => {
    const result = applyEvents(plan, events, ids, 3, 1);
    expect(result.games[0].bench).toContain("p1");
  });

  it("plays in at least one future game", () => {
    const result = applyEvents(plan, events, ids, 3, 1);
    const futureOnField = result.games
      .filter((g) => g.gameNumber > 1)
      .some((g) => g.onField.includes("p1"));
    expect(futureOnField).toBe(true);
  });

  it("is not flagged as unavailable for future games", () => {
    expect(getUnavailableForGame(2, ids, events).has("p1")).toBe(false);
    expect(getUnavailableForGame(4, ids, events).has("p1")).toBe(false);
  });
});

// ====================================================================
// Injured player
// ====================================================================

describe("player gets injured", () => {
  const players = makePlayers(6);
  const ids = playerIds(players);
  const plan = generateInitialPlan({ players, playersPerTeam: 4, numberOfGames: 4 });

  it("is removed from all games AFTER the injury", () => {
    const events: RotationEvent[] = [
      { type: "injured", playerId: "p1", gameNumber: 2 },
    ];
    const result = applyEvents(plan, events, ids, 4, 1);
    for (const game of result.games) {
      if (game.gameNumber > 2) {
        expect(game.onField).not.toContain("p1");
        expect(game.bench).not.toContain("p1");
      }
    }
  });

  it("is available IN the injury game (not retroactively removed)", () => {
    const events: RotationEvent[] = [
      { type: "injured", playerId: "p1", gameNumber: 2 },
    ];
    expect(getUnavailableForGame(2, ids, events).has("p1")).toBe(false);
  });

  it("is unavailable for games after injury", () => {
    const events: RotationEvent[] = [
      { type: "injured", playerId: "p1", gameNumber: 2 },
    ];
    expect(getUnavailableForGame(3, ids, events).has("p1")).toBe(true);
  });
});

// ====================================================================
// Player leaving early
// ====================================================================

describe("player leaving early", () => {
  const players = makePlayers(6);
  const ids = playerIds(players);
  const plan = generateInitialPlan({ players, playersPerTeam: 4, numberOfGames: 4 });

  it("is removed from games after their last game", () => {
    const events: RotationEvent[] = [
      { type: "leaving", playerId: "p1", afterGame: 2 },
    ];
    const result = applyEvents(plan, events, ids, 4, 1);
    for (const game of result.games) {
      if (game.gameNumber > 2) {
        expect(game.onField).not.toContain("p1");
        expect(game.bench).not.toContain("p1");
      }
    }
  });

  it("still participates in games up to and including their last", () => {
    const events: RotationEvent[] = [
      { type: "leaving", playerId: "p1", afterGame: 2 },
    ];
    const result = applyEvents(plan, events, ids, 4, 1);
    const earlyGames = result.games.filter((g) => g.gameNumber <= 2);
    const present = earlyGames.some(
      (g) => g.onField.includes("p1") || g.bench.includes("p1"),
    );
    expect(present).toBe(true);
  });
});

// ====================================================================
// Substitutions
// ====================================================================

describe("substitutions", () => {
  const players = makePlayers(6);
  const ids = playerIds(players);

  it("swap actually changes who's on field vs bench", () => {
    const plan = generateInitialPlan({ players, playersPerTeam: 4, numberOfGames: 2 });
    const baseline = applyEvents(plan, [], ids, 4, 2);
    const g1 = baseline.games[0];
    const out = g1.onField[0];
    const inn = g1.bench[0];

    const events: RotationEvent[] = [
      { type: "sub", gameNumber: 1, playerOut: out, playerIn: inn },
    ];
    const result = applyEvents(plan, events, ids, 4, 2);
    expect(result.games[0].onField).toContain(inn);
    expect(result.games[0].bench).toContain(out);
  });
});

// ====================================================================
// getReplacements — injury replacement suggestions
// ====================================================================

describe("getReplacements", () => {
  it("suggests the first available bench player", () => {
    const game = { gameNumber: 1, onField: ["p1", "p2", "p3"], bench: ["p4", "p5"] };
    const suggestions = getReplacements(game, new Set(["p1"]));
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].outPlayerId).toBe("p1");
    expect(suggestions[0].inPlayerId).toBe("p4");
  });

  it("returns null replacement when bench is empty", () => {
    const game = { gameNumber: 1, onField: ["p1", "p2"], bench: [] };
    const suggestions = getReplacements(game, new Set(["p1"]));
    expect(suggestions[0].inPlayerId).toBeNull();
  });

  it("returns nothing when no one is unavailable", () => {
    const game = { gameNumber: 1, onField: ["p1", "p2"], bench: ["p3"] };
    expect(getReplacements(game, new Set())).toHaveLength(0);
  });

  it("skips bench players who are also unavailable", () => {
    const game = { gameNumber: 1, onField: ["p1", "p2"], bench: ["p3", "p4"] };
    const suggestions = getReplacements(game, new Set(["p1", "p3"]));
    expect(suggestions[0].inPlayerId).toBe("p4");
  });
});

// ====================================================================
// getNextSubSuggestion — the "Make sub" recommendation
// ====================================================================

describe("getNextSubSuggestion", () => {
  it("recommends a swap when bench has available players", () => {
    const plan = generateInitialPlan({ players: makePlayers(6), playersPerTeam: 4, numberOfGames: 3 });
    const s = getNextSubSuggestion(plan, 1, new Set());
    expect(s).not.toBeNull();
    expect(s!.playerIn).not.toBe(s!.playerOut);
  });

  it("returns null when everyone is on field (no bench)", () => {
    const plan = generateInitialPlan({ players: makePlayers(5), playersPerTeam: 5, numberOfGames: 2 });
    expect(getNextSubSuggestion(plan, 1, new Set())).toBeNull();
  });
});

// ====================================================================
// getPlayerStats — the "Playing time" display
// ====================================================================

describe("getPlayerStats", () => {
  it("total play time equals total slots (no subs)", () => {
    const players = makePlayers(8);
    const plan = generateInitialPlan({ players, playersPerTeam: 5, numberOfGames: 4 });
    const stats = getPlayerStats(plan, playerIds(players));
    const total = stats.reduce((sum, s) => sum + s.playTimeUnits, 0);
    // 5 per team × 4 games = 20 total play slots
    expect(total).toBeCloseTo(20, 1);
  });

  it("3 players, 2 per team, 3 games, no subs: everyone plays exactly 2", () => {
    const players: Player[] = [
      { id: "p1", name: "A" }, { id: "p2", name: "B" }, { id: "p3", name: "C" },
    ];
    const plan = generateInitialPlan({ players, playersPerTeam: 2, numberOfGames: 3 });
    const result = applyEvents(plan, [], ["p1", "p2", "p3"], 2, 4);
    const stats = getPlayerStats(result, ["p1", "p2", "p3"], []);
    for (const s of stats) {
      expect(s.playTimeUnits).toBe(2);
    }
  });

  it("sub credits: subbed-on = 0.5, subbed-off = 0.5, stayed = 1.0", () => {
    const players: Player[] = [
      { id: "p1", name: "A" }, { id: "p2", name: "B" }, { id: "p3", name: "C" },
    ];
    const plan = generateInitialPlan({ players, playersPerTeam: 2, numberOfGames: 1 });
    const field = plan.games[0].onField;
    const benchP = plan.games[0].bench[0];
    const fieldP = field[0];
    const stayP = field[1];

    const events: RotationEvent[] = [
      { type: "sub", gameNumber: 1, playerOut: fieldP, playerIn: benchP },
    ];
    const result = applyEvents(plan, events, ["p1", "p2", "p3"], 2, 1);
    const stats = getPlayerStats(result, ["p1", "p2", "p3"], events);

    expect(stats.find((s) => s.playerId === benchP)!.playTimeUnits).toBeCloseTo(0.5, 1);
    expect(stats.find((s) => s.playerId === fieldP)!.playTimeUnits).toBeCloseTo(0.5, 1);
    expect(stats.find((s) => s.playerId === stayP)!.playTimeUnits).toBeCloseTo(1.0, 1);
  });

  it("total play time is preserved even with subs (no time created or lost)", () => {
    const players: Player[] = [
      { id: "p1", name: "A" }, { id: "p2", name: "B" }, { id: "p3", name: "C" },
    ];
    const plan = generateInitialPlan({ players, playersPerTeam: 2, numberOfGames: 1 });
    const field = plan.games[0].onField;
    const benchP = plan.games[0].bench[0];

    const events: RotationEvent[] = [
      { type: "sub", gameNumber: 1, playerOut: field[0], playerIn: benchP },
    ];
    const result = applyEvents(plan, events, ["p1", "p2", "p3"], 2, 1);
    const stats = getPlayerStats(result, ["p1", "p2", "p3"], events);
    const total = stats.reduce((sum, s) => sum + s.playTimeUnits, 0);
    // 2 slots per game × 1 game = 2.0 total (0.5 + 0.5 + 1.0)
    expect(total).toBeCloseTo(2.0, 1);
  });
});

// ====================================================================
// Edge cases that should never crash
// ====================================================================

describe("edge cases", () => {
  it("no events: plan passes through unchanged", () => {
    const plan = generateInitialPlan({ players: makePlayers(6), playersPerTeam: 4, numberOfGames: 3 });
    const result = applyEvents(plan, [], playerIds(makePlayers(6)), 4, 1);
    expect(result.games).toHaveLength(3);
    expect(result.games[0].onField).toHaveLength(4);
  });

  it("every player is late: all lineups empty (not a crash)", () => {
    const players = makePlayers(4);
    const ids = playerIds(players);
    const plan = generateInitialPlan({ players, playersPerTeam: 3, numberOfGames: 2 });
    const events: RotationEvent[] = ids.map((id) => ({ type: "late" as const, playerId: id }));
    const result = applyEvents(plan, events, ids, 3, 1);
    for (const game of result.games) {
      expect(game.onField).toHaveLength(0);
    }
  });

  it("two injury events for same player: uses the earliest one", () => {
    const players = makePlayers(6);
    const ids = playerIds(players);
    const plan = generateInitialPlan({ players, playersPerTeam: 4, numberOfGames: 4 });
    const events: RotationEvent[] = [
      { type: "injured", playerId: "p1", gameNumber: 1 },
      { type: "injured", playerId: "p1", gameNumber: 3 },
    ];
    const result = applyEvents(plan, events, ids, 4, 1);
    // Injury in game 1 means p1 is out from game 2 onward
    for (const game of result.games) {
      if (game.gameNumber > 1) {
        expect(game.onField).not.toContain("p1");
      }
    }
  });
});
