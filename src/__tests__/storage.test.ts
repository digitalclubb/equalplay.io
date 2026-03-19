import { describe, it, expect, beforeEach } from "vitest";
import { saveTeams, loadTeams, clearAllTeams } from "../logic/storage.js";
import type { SavedData, SavedTeam } from "../logic/storage.js";

function makeTeam(id: string, name: string): SavedTeam {
  return {
    id,
    name,
    players: [{ id: "p1", name: "Alice" }, { id: "p2", name: "Bob" }],
    playersPerTeam: 1,
    numberOfGames: 2,
    events: [],
    currentGame: 1,
    gameLabels: {},
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe("saveTeams + loadTeams", () => {
  it("round-trips data correctly", () => {
    const data: SavedData = {
      teams: [makeTeam("t1", "Team 1")],
      activeTeamId: "t1",
    };
    saveTeams(data);
    const loaded = loadTeams();

    expect(loaded).not.toBeNull();
    expect(loaded!.teams).toHaveLength(1);
    expect(loaded!.teams[0].name).toBe("Team 1");
    expect(loaded!.activeTeamId).toBe("t1");
  });

  it("preserves multiple teams", () => {
    const data: SavedData = {
      teams: [makeTeam("t1", "Team 1"), makeTeam("t2", "Team 2")],
      activeTeamId: "t2",
    };
    saveTeams(data);
    const loaded = loadTeams()!;

    expect(loaded.teams).toHaveLength(2);
    expect(loaded.activeTeamId).toBe("t2");
  });

  it("preserves events", () => {
    const team = makeTeam("t1", "Team 1");
    team.events = [
      { type: "late", playerId: "p1" },
      { type: "joined", playerId: "p1", duringGame: 1 },
    ];
    saveTeams({ teams: [team], activeTeamId: "t1" });
    const loaded = loadTeams()!;

    expect(loaded.teams[0].events).toHaveLength(2);
    expect(loaded.teams[0].events[0].type).toBe("late");
  });

  it("preserves game labels", () => {
    const team = makeTeam("t1", "Team 1");
    team.gameLabels = { "1": "Tigers", "2": "Lions" };
    saveTeams({ teams: [team], activeTeamId: "t1" });
    const loaded = loadTeams()!;

    expect(loaded.teams[0].gameLabels["1"]).toBe("Tigers");
  });
});

describe("loadTeams — empty storage", () => {
  it("returns null when nothing saved", () => {
    expect(loadTeams()).toBeNull();
  });
});

describe("loadTeams — legacy migration", () => {
  it("migrates old single-team format", () => {
    const legacyData = {
      players: [{ id: "p1", name: "Alice" }],
      playersPerTeam: 3,
      numberOfGames: 2,
      events: [{ type: "late", playerId: "p1" }],
      currentGame: 1,
      gameLabels: { "1": "vs Tigers" },
    };
    localStorage.setItem("equalplay_state", JSON.stringify(legacyData));

    const loaded = loadTeams();
    expect(loaded).not.toBeNull();
    expect(loaded!.teams).toHaveLength(1);
    expect(loaded!.teams[0].name).toBe("Team 1");
    expect(loaded!.teams[0].players[0].name).toBe("Alice");
    expect(loaded!.teams[0].events).toHaveLength(1);
    expect(loaded!.teams[0].gameLabels["1"]).toBe("vs Tigers");

    // Legacy key should be removed after migration
    expect(localStorage.getItem("equalplay_state")).toBeNull();
    // New key should be set
    expect(localStorage.getItem("equalplay_teams")).not.toBeNull();
  });

  it("handles legacy data with missing optional fields", () => {
    const legacyData = {
      players: [{ id: "p1", name: "Alice" }],
      playersPerTeam: 3,
      numberOfGames: 2,
      // events, currentGame, gameLabels all missing
    };
    localStorage.setItem("equalplay_state", JSON.stringify(legacyData));

    const loaded = loadTeams();
    expect(loaded).not.toBeNull();
    expect(loaded!.teams[0].events).toEqual([]);
    expect(loaded!.teams[0].currentGame).toBe(1);
    expect(loaded!.teams[0].gameLabels).toEqual({});
  });
});

describe("loadTeams — corrupt data", () => {
  it("returns null for invalid JSON", () => {
    localStorage.setItem("equalplay_teams", "not json");
    expect(loadTeams()).toBeNull();
  });

  it("returns null for empty teams array", () => {
    localStorage.setItem("equalplay_teams", JSON.stringify({ teams: [], activeTeamId: "" }));
    expect(loadTeams()).toBeNull();
  });

  it("returns null for wrong structure", () => {
    localStorage.setItem("equalplay_teams", JSON.stringify({ foo: "bar" }));
    expect(loadTeams()).toBeNull();
  });
});

describe("clearAllTeams", () => {
  it("removes both storage keys", () => {
    localStorage.setItem("equalplay_teams", "data");
    localStorage.setItem("equalplay_state", "legacy");
    clearAllTeams();
    expect(localStorage.getItem("equalplay_teams")).toBeNull();
    expect(localStorage.getItem("equalplay_state")).toBeNull();
  });
});
