import type { ValidationErrors, GameSummary } from "../types/index.js";

const MIN_PLAYERS = 2;

/** Validates form inputs, returns errors (empty object = valid) */
export function validateInputs(
  activePlayerCount: number,
  playersPerTeam: number,
  numberOfGames: number,
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

  return errors;
}

export function hasErrors(errors: ValidationErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** Computes summary stats from valid inputs */
export function computeSummary(
  totalPlayers: number,
  playersOnField: number,
  numberOfGames: number,
): GameSummary {
  const totalSlots = playersOnField * numberOfGames;
  return {
    totalPlayers,
    playersOnField,
    benchPerGame: totalPlayers - playersOnField,
    totalSlots,
    avgPlaytime: totalSlots / totalPlayers,
    isEvenDistribution: totalSlots % totalPlayers === 0,
  };
}
