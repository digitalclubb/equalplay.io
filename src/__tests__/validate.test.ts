import { describe, it, expect } from "vitest";
import { validateInputs, hasErrors } from "../logic/validate.js";

describe("validateInputs", () => {
  it("returns no errors for valid inputs", () => {
    const errors = validateInputs(8, 5, 3);
    expect(hasErrors(errors)).toBe(false);
  });

  it("requires at least 2 players", () => {
    const errors = validateInputs(1, 1, 1);
    expect(errors.players).toBeDefined();
    expect(hasErrors(errors)).toBe(true);
  });

  it("returns player error for 0 players", () => {
    const errors = validateInputs(0, 5, 3);
    expect(errors.players).toBeDefined();
  });

  it("requires playersPerTeam >= 1", () => {
    const errors = validateInputs(8, 0, 3);
    expect(errors.playersPerTeam).toBeDefined();
  });

  it("rejects NaN playersPerTeam", () => {
    const errors = validateInputs(8, NaN, 3);
    expect(errors.playersPerTeam).toBeDefined();
  });

  it("rejects Infinity playersPerTeam", () => {
    const errors = validateInputs(8, Infinity, 3);
    expect(errors.playersPerTeam).toBeDefined();
  });

  it("rejects playersPerTeam > player count", () => {
    const errors = validateInputs(3, 5, 3);
    expect(errors.playersPerTeam).toBeDefined();
  });

  it("allows playersPerTeam === player count", () => {
    const errors = validateInputs(5, 5, 3);
    expect(errors.playersPerTeam).toBeUndefined();
  });

  it("requires numberOfGames >= 1", () => {
    const errors = validateInputs(8, 5, 0);
    expect(errors.numberOfGames).toBeDefined();
  });

  it("rejects NaN numberOfGames", () => {
    const errors = validateInputs(8, 5, NaN);
    expect(errors.numberOfGames).toBeDefined();
  });

  it("returns multiple errors simultaneously", () => {
    const errors = validateInputs(1, 0, 0);
    expect(errors.players).toBeDefined();
    expect(errors.playersPerTeam).toBeDefined();
    expect(errors.numberOfGames).toBeDefined();
  });

  it("does not check playersPerTeam > players when players < 2", () => {
    // When players < MIN_PLAYERS, the playersPerTeam check should
    // not trigger the "cannot exceed" error (only the "must be >= 1" check)
    const errors = validateInputs(1, 5, 3);
    expect(errors.players).toBeDefined();
    // playersPerTeam should NOT have the "cannot exceed" error
    // because player count is below minimum
    expect(errors.playersPerTeam).toBeUndefined();
  });
});

describe("hasErrors", () => {
  it("returns false for empty object", () => {
    expect(hasErrors({})).toBe(false);
  });

  it("returns true when any field has an error", () => {
    expect(hasErrors({ players: "error" })).toBe(true);
  });
});
