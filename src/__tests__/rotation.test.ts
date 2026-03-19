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

// ---- Helpers ----

function makePlayers(count: number): Player[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Player ${i + 1}`,
  }));
}

function playerIds(players: Player[]): string[] {
  return players.map((p) => p.id);
}

// ---- generateInitialPlan ----

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

  it("assigns game numbers sequentially", () => {
    const plan = generateInitialPlan({
      players: makePlayers(6),
      playersPerTeam: 3,
      numberOfGames: 4,
    });
    expect(plan.games.map((g) => g.gameNumber)).toEqual([1, 2, 3, 4]);
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
    const min = Math.min(...values);
    const max = Math.max(...values);
    expect(max - min).toBeLessThanOrEqual(1);
  });

  it("avoids consecutive benching when possible", () => {
    const players = makePlayers(6);
    const plan = generateInitialPlan({
      players,
      playersPerTeam: 4,
      numberOfGames: 6,
    });

    // No player should be benched 3 games in a row
    for (const p of players) {
      let consecutiveBench = 0;
      for (const game of plan.games) {
        if (game.bench.includes(p.id)) {
          consecutiveBench++;
        } else {
          consecutiveBench = 0;
        }
        expect(consecutiveBench).toBeLessThanOrEqual(2);
      }
    }
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

  it("handles single game", () => {
    const plan = generateInitialPlan({
      players: makePlayers(8),
      playersPerTeam: 5,
      numberOfGames: 1,
    });
    expect(plan.games).toHaveLength(1);
    expect(plan.games[0].onField).toHaveLength(5);
    expect(plan.games[0].bench).toHaveLength(3);
  });
});

// ---- applyEvents: late + joined ----

describe("applyEvents — late player", () => {
  const players = makePlayers(5);
  const ids = playerIds(players);

  it("excludes late player from all games", () => {
    const plan = generateInitialPlan({ players, playersPerTeam: 3, numberOfGames: 3 });
    const events: RotationEvent[] = [{ type: "late", playerId: "p1" }];
    const result = applyEvents(plan, events, ids, 3, 1);

    for (const game of result.games) {
      expect(game.onField).not.toContain("p1");
      expect(game.bench).not.toContain("p1");
    }
  });

  it("late player appears in unavailable set", () => {
    const events: RotationEvent[] = [{ type: "late", playerId: "p1" }];
    const unavailable = getUnavailableForGame(1, ids, events);
    expect(unavailable.has("p1")).toBe(true);
  });
});

describe("applyEvents — late then joined", () => {
  const players = makePlayers(5);
  const ids = playerIds(players);

  it("joined player is excluded from past games", () => {
    const plan = generateInitialPlan({ players, playersPerTeam: 3, numberOfGames: 4 });
    const events: RotationEvent[] = [
      { type: "late", playerId: "p1" },
      { type: "joined", playerId: "p1" },
    ];
    // currentGame = 2 means game 1 is past
    const result = applyEvents(plan, events, ids, 3, 2);

    // Past game (game 1): p1 should NOT be on field
    expect(result.games[0].onField).not.toContain("p1");
  });

  it("joined player plays in future games (the critical bug fix)", () => {
    const plan = generateInitialPlan({ players, playersPerTeam: 3, numberOfGames: 4 });
    const events: RotationEvent[] = [
      { type: "late", playerId: "p1" },
      { type: "joined", playerId: "p1" },
    ];

    // Simulate: currentGame=1, p1 arrives during game 1
    const result1 = applyEvents(plan, events, ids, 3, 1);
    // p1 should be in future games (2, 3, 4) since they have high debt
    const futureGames = result1.games.filter((g) => g.gameNumber > 1);
    const p1OnField = futureGames.filter((g) => g.onField.includes("p1"));
    expect(p1OnField.length).toBeGreaterThan(0);
  });

  it("joined player stays on field after game advances (THE critical bug)", () => {
    const plan = generateInitialPlan({ players, playersPerTeam: 3, numberOfGames: 3 });
    const events: RotationEvent[] = [
      { type: "late", playerId: "p1" },
      { type: "joined", playerId: "p1" },
    ];

    // Step 1: currentGame=1, preview shows p1 in game 2
    const preview = applyEvents(plan, events, ids, 3, 1);
    const p1InGame2Preview = preview.games[1].onField.includes("p1");

    // Step 2: coach advances to game 2
    const afterAdvance = applyEvents(plan, events, ids, 3, 2);
    const p1InGame2Actual = afterAdvance.games[1].onField.includes("p1");

    // If preview showed p1 in game 2, it must STILL show p1 after advancing
    if (p1InGame2Preview) {
      expect(p1InGame2Actual).toBe(true);
    }
    // Regardless of preview, p1 should be on field for SOME game after advancing
    const futureOnField = afterAdvance.games
      .filter((g) => g.gameNumber >= 2)
      .some((g) => g.onField.includes("p1"));
    expect(futureOnField).toBe(true);
  });

  it("joined player is no longer unavailable", () => {
    const events: RotationEvent[] = [
      { type: "late", playerId: "p1" },
      { type: "joined", playerId: "p1" },
    ];
    const unavailable = getUnavailableForGame(2, ids, events);
    expect(unavailable.has("p1")).toBe(false);
  });
});

// ---- applyEvents: injured ----

describe("applyEvents — injured player", () => {
  const players = makePlayers(6);
  const ids = playerIds(players);

  it("injured player excluded from games after injury", () => {
    const plan = generateInitialPlan({ players, playersPerTeam: 4, numberOfGames: 4 });
    const events: RotationEvent[] = [
      { type: "injured", playerId: "p1", gameNumber: 2 },
    ];
    const result = applyEvents(plan, events, ids, 4, 1);

    // Games 3+ should not have p1
    for (const game of result.games) {
      if (game.gameNumber > 2) {
        expect(game.onField).not.toContain("p1");
        expect(game.bench).not.toContain("p1");
      }
    }
  });

  it("injured player appears in unavailable set for future games", () => {
    const events: RotationEvent[] = [
      { type: "injured", playerId: "p1", gameNumber: 2 },
    ];
    expect(getUnavailableForGame(3, ids, events).has("p1")).toBe(true);
    expect(getUnavailableForGame(2, ids, events).has("p1")).toBe(false);
  });
});

// ---- applyEvents: leaving early ----

describe("applyEvents — leaving early", () => {
  const players = makePlayers(6);
  const ids = playerIds(players);

  it("player excluded from games after their last game", () => {
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

  it("player still plays in games up to their leaving game", () => {
    const plan = generateInitialPlan({ players, playersPerTeam: 4, numberOfGames: 4 });
    const events: RotationEvent[] = [
      { type: "leaving", playerId: "p1", afterGame: 2 },
    ];
    const result = applyEvents(plan, events, ids, 4, 1);

    // p1 should appear in at least one of games 1-2
    const earlyGames = result.games.filter((g) => g.gameNumber <= 2);
    const p1Present = earlyGames.some(
      (g) => g.onField.includes("p1") || g.bench.includes("p1"),
    );
    expect(p1Present).toBe(true);
  });
});

// ---- applyEvents: substitutions ----

describe("applyEvents — substitutions", () => {
  const players = makePlayers(6);
  const ids = playerIds(players);

  it("sub event changes game lineup", () => {
    // Use a past game (Phase 1) where subs are applied after selection
    const plan = generateInitialPlan({ players, playersPerTeam: 4, numberOfGames: 2 });

    // Get the Phase 1 lineup for game 1 when currentGame=2 (game 1 is past)
    const baseline = applyEvents(plan, [], ids, 4, 2);
    const baseGame1 = baseline.games[0];
    const playerOut = baseGame1.onField[0];
    const playerIn = baseGame1.bench[0];

    // Apply sub to past game 1
    const events: RotationEvent[] = [
      { type: "sub", gameNumber: 1, playerOut, playerIn },
    ];
    const withSub = applyEvents(plan, events, ids, 4, 2);
    const subGame = withSub.games[0];

    expect(subGame.onField).toContain(playerIn);
    expect(subGame.bench).toContain(playerOut);
  });
});

// ---- getReplacements ----

describe("getReplacements", () => {
  it("suggests bench player for unavailable field player", () => {
    const game = {
      gameNumber: 1,
      onField: ["p1", "p2", "p3"],
      bench: ["p4", "p5"],
    };
    const unavailable = new Set(["p1"]);
    const suggestions = getReplacements(game, unavailable);

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].outPlayerId).toBe("p1");
    expect(suggestions[0].inPlayerId).toBe("p4");
  });

  it("returns null inPlayerId when no bench available", () => {
    const game = {
      gameNumber: 1,
      onField: ["p1", "p2"],
      bench: [],
    };
    const unavailable = new Set(["p1"]);
    const suggestions = getReplacements(game, unavailable);

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].inPlayerId).toBeNull();
  });

  it("returns empty array when no field players unavailable", () => {
    const game = {
      gameNumber: 1,
      onField: ["p1", "p2"],
      bench: ["p3"],
    };
    const suggestions = getReplacements(game, new Set());
    expect(suggestions).toHaveLength(0);
  });

  it("does not suggest unavailable bench players", () => {
    const game = {
      gameNumber: 1,
      onField: ["p1", "p2"],
      bench: ["p3", "p4"],
    };
    const unavailable = new Set(["p1", "p3"]);
    const suggestions = getReplacements(game, unavailable);

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].inPlayerId).toBe("p4");
  });
});

// ---- getNextSubSuggestion ----

describe("getNextSubSuggestion", () => {
  it("suggests a substitution when bench has players", () => {
    const players = makePlayers(6);
    const plan = generateInitialPlan({
      players,
      playersPerTeam: 4,
      numberOfGames: 3,
    });
    const suggestion = getNextSubSuggestion(plan, 1, new Set());

    expect(suggestion).not.toBeNull();
    expect(suggestion!.playerIn).toBeDefined();
    expect(suggestion!.playerOut).toBeDefined();
    expect(suggestion!.playerIn).not.toBe(suggestion!.playerOut);
  });

  it("returns null when bench is empty", () => {
    const players = makePlayers(5);
    const plan = generateInitialPlan({
      players,
      playersPerTeam: 5,
      numberOfGames: 2,
    });
    const suggestion = getNextSubSuggestion(plan, 1, new Set());
    expect(suggestion).toBeNull();
  });

  it("returns null when all bench players are unavailable", () => {
    const players = makePlayers(6);
    const plan = generateInitialPlan({
      players,
      playersPerTeam: 4,
      numberOfGames: 2,
    });
    const bench = new Set(plan.games[0].bench);
    const suggestion = getNextSubSuggestion(plan, 1, bench);
    expect(suggestion).toBeNull();
  });
});

// ---- getPlayerStats ----

describe("getPlayerStats", () => {
  it("returns stats for all players", () => {
    const players = makePlayers(8);
    const plan = generateInitialPlan({
      players,
      playersPerTeam: 5,
      numberOfGames: 3,
    });
    const stats = getPlayerStats(plan, playerIds(players));
    expect(stats).toHaveLength(8);
  });

  it("total play time across all players equals total slots", () => {
    const players = makePlayers(8);
    const plan = generateInitialPlan({
      players,
      playersPerTeam: 5,
      numberOfGames: 4,
    });
    const stats = getPlayerStats(plan, playerIds(players));
    const totalPlay = stats.reduce((sum, s) => sum + s.playTimeUnits, 0);
    // 5 per game * 4 games = 20 total slots
    expect(totalPlay).toBeCloseTo(20, 1);
  });

  it("fairness scores are close to zero for balanced plans", () => {
    const players = makePlayers(8);
    const plan = generateInitialPlan({
      players,
      playersPerTeam: 4,
      numberOfGames: 8,
    });
    const stats = getPlayerStats(plan, playerIds(players));

    for (const s of stats) {
      expect(Math.abs(s.fairnessScore)).toBeLessThan(1);
    }
  });
});

// ---- Fairness recovery scenarios ----

describe("fairness recovery", () => {
  it("late joiner gets prioritised in future games", () => {
    const players = makePlayers(6);
    const ids = playerIds(players);
    const plan = generateInitialPlan({
      players,
      playersPerTeam: 4,
      numberOfGames: 6,
    });

    const events: RotationEvent[] = [
      { type: "late", playerId: "p1" },
      { type: "joined", playerId: "p1" },
    ];

    // p1 missed game 1, joins during it. currentGame=1.
    const result = applyEvents(plan, events, ids, 4, 1);

    // Count how many future games p1 plays
    const futureGames = result.games.filter((g) => g.gameNumber > 1);
    const p1Games = futureGames.filter((g) => g.onField.includes("p1")).length;

    // p1 should play in at least half of future games to recover
    // (with 6 players and 4 per team, fair share is ~67% of games)
    expect(p1Games).toBeGreaterThanOrEqual(Math.floor(futureGames.length / 2));

    // p1 should NOT be permanently benched
    expect(p1Games).toBeGreaterThan(0);
  });

  it("leaving player's fairness is not penalised for missed games", () => {
    const players = makePlayers(8);
    const ids = playerIds(players);
    const plan = generateInitialPlan({
      players,
      playersPerTeam: 5,
      numberOfGames: 4,
    });

    const events: RotationEvent[] = [
      { type: "leaving", playerId: "p1", afterGame: 2 },
    ];

    const result = applyEvents(plan, events, ids, 5, 1);
    const stats = getPlayerStats(result, ids);
    const p1Stats = stats.find((s) => s.playerId === "p1")!;

    // p1's fairness score should not be strongly negative
    // (they're not penalised for games they couldn't attend)
    expect(p1Stats.fairnessScore).toBeGreaterThan(-1.5);
  });
});

// ---- Edge cases ----

describe("edge cases", () => {
  it("handles no events gracefully", () => {
    const players = makePlayers(6);
    const plan = generateInitialPlan({
      players,
      playersPerTeam: 4,
      numberOfGames: 3,
    });
    const result = applyEvents(plan, [], playerIds(players), 4, 1);
    expect(result.games).toHaveLength(3);
  });

  it("handles all players being late", () => {
    const players = makePlayers(4);
    const ids = playerIds(players);
    const plan = generateInitialPlan({
      players,
      playersPerTeam: 3,
      numberOfGames: 2,
    });
    const events: RotationEvent[] = ids.map((id) => ({ type: "late" as const, playerId: id }));
    const result = applyEvents(plan, events, ids, 3, 1);

    // All games should have empty lineups
    for (const game of result.games) {
      expect(game.onField).toHaveLength(0);
    }
  });

  it("handles playersPerTeam > available players gracefully", () => {
    const players = makePlayers(3);
    const plan = generateInitialPlan({
      players,
      playersPerTeam: 5,
      numberOfGames: 2,
    });
    // Only 3 players available but 5 per team requested
    // Should put all 3 on field without crashing
    for (const game of plan.games) {
      expect(game.onField.length).toBeLessThanOrEqual(3);
      expect(game.bench).toHaveLength(0);
    }
  });

  it("no player appears in both onField and bench", () => {
    const players = makePlayers(10);
    const plan = generateInitialPlan({
      players,
      playersPerTeam: 5,
      numberOfGames: 5,
    });
    for (const game of plan.games) {
      const overlap = game.onField.filter((id) => game.bench.includes(id));
      expect(overlap).toHaveLength(0);
    }
  });

  it("handles multiple events for the same player", () => {
    const players = makePlayers(6);
    const ids = playerIds(players);
    const plan = generateInitialPlan({
      players,
      playersPerTeam: 4,
      numberOfGames: 4,
    });

    // Player gets injured then cleared then injured again
    const events: RotationEvent[] = [
      { type: "injured", playerId: "p1", gameNumber: 1 },
      { type: "injured", playerId: "p1", gameNumber: 3 },
    ];
    const result = applyEvents(plan, events, ids, 4, 1);

    // Should use earliest injury (game 1)
    for (const game of result.games) {
      if (game.gameNumber > 1) {
        expect(game.onField).not.toContain("p1");
      }
    }
  });
});
