import type {
  Game,
  RotationConfig,
  RotationEvent,
  RotationPlan,
  ReplacementSuggestion,
} from "../types/index.js";

/**
 * Generates a fair initial rotation plan using round-robin distribution.
 *
 * Algorithm:
 * 1. Sort player IDs into a stable order
 * 2. For each game, slide a window of `playersPerTeam` across the roster
 * 3. The window offset advances by `playersPerTeam` each game (wrapping)
 *
 * This ensures every player gets roughly equal field time. When the total
 * number of play slots (playersPerTeam * numberOfGames) doesn't divide
 * evenly by player count, some players will play at most 1 more game.
 */
export function generateInitialPlan(config: RotationConfig): RotationPlan {
  const { players, playersPerTeam, numberOfGames } = config;
  const ids = players.map((p) => p.id);

  const games: Game[] = [];
  for (let i = 0; i < numberOfGames; i++) {
    const onField = pickIds(ids, playersPerTeam, i * playersPerTeam);
    const onFieldSet = new Set(onField);
    const bench = ids.filter((id) => !onFieldSet.has(id));
    games.push({ gameNumber: i + 1, onField, bench });
  }

  return { games };
}

/**
 * Applies a list of events to a plan and returns a new plan.
 *
 * Late: player is removed from ALL games, entire plan recalculated
 *       with remaining players.
 *
 * Injured: for the specified game, player stays in the plan but is
 *          flagged (UI shows replacement suggestion via getReplacement).
 *          For all subsequent games, player is removed and remaining
 *          players are rebalanced.
 */
export function applyEvents(
  plan: RotationPlan,
  events: RotationEvent[],
  allPlayerIds: string[],
  playersPerTeam: number,
): RotationPlan {
  if (events.length === 0) return plan;

  // Collect IDs removed entirely (late players)
  const lateIds = new Set<string>();
  // Collect injuries keyed by game number
  const injuries = new Map<number, Set<string>>();

  for (const event of events) {
    if (event.type === "late") {
      lateIds.add(event.playerId);
    } else {
      if (!injuries.has(event.gameNumber)) {
        injuries.set(event.gameNumber, new Set());
      }
      injuries.get(event.gameNumber)!.add(event.playerId);
    }
  }

  // Start with all players minus late ones
  const availableIds = allPlayerIds.filter((id) => !lateIds.has(id));

  // Track which players become injured at which game
  // After their injury game, they're removed from future games
  const injuredFromGame = new Map<string, number>();
  for (const [gameNum, playerIds] of injuries) {
    for (const pid of playerIds) {
      const existing = injuredFromGame.get(pid);
      // If injured in multiple events, use the earliest game
      if (existing === undefined || gameNum < existing) {
        injuredFromGame.set(pid, gameNum);
      }
    }
  }

  const games: Game[] = [];
  for (let i = 0; i < plan.games.length; i++) {
    const gameNumber = i + 1;

    // Players available for this game: not late, not injured before this game
    const gameAvailable = availableIds.filter((id) => {
      const injuredAt = injuredFromGame.get(id);
      // Available if never injured, or injured in a later game
      return injuredAt === undefined || injuredAt >= gameNumber;
    });

    const effectivePerTeam = Math.min(playersPerTeam, gameAvailable.length);
    const onField = pickIds(gameAvailable, effectivePerTeam, i * effectivePerTeam);
    const onFieldSet = new Set(onField);
    const bench = gameAvailable.filter((id) => !onFieldSet.has(id));

    games.push({ gameNumber, onField, bench });
  }

  return { games };
}

/**
 * For a given game, returns replacement suggestions for unavailable
 * on-field players, pulling from bench players who are still available.
 */
export function getReplacements(
  game: Game,
  unavailableIds: Set<string>,
): ReplacementSuggestion[] {
  const needReplacement = game.onField.filter((id) => unavailableIds.has(id));
  if (needReplacement.length === 0) return [];

  const availableBench = game.bench.filter((id) => !unavailableIds.has(id));
  const used = new Set<string>();
  const suggestions: ReplacementSuggestion[] = [];

  for (const outId of needReplacement) {
    const replacement = availableBench.find((id) => !used.has(id));
    if (replacement) {
      used.add(replacement);
      suggestions.push({ outPlayerId: outId, inPlayerId: replacement });
    } else {
      suggestions.push({ outPlayerId: outId, inPlayerId: null });
    }
  }

  return suggestions;
}

/** Pick `count` IDs starting at `offset`, wrapping around */
function pickIds(ids: string[], count: number, offset: number): string[] {
  const result: string[] = [];
  const len = ids.length;
  for (let i = 0; i < count; i++) {
    result.push(ids[(offset + i) % len]);
  }
  return result;
}
