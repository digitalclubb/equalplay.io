import { describe, it, expect } from "vitest";
import { createForm } from "../components/form.js";
import { DEFAULT_PLAYERS_A_SIDE } from "../lib/squadSize.js";
import { TeamStore } from "../logic/teamState.js";
import { saveTeams, loadTeams } from "../logic/storage.js";

describe("form. Draft player names", () => {
  it("starts with 2 empty rows when no initial names provided", () => {
    const form = createForm(() => {});
    const rawNames = form.getRawNames();
    expect(rawNames).toHaveLength(2);
    expect(rawNames[0]).toBe("");
    expect(rawNames[1]).toBe("");
  });

  it("prepopulates inputs from initialNames", () => {
    const form = createForm(() => {}, ["Alice", "Bob", "Charlie"]);
    const rawNames = form.getRawNames();
    expect(rawNames).toHaveLength(3);
    expect(rawNames[0]).toBe("Alice");
    expect(rawNames[1]).toBe("Bob");
    expect(rawNames[2]).toBe("Charlie");
  });

  it("preserves empty rows in getRawNames", () => {
    const form = createForm(() => {}, ["Alice", "", "Charlie"]);
    const rawNames = form.getRawNames();
    expect(rawNames).toHaveLength(3);
    expect(rawNames[0]).toBe("Alice");
    expect(rawNames[1]).toBe("");
    expect(rawNames[2]).toBe("Charlie");
  });

  it("getPlayers excludes empty names", () => {
    const form = createForm(() => {}, ["Alice", "", "Charlie"]);
    const players = form.getPlayers();
    expect(players).toHaveLength(2);
    expect(players[0].name).toBe("Alice");
    expect(players[1].name).toBe("Charlie");
  });

  it("two forms created from same names are independent", () => {
    const names = ["Alice", "Bob"];
    const form1 = createForm(() => {}, names);
    const form2 = createForm(() => {}, []);

    expect(form1.getRawNames()).toEqual(["Alice", "Bob"]);
    expect(form2.getRawNames()).toEqual(["", ""]);
  });
});

/**
 * A new team starts on the grade the coach is browsing.
 *
 * Match day has no age picker of its own and never will: it is the one thing in
 * here that works with no account and no setup. So it reads what the hub already
 * knows. `createEmptyTeam` in `logic/teamState.ts` uses the same call, which is
 * the one a coach actually meets first.
 */
describe("form. Players a side follows the grade", () => {
  it("starts a U10 coach on eight a side", () => {
    localStorage.setItem("equalplay_age_group", "u10");
    const form = createForm(() => {});
    expect(form.getPlayersPerTeam()).toBe(8);
  });

  it("falls back to seven with no grade stored", () => {
    localStorage.removeItem("equalplay_age_group");
    expect(createForm(() => {}).getPlayersPerTeam()).toBe(DEFAULT_PLAYERS_A_SIDE);
  });

  it("falls back to seven on a grade it does not know", () => {
    // Storage is hand-editable and clubs share tablets. A grade from a future
    // season, or somebody's typo, must not put NaN in the box.
    localStorage.setItem("equalplay_age_group", "u14");
    expect(createForm(() => {}).getPlayersPerTeam()).toBe(DEFAULT_PLAYERS_A_SIDE);
    localStorage.removeItem("equalplay_age_group");
  });

  it("is the number a brand new squad starts on", () => {
    // The path a coach actually meets. The form is handed the team's settings,
    // so the default that matters is the one the team is born with.
    localStorage.setItem("equalplay_age_group", "u12");
    expect(new TeamStore().getActive().playersPerTeam).toBe(12);
    localStorage.removeItem("equalplay_age_group");
  });

  it("leaves a squad that was already saved alone", () => {
    // Going up a grade in September must not rewrite the squad on the phone.
    localStorage.setItem("equalplay_age_group", "u7");
    const store = new TeamStore();
    store.getActive().playersPerTeam = 9;
    saveTeams(store.buildSavedData());

    const restored = new TeamStore();
    restored.restoreFrom(loadTeams()!);
    expect(restored.getActive().playersPerTeam).toBe(9);
    localStorage.removeItem("equalplay_age_group");
  });
});
