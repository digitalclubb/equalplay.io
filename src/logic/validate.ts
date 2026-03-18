import type { ValidationErrors, GameSummary } from "../types/index.js";

const MIN_PLAYERS = 2;

/** Validates form inputs, returns errors (empty object = valid) */
export function validateInputs(
  names: string[],
  playersPerTeam: number,
  numberOfGames: number,
): ValidationErrors {
  const errors: ValidationErrors = {};

  if (names.length < MIN_PLAYERS) {
    errors.players = `At least ${MIN_PLAYERS} players are required.`;
  }

  if (!Number.isFinite(playersPerTeam) || playersPerTeam < 1) {
    errors.playersPerTeam = "Must be at least 1.";
  } else if (names.length >= MIN_PLAYERS && playersPerTeam > names.length) {
    errors.playersPerTeam = `Cannot exceed total players (${names.length}).`;
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
