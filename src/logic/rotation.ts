import type {
  Game,
  PlayerStats,
  RotationConfig,
  RotationEvent,
  RotationPlan,
  ReplacementSuggestion,
} from "../types/index.js";

// ---- Play time units ----
// Full game on field = 1.0
// Subbed on mid-game = 0.5
// Subbed off mid-game = 0.5
// On bench whole game = 0.0

const FULL_GAME = 1.0;
const SUB_APPEARANCE = 0.5;

// ---- Fairness tracker ----

interface PlayerTracker {
  playTimeUnits: number;
  lastPlayedGame: number;
  expectedPlayTime: number;
}

function createTracker(): PlayerTracker {
  return { playTimeUnits: 0, lastPlayedGame: 0, expectedPlayTime: 0 };
}

function fairnessScore(t: PlayerTracker): number {
  return t.playTimeUnits - t.expectedPlayTime;
}

/**
 * Selects the fairest `count` players from `available`.
 * Sorts by lowest fairness score, then longest since last played.
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
 * Computes play time credit for each player in a game.
 *
 * @param preSubOnField  - who was selected for on-field before subs
 * @param postSubOnField - who is on-field after subs applied
 * @returns map of playerId → credit (1.0, 0.5, or 0.0)
 */
function computePlayCredits(
  preSubOnField: string[],
  postSubOnField: string[],
): Map<string, number> {
  const preSet = new Set(preSubOnField);
  const postSet = new Set(postSubOnField);
  const credits = new Map<string, number>();

  // Players who were on field the whole game
  for (const id of preSubOnField) {
    if (postSet.has(id)) {
      credits.set(id, FULL_GAME);
    } else {
      // Subbed off mid-game
      credits.set(id, SUB_APPEARANCE);
    }
  }

  // Players who were subbed on
  for (const id of postSubOnField) {
    if (!preSet.has(id)) {
      credits.set(id, SUB_APPEARANCE);
    }
  }

  return credits;
}

/**
 * Updates trackers after a game using fractional play time credits.
 */
function updateTrackers(
  trackers: Map<string, PlayerTracker>,
  credits: Map<string, number>,
  available: string[],
  gameNumber: number,
  playersPerTeam: number,
): void {
  const rate = available.length > 0 ? playersPerTeam / available.length : 0;

  for (const id of available) {
    const t = trackers.get(id) ?? createTracker();
    t.expectedPlayTime += rate;
    trackers.set(id, t);
  }

  for (const [id, credit] of credits) {
    if (credit > 0) {
      const t = trackers.get(id) ?? createTracker();
      t.playTimeUnits += credit;
      t.lastPlayedGame = gameNumber;
      trackers.set(id, t);
    }
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

    // No subs in initial plan → everyone on field gets full credit
    const credits = computePlayCredits(onField, onField);
    updateTrackers(trackers, credits, ids, gameNumber, playersPerTeam);
    games.push({ gameNumber, onField, bench });
  }

  return { games };
}

// ---- Event resolution ----

interface ResolvedAvailability {
  lateIds: Set<string>;
  joinedIds: Set<string>;
  injuredFrom: Map<string, number>;
  /** Player leaves after this game number — unavailable from afterGame+1 onward */
  leavingAfter: Map<string, number>;
  subs: Map<number, Array<{ playerOut: string; playerIn: string }>>;
}

function resolveEvents(events: RotationEvent[]): ResolvedAvailability {
  const lateIds = new Set<string>();
  const joinedIds = new Set<string>();
  const injuredFrom = new Map<string, number>();
  const leavingAfter = new Map<string, number>();
  const subs = new Map<number, Array<{ playerOut: string; playerIn: string }>>();

  for (const event of events) {
    if (event.type === "late") {
      lateIds.add(event.playerId);
    } else if (event.type === "joined") {
      joinedIds.add(event.playerId);
    } else if (event.type === "leaving") {
      const existing = leavingAfter.get(event.playerId);
      // Use the earliest leaving time if multiple
      if (existing === undefined || event.afterGame < existing) {
        leavingAfter.set(event.playerId, event.afterGame);
      }
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

  return { lateIds, joinedIds, injuredFrom, leavingAfter, subs };
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
  const leaveAt = resolved.leavingAfter.get(id);
  if (leaveAt !== undefined && gameNumber > leaveAt) {
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
    const preSubOnField = [...onField];
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

    // Compute fractional play time: pre-sub vs post-sub
    const credits = computePlayCredits(preSubOnField, onField);
    updateTrackers(trackers, credits, allAvailable, gameNumber, playersPerTeam);
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
 * Suggests the next fair substitution using fairness scores based
 * on fractional play time units.
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

  // Rebuild trackers from plan history
  const trackers = new Map<string, PlayerTracker>();
  for (const game of plan.games) {
    if (game.gameNumber > currentGameNumber) break;
    const allInGame = [...game.onField, ...game.bench];
    const fieldCount = game.onField.length;
    const rate = allInGame.length > 0
      ? Math.min(fieldCount, allInGame.length) / allInGame.length
      : 0;

    for (const id of allInGame) {
      const t = trackers.get(id) ?? createTracker();
      t.expectedPlayTime += rate;
      trackers.set(id, t);
    }

    // For history we assume post-sub lineup = 1.0 credit
    // (subs within a game are already reflected in onField)
    for (const id of game.onField) {
      const t = trackers.get(id) ?? createTracker();
      t.playTimeUnits += FULL_GAME;
      t.lastPlayedGame = game.gameNumber;
      trackers.set(id, t);
    }
  }

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
 * Computes per-player stats with fractional play time units.
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
    const fieldCount = game.onField.length;
    const rate = allInGame.length > 0
      ? Math.min(fieldCount, allInGame.length) / allInGame.length
      : 0;

    for (const id of allInGame) {
      const t = trackers.get(id) ?? createTracker();
      t.expectedPlayTime += rate;
      trackers.set(id, t);
    }

    // Post-sub onField = 1.0 credit each (subs already applied)
    for (const id of game.onField) {
      const t = trackers.get(id) ?? createTracker();
      t.playTimeUnits += FULL_GAME;
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
      playTimeUnits: Math.round(t.playTimeUnits * 10) / 10,
      gamesBenched: gamesInPlan - Math.ceil(t.playTimeUnits),
      fairnessScore: Math.round(fairnessScore(t) * 100) / 100,
    };
  });
}
