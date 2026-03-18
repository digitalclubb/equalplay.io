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
 * Applies events to a plan and returns a new plan.
 *
 * Late: player excluded from selection for all games.
 * Joined (after late): player re-enters the pool from `fromGameNumber` onward.
 * Injured: player stays in their injury game (UI shows replacement),
 *          removed from all subsequent games.
 *
 * Late players are NOT deleted from the plan — they remain visible in the
 * UI as greyed-out chips. The plan simply doesn't assign them to on-field
 * or bench slots.
 */
export function applyEvents(
  plan: RotationPlan,
  events: RotationEvent[],
  allPlayerIds: string[],
  playersPerTeam: number,
): RotationPlan {
  if (events.length === 0) return plan;

  // Build per-player availability windows
  const lateIds = new Set<string>();
  const joinedFrom = new Map<string, number>(); // playerId → fromGameNumber
  const injuredFrom = new Map<string, number>(); // playerId → gameNumber

  for (const event of events) {
    if (event.type === "late") {
      lateIds.add(event.playerId);
    } else if (event.type === "joined") {
      joinedFrom.set(event.playerId, event.fromGameNumber);
    } else {
      const existing = injuredFrom.get(event.playerId);
      if (existing === undefined || event.gameNumber < existing) {
        injuredFrom.set(event.playerId, event.gameNumber);
      }
    }
  }

  const games: Game[] = [];
  for (let i = 0; i < plan.games.length; i++) {
    const gameNumber = i + 1;

    const gameAvailable = allPlayerIds.filter((id) => {
      // Late and not yet joined
      if (lateIds.has(id)) {
        const joinAt = joinedFrom.get(id);
        if (joinAt === undefined || gameNumber < joinAt) return false;
      }
      // Injured in a previous game
      const injAt = injuredFrom.get(id);
      if (injAt !== undefined && gameNumber > injAt) return false;
      return true;
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
 * Returns the set of player IDs that are unavailable for a given game.
 * Used by the renderer to show greyed-out chips.
 */
export function getUnavailableForGame(
  gameNumber: number,
  allPlayerIds: string[],
  events: RotationEvent[],
): Set<string> {
  const result = new Set<string>();

  const lateIds = new Set<string>();
  const joinedFrom = new Map<string, number>();
  const injuredFrom = new Map<string, number>();

  for (const e of events) {
    if (e.type === "late") lateIds.add(e.playerId);
    else if (e.type === "joined") joinedFrom.set(e.playerId, e.fromGameNumber);
    else {
      const existing = injuredFrom.get(e.playerId);
      if (existing === undefined || e.gameNumber < existing) {
        injuredFrom.set(e.playerId, e.gameNumber);
      }
    }
  }

  for (const id of allPlayerIds) {
    if (lateIds.has(id)) {
      const joinAt = joinedFrom.get(id);
      if (joinAt === undefined || gameNumber < joinAt) {
        result.add(id);
        continue;
      }
    }
    const injAt = injuredFrom.get(id);
    if (injAt !== undefined && gameNumber > injAt) {
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
