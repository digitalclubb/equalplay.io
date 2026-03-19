import type {
  Game,
  PlayerStats,
  RotationConfig,
  RotationEvent,
  RotationPlan,
  ReplacementSuggestion,
} from "../types/index.js";

// ---- Fairness tracker ----

interface PlayerTracker {
  gamesPlayed: number;
  lastPlayedGame: number;
  /**
   * Sum of (playersPerTeam / availableCount) for each game this player
   * was in the available pool. Represents their "fair share" of play
   * time given their actual availability window.
   */
  expectedPlayTime: number;
}

function createTracker(): PlayerTracker {
  return { gamesPlayed: 0, lastPlayedGame: 0, expectedPlayTime: 0 };
}

/**
 * Fairness score: how far a player is from their expected play time.
 * Negative = underplayed (should be prioritised).
 * Positive = overplayed (should sit out).
 */
function fairnessScore(t: PlayerTracker): number {
  return t.gamesPlayed - t.expectedPlayTime;
}

/**
 * Selects the fairest `count` players from `available`.
 *
 * Sort order:
 * 1. Lowest fairness score (most underplayed gets priority)
 * 2. Longest since last played (break ties — whoever waited longest)
 *
 * This handles fairness recovery naturally: a player who missed games
 * due to late arrival has a lower expected, so their score is close
 * to zero — they're not artificially over-prioritised. A player who's
 * been available the whole time but got fewer games has a genuinely
 * negative score and gets strong priority.
 */
function selectOnField(
  available: string[],
  count: number,
  trackers: Map<string, PlayerTracker>,
): string[] {
  const sorted = [...available].sort((a, b) => {
    const ta = trackers.get(a) ?? createTracker();
    const tb = trackers.get(b) ?? createTracker();
    const scoreDiff = fairnessScore(ta) - fairnessScore(tb);
    if (Math.abs(scoreDiff) > 0.001) return scoreDiff;
    return ta.lastPlayedGame - tb.lastPlayedGame;
  });
  return sorted.slice(0, Math.min(count, sorted.length));
}

/**
 * Updates trackers after a game. Call this once per game after
 * determining who's on field.
 *
 * - On-field players: increment gamesPlayed and update lastPlayedGame
 * - All available players: increment expectedPlayTime by their
 *   fair share for this game (playersPerTeam / availableCount)
 */
function updateTrackers(
  trackers: Map<string, PlayerTracker>,
  onField: string[],
  available: string[],
  gameNumber: number,
  playersPerTeam: number,
): void {
  // Expected play rate for this game
  const rate = available.length > 0 ? playersPerTeam / available.length : 0;

  for (const id of available) {
    const t = trackers.get(id) ?? createTracker();
    t.expectedPlayTime += rate;
    trackers.set(id, t);
  }

  for (const id of onField) {
    const t = trackers.get(id) ?? createTracker();
    t.gamesPlayed++;
    t.lastPlayedGame = gameNumber;
    trackers.set(id, t);
  }
}

// ---- Plan generation ----

export function generateInitialPlan(config: RotationConfig): RotationPlan {
  const { players, playersPerTeam, numberOfGames } = config;
  const ids = players.map((p) => p.id);
  const trackers = new Map<string, PlayerTracker>();

  for (const id of ids) {
    trackers.set(id, createTracker());
  }

  const games: Game[] = [];
  for (let i = 0; i < numberOfGames; i++) {
    const gameNumber = i + 1;
    const onField = selectOnField(ids, playersPerTeam, trackers);
    const onFieldSet = new Set(onField);
    const bench = ids.filter((id) => !onFieldSet.has(id));

    updateTrackers(trackers, onField, ids, gameNumber, playersPerTeam);
    games.push({ gameNumber, onField, bench });
  }

  return { games };
}

// ---- Event resolution ----

interface ResolvedAvailability {
  lateIds: Set<string>;
  joinedIds: Set<string>;
  injuredFrom: Map<string, number>;
  subs: Map<number, Array<{ playerOut: string; playerIn: string }>>;
}

function resolveEvents(events: RotationEvent[]): ResolvedAvailability {
  const lateIds = new Set<string>();
  const joinedIds = new Set<string>();
  const injuredFrom = new Map<string, number>();
  const subs = new Map<number, Array<{ playerOut: string; playerIn: string }>>();

  for (const event of events) {
    if (event.type === "late") {
      lateIds.add(event.playerId);
    } else if (event.type === "joined") {
      joinedIds.add(event.playerId);
    } else if (event.type === "sub") {
      if (!subs.has(event.gameNumber)) subs.set(event.gameNumber, []);
      subs.get(event.gameNumber)!.push({
        playerOut: event.playerOut,
        playerIn: event.playerIn,
      });
    } else {
      const existing = injuredFrom.get(event.playerId);
      if (existing === undefined || event.gameNumber < existing) {
        injuredFrom.set(event.playerId, event.gameNumber);
      }
    }
  }

  return { lateIds, joinedIds, injuredFrom, subs };
}

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

// ---- Apply events ----

export function applyEvents(
  plan: RotationPlan,
  events: RotationEvent[],
  allPlayerIds: string[],
  playersPerTeam: number,
  currentGame: number,
): RotationPlan {
  if (events.length === 0) return plan;

  const resolved = resolveEvents(events);
  const trackers = new Map<string, PlayerTracker>();

  for (const id of allPlayerIds) {
    trackers.set(id, createTracker());
  }

  const games: Game[] = [];
  for (let i = 0; i < plan.games.length; i++) {
    const gameNumber = i + 1;

    const fieldAvailable = allPlayerIds.filter((id) => {
      if (gameNumber <= currentGame && resolved.joinedIds.has(id)) return false;
      return isAvailable(id, gameNumber, resolved);
    });

    const allAvailable = allPlayerIds.filter((id) =>
      isAvailable(id, gameNumber, resolved),
    );

    const onField = selectOnField(fieldAvailable, playersPerTeam, trackers);
    const onFieldSet = new Set(onField);

    const bench = allPlayerIds.filter(
      (id) => isAvailable(id, gameNumber, resolved) && !onFieldSet.has(id),
    );

    // Apply substitutions
    const gameSubs = resolved.subs.get(gameNumber);
    if (gameSubs) {
      for (const sub of gameSubs) {
        const outIdx = onField.indexOf(sub.playerOut);
        const inIdx = bench.indexOf(sub.playerIn);
        if (outIdx !== -1 && inIdx !== -1) {
          onField[outIdx] = sub.playerIn;
          bench[inIdx] = sub.playerOut;
        }
      }
    }

    // Update trackers with all available players (for expected) and on-field (for played)
    updateTrackers(trackers, onField, allAvailable, gameNumber, playersPerTeam);
    games.push({ gameNumber, onField, bench });
  }

  return { games };
}

// ---- Queries ----

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

/**
 * Suggests the next fair substitution using fairness scores.
 * Bench player with lowest score comes on, field player with
 * highest score comes off.
 */
export function getNextSubSuggestion(
  plan: RotationPlan,
  currentGameNumber: number,
  unavailableIds: Set<string>,
): { playerIn: string; playerOut: string } | null {
  const currentGame = plan.games.find((g) => g.gameNumber === currentGameNumber);
  if (!currentGame) return null;

  const availableBench = currentGame.bench.filter((id) => !unavailableIds.has(id));
  const availableField = currentGame.onField.filter((id) => !unavailableIds.has(id));
  if (availableBench.length === 0 || availableField.length === 0) return null;

  const trackers = new Map<string, PlayerTracker>();
  for (const game of plan.games) {
    if (game.gameNumber > currentGameNumber) break;
    const allInGame = [...game.onField, ...game.bench];
    const rate = allInGame.length > 0
      ? Math.min(game.onField.length, allInGame.length) / allInGame.length
      : 0;
    for (const id of allInGame) {
      const t = trackers.get(id) ?? createTracker();
      t.expectedPlayTime += rate;
      trackers.set(id, t);
    }
    for (const id of game.onField) {
      const t = trackers.get(id) ?? createTracker();
      t.gamesPlayed++;
      t.lastPlayedGame = game.gameNumber;
      trackers.set(id, t);
    }
  }

  // Bench player with lowest fairness score → comes on
  const playerIn = availableBench.reduce((best, id) => {
    const bestT = trackers.get(best) ?? createTracker();
    const thisT = trackers.get(id) ?? createTracker();
    const bestScore = fairnessScore(bestT);
    const thisScore = fairnessScore(thisT);
    if (Math.abs(thisScore - bestScore) > 0.001) {
      return thisScore < bestScore ? id : best;
    }
    return thisT.lastPlayedGame < bestT.lastPlayedGame ? id : best;
  });

  // Field player with highest fairness score → comes off
  const playerOut = availableField.reduce((best, id) => {
    const bestT = trackers.get(best) ?? createTracker();
    const thisT = trackers.get(id) ?? createTracker();
    const bestScore = fairnessScore(bestT);
    const thisScore = fairnessScore(thisT);
    if (Math.abs(thisScore - bestScore) > 0.001) {
      return thisScore > bestScore ? id : best;
    }
    return thisT.lastPlayedGame > bestT.lastPlayedGame ? id : best;
  });

  return { playerIn, playerOut };
}

/**
 * Computes per-player stats including fairness score.
 */
export function getPlayerStats(
  plan: RotationPlan,
  allPlayerIds: string[],
): PlayerStats[] {
  const trackers = new Map<string, PlayerTracker>();

  for (const id of allPlayerIds) {
    trackers.set(id, createTracker());
  }

  for (const game of plan.games) {
    const allInGame = [...game.onField, ...game.bench];
    const rate = allInGame.length > 0
      ? Math.min(game.onField.length, allInGame.length) / allInGame.length
      : 0;

    for (const id of allInGame) {
      const t = trackers.get(id) ?? createTracker();
      t.expectedPlayTime += rate;
      trackers.set(id, t);
    }

    for (const id of game.onField) {
      const t = trackers.get(id) ?? createTracker();
      t.gamesPlayed++;
      trackers.set(id, t);
    }
  }

  return allPlayerIds.map((id) => {
    const t = trackers.get(id) ?? createTracker();
    const gamesInPlan = plan.games.filter(
      (g) => g.onField.includes(id) || g.bench.includes(id),
    ).length;

    return {
      playerId: id,
      gamesPlayed: t.gamesPlayed,
      gamesBenched: gamesInPlan - t.gamesPlayed,
      fairnessScore: Math.round(fairnessScore(t) * 100) / 100,
    };
  });
}
