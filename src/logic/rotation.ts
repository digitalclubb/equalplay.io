import type {
  Game,
  RotationConfig,
  RotationEvent,
  RotationPlan,
  ReplacementSuggestion,
} from "../types/index.js";

/**
 * Generates a fair initial rotation plan using round-robin distribution.
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
 * Resolves events into availability sets for efficient per-game lookups.
 */
interface ResolvedAvailability {
  /** Players who are late and have NOT joined */
  lateIds: Set<string>;
  /** Players who were late but have now joined */
  joinedIds: Set<string>;
  /** Player ID → game number where injury occurred */
  injuredFrom: Map<string, number>;
}

function resolveEvents(events: RotationEvent[]): ResolvedAvailability {
  const lateIds = new Set<string>();
  const joinedIds = new Set<string>();
  const injuredFrom = new Map<string, number>();

  for (const event of events) {
    if (event.type === "late") {
      lateIds.add(event.playerId);
    } else if (event.type === "joined") {
      joinedIds.add(event.playerId);
    } else {
      const existing = injuredFrom.get(event.playerId);
      if (existing === undefined || event.gameNumber < existing) {
        injuredFrom.set(event.playerId, event.gameNumber);
      }
    }
  }

  return { lateIds, joinedIds, injuredFrom };
}

/** Check if a player is available for a specific game */
function isAvailable(
  id: string,
  gameNumber: number,
  resolved: ResolvedAvailability,
): boolean {
  if (resolved.lateIds.has(id) && !resolved.joinedIds.has(id)) {
    return false;
  }
  const injAt = resolved.injuredFrom.get(id);
  if (injAt !== undefined && gameNumber > injAt) {
    return false;
  }
  return true;
}

/**
 * Applies events to a plan and returns a new plan.
 *
 * Current game lineup is locked: joined players go to bench (available
 * for injury replacements) but do NOT displace anyone already on field.
 * Future games are fully recalculated to include joined players.
 */
export function applyEvents(
  plan: RotationPlan,
  events: RotationEvent[],
  allPlayerIds: string[],
  playersPerTeam: number,
  currentGame: number,
): RotationPlan {
  if (events.length === 0) return plan;

  const resolved = resolveEvents(events);

  const games: Game[] = [];
  for (let i = 0; i < plan.games.length; i++) {
    const gameNumber = i + 1;

    // For on-field selection: exclude joined players from current/past games.
    // This prevents a late arrival from displacing someone already playing.
    const fieldAvailable = allPlayerIds.filter((id) => {
      if (gameNumber <= currentGame && resolved.joinedIds.has(id)) return false;
      return isAvailable(id, gameNumber, resolved);
    });

    const effectivePerTeam = Math.min(playersPerTeam, fieldAvailable.length);
    const onField = pickIds(fieldAvailable, effectivePerTeam, i * effectivePerTeam);
    const onFieldSet = new Set(onField);

    // For bench: include ALL available players not on field (including joined).
    // This means joined players land on bench for the current game and are
    // available as injury replacements immediately.
    const bench = allPlayerIds.filter(
      (id) => isAvailable(id, gameNumber, resolved) && !onFieldSet.has(id),
    );

    games.push({ gameNumber, onField, bench });
  }

  return { games };
}

/**
 * Returns the set of player IDs unavailable for a given game.
 * Used by the renderer to show greyed-out chips.
 */
export function getUnavailableForGame(
  gameNumber: number,
  allPlayerIds: string[],
  events: RotationEvent[],
): Set<string> {
  const resolved = resolveEvents(events);
  const result = new Set<string>();

  for (const id of allPlayerIds) {
    if (!isAvailable(id, gameNumber, resolved)) {
      result.add(id);
    }
  }

  return result;
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
