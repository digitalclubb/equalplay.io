import type { ValidationErrors } from "../types/index.js";
import { isMatchLength, MIN_MATCH_MINUTES, MAX_MATCH_MINUTES } from "./playingTime.js";

const MIN_PLAYERS = 2;

/** Validates form inputs, returns errors (empty object = valid) */
export function validateInputs(
  activePlayerCount: number,
  playersPerTeam: number,
  numberOfGames: number,
  /** Optional. Null means the coach has not said, which is allowed. */
  minutesPerMatch: number | null = null,
): ValidationErrors {
  const errors: ValidationErrors = {};

  if (activePlayerCount < MIN_PLAYERS) {
    errors.players = `At least ${MIN_PLAYERS} active players are required.`;
  }

  if (!Number.isFinite(playersPerTeam) || playersPerTeam < 1) {
    errors.playersPerTeam = "Must be at least 1.";
  } else if (activePlayerCount >= MIN_PLAYERS && playersPerTeam > activePlayerCount) {
    errors.playersPerTeam = `Cannot exceed active players (${activePlayerCount}).`;
  }

  if (!Number.isFinite(numberOfGames) || numberOfGames < 1) {
    errors.numberOfGames = "Must be at least 1.";
  }

  // Blank is fine and stays fine. A number outside this is a typo rather than a
  // match. It would go straight into a Half Game Rule verdict as well.
  if (minutesPerMatch !== null && !isMatchLength(minutesPerMatch)) {
    errors.minutesPerMatch = `Between ${MIN_MATCH_MINUTES} and ${MAX_MATCH_MINUTES}, or leave it blank.`;
  }

  return errors;
}

export function hasErrors(errors: ValidationErrors): boolean {
  return Object.keys(errors).length > 0;
}
