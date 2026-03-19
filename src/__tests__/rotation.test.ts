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
// THE EXACT BUG SCENARIO
// Players: A, B, C. 2 per team. 3 matches.
// A is late. A arrives during game 1. What happens at each step?
// ====================================================================

describe("CRITICAL: A,B,C — A late then joined during game 1", () => {
  const A = "p1", B = "p2", C = "p3";
  const players: Player[] = [
    { id: A, name: "A" },
    { id: B, name: "B" },
    { id: C, name: "C" },
  ];
  const ids = [A, B, C];
  const plan = generateInitialPlan({ players, playersPerTeam: 2, numberOfGames: 3 });
  const events: RotationEvent[] = [
    { type: "late", playerId: A },
    { type: "joined", playerId: A, duringGame: 1 },
  ];

  it("Step 1: currentGame=1 — A must be on bench for game 1 (arrived mid-game)", () => {
    const result = applyEvents(plan, events, ids, 2, 1);
    expect(result.games[0].onField).not.toContain(A);
    expect(result.games[0].bench).toContain(A);
    // B and C should be on field
    expect(result.games[0].onField).toContain(B);
    expect(result.games[0].onField).toContain(C);
  });

  it("Step 1: currentGame=1 — preview of game 2 shows A on field", () => {
    const result = applyEvents(plan, events, ids, 2, 1);
    expect(result.games[1].onField).toContain(A);
  });

  it("Step 2: coach advances to game 2 — A must be on field for game 2", () => {
    const result = applyEvents(plan, events, ids, 2, 2);
    expect(result.games[1].onField).toContain(A);
  });

  it("Step 2: preview and actual must match for game 2", () => {
    const preview = applyEvents(plan, events, ids, 2, 1);
    const actual = applyEvents(plan, events, ids, 2, 2);
    // A's position in game 2 must be the same in preview and after advancing
    const aInPreview = preview.games[1].onField.includes(A);
    const aInActual = actual.games[1].onField.includes(A);
    expect(aInPreview).toBe(true);
    expect(aInActual).toBe(true);
  });

  it("Step 3: coach advances to game 3 — preview and actual must match", () => {
    const preview = applyEvents(plan, events, ids, 2, 2);
    const actual = applyEvents(plan, events, ids, 2, 3);
    const game3Preview = preview.games[2].onField;
    const game3Actual = actual.games[2].onField;
    expect(game3Preview.sort()).toEqual(game3Actual.sort());
  });

  it("After all games: A should have played at least 1 game", () => {
    const result = applyEvents(plan, events, ids, 2, 4); // all completed
    const stats = getPlayerStats(result, ids);
    const aStats = stats.find((s) => s.playerId === A)!;
    expect(aStats.playTimeUnits).toBeGreaterThan(0);
  });

  it("After all games: play time is fair across all players", () => {
    const result = applyEvents(plan, events, ids, 2, 4);
    const stats = getPlayerStats(result, ids);
    const times = stats.map((s) => s.playTimeUnits);
    const min = Math.min(...times);
    const max = Math.max(...times);
    // A missed game 1 so can play games 2+3 = 2 games. B and C played game 1.
    // Fair: A=2, B=2, C=2 or A=1, B=2, C=3 etc. Max difference should be ≤ 2
    expect(max - min).toBeLessThanOrEqual(2);
    // A must have played at least 1
    expect(stats.find((s) => s.playerId === A)!.playTimeUnits).toBeGreaterThanOrEqual(1);
  });

  it("Game 1 always shows A on bench regardless of currentGame", () => {
    for (let cg = 1; cg <= 4; cg++) {
      const result = applyEvents(plan, events, ids, 2, cg);
      expect(result.games[0].onField).not.toContain(A);
    }
  });
});

// ====================================================================
// generateInitialPlan
// ====================================================================

describe("generateInitialPlan", () => {
  it("generates the correct number of games", () => {
    const plan = generateInitialPlan({
      players: makePlayers(8),
      playersPerTeam: 5,
      numberOfGames: 4,
    });
    expect(plan.games).toHaveLength(4);
  });

  it("puts exactly playersPerTeam on field per game", () => {
    const plan = generateInitialPlan({
      players: makePlayers(10),
      playersPerTeam: 5,
      numberOfGames: 3,
    });
    for (const game of plan.games) {
      expect(game.onField).toHaveLength(5);
    }
  });

  it("puts remaining players on bench", () => {
    const plan = generateInitialPlan({
      players: makePlayers(8),
      playersPerTeam: 5,
      numberOfGames: 3,
    });
    for (const game of plan.games) {
      expect(game.onField.length + game.bench.length).toBe(8);
    }
  });

  it("distributes play time fairly (max 1 game difference)", () => {
    const players = makePlayers(8);
    const plan = generateInitialPlan({
      players,
      playersPerTeam: 5,
      numberOfGames: 4,
    });

    const counts = new Map<string, number>();
    for (const p of players) counts.set(p.id, 0);
    for (const game of plan.games) {
      for (const id of game.onField) {
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    }

    const values = [...counts.values()];
    expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1);
  });

  it("handles all players on field (no bench)", () => {
    const plan = generateInitialPlan({
      players: makePlayers(5),
      playersPerTeam: 5,
      numberOfGames: 3,
    });
    for (const game of plan.games) {
      expect(game.onField).toHaveLength(5);
      expect(game.bench).toHaveLength(0);
    }
  });

  it("no player in both onField and bench", () => {
    const plan = generateInitialPlan({
      players: makePlayers(10),
      playersPerTeam: 5,
      numberOfGames: 5,
    });
    for (const game of plan.games) {
      const overlap = game.onField.filter((id) => game.bench.includes(id));
      expect(overlap).toHaveLength(0);
    }
  });
});

// ====================================================================
// Late player
// ====================================================================

describe("late player (not joined)", () => {
  const players = makePlayers(5);
  const ids = playerIds(players);

  it("excluded from all games", () => {
    const plan = generateInitialPlan({ players, playersPerTeam: 3, numberOfGames: 3 });
    const events: RotationEvent[] = [{ type: "late", playerId: "p1" }];
    const result = applyEvents(plan, events, ids, 3, 1);

    for (const game of result.games) {
      expect(game.onField).not.toContain("p1");
      expect(game.bench).not.toContain("p1");
    }
  });

  it("appears in unavailable set", () => {
    const events: RotationEvent[] = [{ type: "late", playerId: "p1" }];
    expect(getUnavailableForGame(1, ids, events).has("p1")).toBe(true);
  });
});

// ====================================================================
// Late then joined
// ====================================================================

describe("late then joined — general", () => {
  const players = makePlayers(5);
  const ids = playerIds(players);

  it("joined player excluded from current game field", () => {
    const plan = generateInitialPlan({ players, playersPerTeam: 3, numberOfGames: 4 });
    const events: RotationEvent[] = [
      { type: "late", playerId: "p1" },
      { type: "joined", playerId: "p1", duringGame: 1 },
    ];
    const result = applyEvents(plan, events, ids, 3, 1);
    expect(result.games[0].onField).not.toContain("p1");
  });

  it("joined player is on bench for current game (available for sub)", () => {
    const plan = generateInitialPlan({ players, playersPerTeam: 3, numberOfGames: 4 });
    const events: RotationEvent[] = [
      { type: "late", playerId: "p1" },
      { type: "joined", playerId: "p1", duringGame: 1 },
    ];
    const result = applyEvents(plan, events, ids, 3, 1);
    expect(result.games[0].bench).toContain("p1");
  });

  it("joined player plays in future games", () => {
    const plan = generateInitialPlan({ players, playersPerTeam: 3, numberOfGames: 4 });
    const events: RotationEvent[] = [
      { type: "late", playerId: "p1" },
      { type: "joined", playerId: "p1", duringGame: 1 },
    ];
    const result = applyEvents(plan, events, ids, 3, 1);
    const futureOnField = result.games
      .filter((g) => g.gameNumber > 1)
      .some((g) => g.onField.includes("p1"));
    expect(futureOnField).toBe(true);
  });

  it("no longer shows as unavailable", () => {
    const events: RotationEvent[] = [
      { type: "late", playerId: "p1" },
      { type: "joined", playerId: "p1", duringGame: 1 },
    ];
    expect(getUnavailableForGame(2, ids, events).has("p1")).toBe(false);
  });
});

// ====================================================================
// Injured
// ====================================================================

describe("injured player", () => {
  const players = makePlayers(6);
  const ids = playerIds(players);

  it("excluded from games after injury", () => {
    const plan = generateInitialPlan({ players, playersPerTeam: 4, numberOfGames: 4 });
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

  it("unavailable for future games", () => {
    const events: RotationEvent[] = [
      { type: "injured", playerId: "p1", gameNumber: 2 },
    ];
    expect(getUnavailableForGame(3, ids, events).has("p1")).toBe(true);
    expect(getUnavailableForGame(2, ids, events).has("p1")).toBe(false);
  });
});

// ====================================================================
// Leaving early
// ====================================================================

describe("leaving early", () => {
  const players = makePlayers(6);
  const ids = playerIds(players);

  it("excluded from games after leaving game", () => {
    const plan = generateInitialPlan({ players, playersPerTeam: 4, numberOfGames: 4 });
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
});

// ====================================================================
// Substitutions
// ====================================================================

describe("substitutions", () => {
  const players = makePlayers(6);
  const ids = playerIds(players);

  it("sub event swaps players", () => {
    const plan = generateInitialPlan({ players, playersPerTeam: 4, numberOfGames: 2 });
    // Get baseline to know who's where
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
// getReplacements
// ====================================================================

describe("getReplacements", () => {
  it("suggests bench player for unavailable field player", () => {
    const game = { gameNumber: 1, onField: ["p1", "p2", "p3"], bench: ["p4", "p5"] };
    const suggestions = getReplacements(game, new Set(["p1"]));
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].outPlayerId).toBe("p1");
    expect(suggestions[0].inPlayerId).toBe("p4");
  });

  it("returns null when no bench available", () => {
    const game = { gameNumber: 1, onField: ["p1", "p2"], bench: [] };
    const suggestions = getReplacements(game, new Set(["p1"]));
    expect(suggestions[0].inPlayerId).toBeNull();
  });

  it("returns empty when no one unavailable", () => {
    const game = { gameNumber: 1, onField: ["p1", "p2"], bench: ["p3"] };
    expect(getReplacements(game, new Set())).toHaveLength(0);
  });

  it("skips unavailable bench players", () => {
    const game = { gameNumber: 1, onField: ["p1", "p2"], bench: ["p3", "p4"] };
    const suggestions = getReplacements(game, new Set(["p1", "p3"]));
    expect(suggestions[0].inPlayerId).toBe("p4");
  });
});

// ====================================================================
// getNextSubSuggestion
// ====================================================================

describe("getNextSubSuggestion", () => {
  it("suggests when bench has players", () => {
    const plan = generateInitialPlan({ players: makePlayers(6), playersPerTeam: 4, numberOfGames: 3 });
    const s = getNextSubSuggestion(plan, 1, new Set());
    expect(s).not.toBeNull();
    expect(s!.playerIn).not.toBe(s!.playerOut);
  });

  it("returns null when bench is empty", () => {
    const plan = generateInitialPlan({ players: makePlayers(5), playersPerTeam: 5, numberOfGames: 2 });
    expect(getNextSubSuggestion(plan, 1, new Set())).toBeNull();
  });
});

// ====================================================================
// getPlayerStats
// ====================================================================

describe("getPlayerStats", () => {
  it("total play time equals total slots", () => {
    const players = makePlayers(8);
    const plan = generateInitialPlan({ players, playersPerTeam: 5, numberOfGames: 4 });
    const stats = getPlayerStats(plan, playerIds(players));
    const total = stats.reduce((sum, s) => sum + s.playTimeUnits, 0);
    expect(total).toBeCloseTo(20, 1);
  });
});

// ====================================================================
// Edge cases
// ====================================================================

describe("edge cases", () => {
  it("no events returns plan unchanged", () => {
    const plan = generateInitialPlan({ players: makePlayers(6), playersPerTeam: 4, numberOfGames: 3 });
    const result = applyEvents(plan, [], playerIds(makePlayers(6)), 4, 1);
    expect(result.games).toHaveLength(3);
  });

  it("all players late = empty lineups", () => {
    const players = makePlayers(4);
    const ids = playerIds(players);
    const plan = generateInitialPlan({ players, playersPerTeam: 3, numberOfGames: 2 });
    const events: RotationEvent[] = ids.map((id) => ({ type: "late" as const, playerId: id }));
    const result = applyEvents(plan, events, ids, 3, 1);
    for (const game of result.games) {
      expect(game.onField).toHaveLength(0);
    }
  });

  it("playersPerTeam > available players = all on field", () => {
    const plan = generateInitialPlan({ players: makePlayers(3), playersPerTeam: 5, numberOfGames: 2 });
    for (const game of plan.games) {
      expect(game.onField.length).toBeLessThanOrEqual(3);
      expect(game.bench).toHaveLength(0);
    }
  });

  it("multiple injuries for same player uses earliest", () => {
    const players = makePlayers(6);
    const ids = playerIds(players);
    const plan = generateInitialPlan({ players, playersPerTeam: 4, numberOfGames: 4 });
    const events: RotationEvent[] = [
      { type: "injured", playerId: "p1", gameNumber: 1 },
      { type: "injured", playerId: "p1", gameNumber: 3 },
    ];
    const result = applyEvents(plan, events, ids, 4, 1);
    for (const game of result.games) {
      if (game.gameNumber > 1) {
        expect(game.onField).not.toContain("p1");
      }
    }
  });
});
