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
  /** Game number when this player last played (0 = never) */
  lastPlayedGame: number;
}

/**
 * Selects the fairest `count` players from `available`.
 *
 * Sort order:
 * 1. Fewest games played (give the bench-warmers a go)
 * 2. Longest since last played (break ties fairly — whoever waited longest)
 *
 * This is simple, deterministic, and produces rotations that feel fair
 * to coaches: no one sits out twice while someone else plays every game.
 */
function selectOnField(
  available: string[],
  count: number,
  trackers: Map<string, PlayerTracker>,
): string[] {
  const sorted = [...available].sort((a, b) => {
    const ta = trackers.get(a) ?? { gamesPlayed: 0, lastPlayedGame: 0 };
    const tb = trackers.get(b) ?? { gamesPlayed: 0, lastPlayedGame: 0 };
    if (ta.gamesPlayed !== tb.gamesPlayed) return ta.gamesPlayed - tb.gamesPlayed;
    return ta.lastPlayedGame - tb.lastPlayedGame;
  });
  return sorted.slice(0, Math.min(count, sorted.length));
}

/** Update trackers after a game is assigned */
function updateTrackers(
  trackers: Map<string, PlayerTracker>,
  onField: string[],
  gameNumber: number,
): void {
  for (const id of onField) {
    const t = trackers.get(id) ?? { gamesPlayed: 0, lastPlayedGame: 0 };
    t.gamesPlayed++;
    t.lastPlayedGame = gameNumber;
    trackers.set(id, t);
  }
}

// ---- Plan generation ----

/**
 * Generates a fair initial rotation plan.
 *
 * Instead of a mechanical round-robin, this builds games sequentially
 * using the fairness tracker. Each game picks the players who have
 * played the least and waited the longest.
 */
export function generateInitialPlan(config: RotationConfig): RotationPlan {
  const { players, playersPerTeam, numberOfGames } = config;
  const ids = players.map((p) => p.id);
  const trackers = new Map<string, PlayerTracker>();

  // Initialise all trackers
  for (const id of ids) {
    trackers.set(id, { gamesPlayed: 0, lastPlayedGame: 0 });
  }

  const games: Game[] = [];
  for (let i = 0; i < numberOfGames; i++) {
    const gameNumber = i + 1;
    const onField = selectOnField(ids, playersPerTeam, trackers);
    const onFieldSet = new Set(onField);
    const bench = ids.filter((id) => !onFieldSet.has(id));

    updateTrackers(trackers, onField, gameNumber);
    games.push({ gameNumber, onField, bench });
  }

  return { games };
}

// ---- Event resolution ----

interface ResolvedAvailability {
  lateIds: Set<string>;
  joinedIds: Set<string>;
  injuredFrom: Map<string, number>;
  /** Substitutions keyed by game number, in order */
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

/**
 * Applies events to a plan and returns a new plan using fairness-based
 * selection. Current game lineup is locked (joined players go to bench).
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
  const trackers = new Map<string, PlayerTracker>();

  for (const id of allPlayerIds) {
    trackers.set(id, { gamesPlayed: 0, lastPlayedGame: 0 });
  }

  const games: Game[] = [];
  for (let i = 0; i < plan.games.length; i++) {
    const gameNumber = i + 1;

    // Exclude joined players from field selection for current/past games
    const fieldAvailable = allPlayerIds.filter((id) => {
      if (gameNumber <= currentGame && resolved.joinedIds.has(id)) return false;
      return isAvailable(id, gameNumber, resolved);
    });

    const onField = selectOnField(fieldAvailable, playersPerTeam, trackers);
    const onFieldSet = new Set(onField);

    // Bench includes all available players not on field (including joined)
    const bench = allPlayerIds.filter(
      (id) => isAvailable(id, gameNumber, resolved) && !onFieldSet.has(id),
    );

    // Apply any substitutions recorded for this game
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

    updateTrackers(trackers, onField, gameNumber);
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
 * Suggests the next fair substitution for the current game.
 * Uses the plan's post-sub lineup (subs already applied by applyEvents)
 * and the fairness tracker to pick who should swap next.
 * Returns null if bench is empty.
 */
export function getNextSubSuggestion(
  plan: RotationPlan,
  currentGameNumber: number,
  unavailableIds: Set<string>,
): { playerIn: string; playerOut: string } | null {
  const currentGame = plan.games.find((g) => g.gameNumber === currentGameNumber);
  if (!currentGame) return null;

  // These already reflect any subs applied to this game
  const availableBench = currentGame.bench.filter((id) => !unavailableIds.has(id));
  const availableField = currentGame.onField.filter((id) => !unavailableIds.has(id));
  if (availableBench.length === 0 || availableField.length === 0) return null;

  // Build trackers from all games up to and including current
  // (since applyEvents already tracked on-field players including subs)
  const trackers = new Map<string, PlayerTracker>();
  for (const game of plan.games) {
    if (game.gameNumber > currentGameNumber) break;
    for (const id of game.onField) {
      const t = trackers.get(id) ?? { gamesPlayed: 0, lastPlayedGame: 0 };
      t.gamesPlayed++;
      t.lastPlayedGame = game.gameNumber;
      trackers.set(id, t);
    }
  }

  // Bench player with fewest games → comes on
  const playerIn = availableBench.reduce((best, id) => {
    const bestT = trackers.get(best) ?? { gamesPlayed: 0, lastPlayedGame: 0 };
    const thisT = trackers.get(id) ?? { gamesPlayed: 0, lastPlayedGame: 0 };
    if (thisT.gamesPlayed !== bestT.gamesPlayed) {
      return thisT.gamesPlayed < bestT.gamesPlayed ? id : best;
    }
    return thisT.lastPlayedGame < bestT.lastPlayedGame ? id : best;
  });

  // Field player with most games → comes off
  const playerOut = availableField.reduce((best, id) => {
    const bestT = trackers.get(best) ?? { gamesPlayed: 0, lastPlayedGame: 0 };
    const thisT = trackers.get(id) ?? { gamesPlayed: 0, lastPlayedGame: 0 };
    if (thisT.gamesPlayed !== bestT.gamesPlayed) {
      return thisT.gamesPlayed > bestT.gamesPlayed ? id : best;
    }
    return thisT.lastPlayedGame > bestT.lastPlayedGame ? id : best;
  });

  return { playerIn, playerOut };
}

/**
 * Computes per-player stats from a rotation plan.
 * Used by the UI to show a fairness breakdown.
 */
export function getPlayerStats(
  plan: RotationPlan,
  allPlayerIds: string[],
): PlayerStats[] {
  const played = new Map<string, number>();
  const benched = new Map<string, number>();

  for (const id of allPlayerIds) {
    played.set(id, 0);
    benched.set(id, 0);
  }

  for (const game of plan.games) {
    for (const id of game.onField) {
      played.set(id, (played.get(id) ?? 0) + 1);
    }
    for (const id of game.bench) {
      benched.set(id, (benched.get(id) ?? 0) + 1);
    }
  }

  return allPlayerIds.map((id) => ({
    playerId: id,
    gamesPlayed: played.get(id) ?? 0,
    gamesBenched: benched.get(id) ?? 0,
  }));
}
