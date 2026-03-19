import type {
  Game,
  PlayerStats,
  RotationConfig,
  RotationEvent,
  RotationPlan,
  ReplacementSuggestion,
} from "../types/index.js";

// ---- Play time units ----

const FULL_GAME = 1.0;
const SUB_APPEARANCE = 0.5;

// ---- Fairness tracker ----

interface PlayerTracker {
  playTimeUnits: number;
  lastPlayedGame: number;
  /** Games this player was in the available pool */
  gamesAvailable: number;
}

function createTracker(): PlayerTracker {
  return { playTimeUnits: 0, lastPlayedGame: 0, gamesAvailable: 0 };
}

/**
 * Fairness debt: how far behind a player is from their fair share.
 * Positive debt = underplayed (should be prioritised).
 * Calculated as: (gamesAvailable * fairRate) - playTimeUnits
 * where fairRate is playersPerTeam / totalAvailableInThoseGames (averaged).
 */
function fairnessDebt(t: PlayerTracker, playersPerTeam: number, avgPoolSize: number): number {
  if (t.gamesAvailable === 0) return 0;
  const fairShare = t.gamesAvailable * (playersPerTeam / Math.max(avgPoolSize, playersPerTeam));
  return fairShare - t.playTimeUnits;
}

/**
 * Selects the fairest `count` players from `available`.
 * Sorts by: highest fairness debt, then longest since last played.
 */
function selectOnField(
  available: string[],
  count: number,
  trackers: Map<string, PlayerTracker>,
  playersPerTeam: number,
  avgPoolSize: number,
): string[] {
  const sorted = [...available].sort((a, b) => {
    const ta = trackers.get(a) ?? createTracker();
    const tb = trackers.get(b) ?? createTracker();
    // Higher debt = more underplayed = should play first
    const debtDiff = fairnessDebt(tb, playersPerTeam, avgPoolSize) - fairnessDebt(ta, playersPerTeam, avgPoolSize);
    if (Math.abs(debtDiff) > 0.001) return debtDiff;
    // Tie-break: player who waited longest gets priority
    return ta.lastPlayedGame - tb.lastPlayedGame;
  });
  return sorted.slice(0, Math.min(count, sorted.length));
}

function computePlayCredits(
  preSubOnField: string[],
  postSubOnField: string[],
): Map<string, number> {
  const preSet = new Set(preSubOnField);
  const postSet = new Set(postSubOnField);
  const credits = new Map<string, number>();

  for (const id of preSubOnField) {
    credits.set(id, postSet.has(id) ? FULL_GAME : SUB_APPEARANCE);
  }

  for (const id of postSubOnField) {
    if (!preSet.has(id)) {
      credits.set(id, SUB_APPEARANCE);
    }
  }

  return credits;
}

/**
 * Updates trackers after a game.
 */
function updateTrackers(
  trackers: Map<string, PlayerTracker>,
  credits: Map<string, number>,
  available: string[],
  gameNumber: number,
): void {
  for (const id of available) {
    const t = trackers.get(id) ?? createTracker();
    t.gamesAvailable++;
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

/** Compute average pool size from trackers (for fair rate calculation) */
function getAvgPoolSize(trackers: Map<string, PlayerTracker>): number {
  let totalAvail = 0;
  let maxGames = 0;
  for (const t of trackers.values()) {
    totalAvail += t.gamesAvailable;
    maxGames = Math.max(maxGames, t.gamesAvailable);
  }
  return maxGames > 0 ? totalAvail / maxGames : 1;
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
    const avgPool = ids.length;
    const onField = selectOnField(ids, playersPerTeam, trackers, playersPerTeam, avgPool);
    const onFieldSet = new Set(onField);
    const bench = ids.filter((id) => !onFieldSet.has(id));

    const credits = computePlayCredits(onField, onField);
    updateTrackers(trackers, credits, ids, gameNumber);
    games.push({ gameNumber, onField, bench });
  }

  return { games };
}

// ---- Event resolution ----

interface ResolvedAvailability {
  lateIds: Set<string>;
  joinedIds: Set<string>;
  injuredFrom: Map<string, number>;
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

// ---- Apply events (two-phase: locked past + rebalanced future) ----

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

  // Phase 1: PAST games only (strictly before currentGame)
  // These games already happened. Late+joined players were absent.
  for (let i = 0; i < plan.games.length; i++) {
    const gameNumber = i + 1;
    if (gameNumber >= currentGame) break;

    const fieldAvailable = allPlayerIds.filter((id) => {
      if (!isAvailable(id, gameNumber, resolved)) return false;
      // Late+joined players weren't here for past games
      if (resolved.lateIds.has(id) && resolved.joinedIds.has(id)) return false;
      return true;
    });

    const allAvailable = allPlayerIds.filter((id) =>
      isAvailable(id, gameNumber, resolved),
    );

    const avgPool = getAvgPoolSize(trackers) || allAvailable.length;
    const onField = selectOnField(fieldAvailable, playersPerTeam, trackers, playersPerTeam, avgPool);
    const preSubOnField = [...onField];
    const onFieldSet = new Set(onField);

    const bench = allPlayerIds.filter(
      (id) => isAvailable(id, gameNumber, resolved) && !onFieldSet.has(id),
    );

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

    const credits = computePlayCredits(preSubOnField, onField);
    updateTrackers(trackers, credits, allAvailable, gameNumber);
    games.push({ gameNumber, onField, bench });
  }

  // Phase 2: Current game AND future games — fully rebalanced
  // All available players (including late+joined) are eligible for field.
  // The fairness debt system ensures underplayed players get prioritised.
  for (let i = Math.max(0, currentGame - 1); i < plan.games.length; i++) {
    const gameNumber = i + 1;

    const allAvailable = allPlayerIds.filter((id) =>
      isAvailable(id, gameNumber, resolved),
    );

    const avgPool = getAvgPoolSize(trackers) || allAvailable.length;
    const onField = selectOnField(allAvailable, playersPerTeam, trackers, playersPerTeam, avgPool);
    const onFieldSet = new Set(onField);

    const bench = allAvailable.filter((id) => !onFieldSet.has(id));

    const credits = computePlayCredits(onField, onField);
    updateTrackers(trackers, credits, allAvailable, gameNumber);
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

  // Build trackers from plan history up to current game
  const trackers = new Map<string, PlayerTracker>();
  for (const game of plan.games) {
    if (game.gameNumber > currentGameNumber) break;
    const allInGame = [...game.onField, ...game.bench];
    for (const id of allInGame) {
      const t = trackers.get(id) ?? createTracker();
      t.gamesAvailable++;
      trackers.set(id, t);
    }
    for (const id of game.onField) {
      const t = trackers.get(id) ?? createTracker();
      t.playTimeUnits += FULL_GAME;
      t.lastPlayedGame = game.gameNumber;
      trackers.set(id, t);
    }
  }

  const avgPool = getAvgPoolSize(trackers) || (availableBench.length + availableField.length);
  const playersPerTeam = availableField.length;

  // Bench player with highest debt → comes on
  const playerIn = availableBench.reduce((best, id) => {
    const bestT = trackers.get(best) ?? createTracker();
    const thisT = trackers.get(id) ?? createTracker();
    const bestDebt = fairnessDebt(bestT, playersPerTeam, avgPool);
    const thisDebt = fairnessDebt(thisT, playersPerTeam, avgPool);
    if (Math.abs(thisDebt - bestDebt) > 0.001) {
      return thisDebt > bestDebt ? id : best;
    }
    return thisT.lastPlayedGame < bestT.lastPlayedGame ? id : best;
  });

  // Field player with lowest debt (most overplayed) → comes off
  const playerOut = availableField.reduce((best, id) => {
    const bestT = trackers.get(best) ?? createTracker();
    const thisT = trackers.get(id) ?? createTracker();
    const bestDebt = fairnessDebt(bestT, playersPerTeam, avgPool);
    const thisDebt = fairnessDebt(thisT, playersPerTeam, avgPool);
    if (Math.abs(thisDebt - bestDebt) > 0.001) {
      return thisDebt < bestDebt ? id : best;
    }
    return thisT.lastPlayedGame > bestT.lastPlayedGame ? id : best;
  });

  return { playerIn, playerOut };
}

/**
 * Computes per-player stats with fairness debt.
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
    for (const id of allInGame) {
      const t = trackers.get(id) ?? createTracker();
      t.gamesAvailable++;
      trackers.set(id, t);
    }
    for (const id of game.onField) {
      const t = trackers.get(id) ?? createTracker();
      t.playTimeUnits += FULL_GAME;
      trackers.set(id, t);
    }
  }

  const avgPool = getAvgPoolSize(trackers) || allPlayerIds.length;
  const playersPerTeam = plan.games.length > 0 ? plan.games[0].onField.length : 5;

  return allPlayerIds.map((id) => {
    const t = trackers.get(id) ?? createTracker();
    const debt = fairnessDebt(t, playersPerTeam, avgPool);

    return {
      playerId: id,
      playTimeUnits: Math.round(t.playTimeUnits * 10) / 10,
      gamesBenched: Math.max(0, t.gamesAvailable - Math.ceil(t.playTimeUnits)),
      fairnessScore: Math.round(-debt * 100) / 100, // negative debt = overplayed = positive score
    };
  });
}
