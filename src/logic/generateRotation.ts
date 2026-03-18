import type {
  RotationConfig,
  RotationResult,
  Game,
  Player,
} from "../types/index.js";

/**
 * Generates a fair rotation schedule.
 *
 * TODO: Replace this stub with a real algorithm that:
 * - Distributes playing time evenly across all players
 * - Handles substitution timing based on SubstitutionType
 * - Ensures no player sits out disproportionately
 *
 * For now, returns mock data so the UI pipeline is testable end-to-end.
 */
export function generateRotation(config: RotationConfig): RotationResult {
  const { players, playersPerTeam, numberOfGames, substitutionType } = config;

  const games: Game[] = Array.from({ length: numberOfGames }, (_, i) => {
    // Simple round-robin: rotate who starts each game
    const offset = i * playersPerTeam;
    const starters = pickPlayers(players, playersPerTeam, offset);
    const bench = players.filter((p) => !starters.includes(p));

    return {
      gameNumber: i + 1,
      starters,
      bench,
      substitutions: [], // Stub — no subs generated yet
    };
  });

  return {
    games,
    playersPerTeam,
    totalPlayers: players.length,
    substitutionType,
  };
}

/** Pick `count` players starting at `offset`, wrapping around the roster */
function pickPlayers(
  players: Player[],
  count: number,
  offset: number,
): Player[] {
  const result: Player[] = [];
  for (let i = 0; i < count; i++) {
    result.push(players[(offset + i) % players.length]);
  }
  return result;
}
