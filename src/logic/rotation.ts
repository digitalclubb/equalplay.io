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
  gamesAvailable: number;
}

function createTracker(): PlayerTracker {
  return { playTimeUnits: 0, lastPlayedGame: 0, gamesAvailable: 0 };
}

function fairnessDebt(t: PlayerTracker, playersPerTeam: number, avgPoolSize: number): number {
  if (t.gamesAvailable === 0) return 0;
  const fairShare = t.gamesAvailable * (playersPerTeam / Math.max(avgPoolSize, playersPerTeam));
  return fairShare - t.playTimeUnits;
}

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
    const debtDiff = fairnessDebt(tb, playersPerTeam, avgPoolSize) - fairnessDebt(ta, playersPerTeam, avgPoolSize);
    if (Math.abs(debtDiff) > 0.001) return debtDiff;
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
  /** Maps playerId → game number they arrived during */
  joinedDuring: Map<string, number>;
  injuredFrom: Map<string, number>;
  leavingAfter: Map<string, number>;
  subs: Map<number, Array<{ playerOut: string; playerIn: string }>>;
}

function resolveEvents(events: RotationEvent[]): ResolvedAvailability {
  const lateIds = new Set<string>();
  const joinedDuring = new Map<string, number>();
  const injuredFrom = new Map<string, number>();
  const leavingAfter = new Map<string, number>();
  const subs = new Map<number, Array<{ playerOut: string; playerIn: string }>>();

  for (const event of events) {
    if (event.type === "late") {
      lateIds.add(event.playerId);
    } else if (event.type === "joined") {
      joinedDuring.set(event.playerId, event.duringGame ?? 1);
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

  return { lateIds, joinedDuring, injuredFrom, leavingAfter, subs };
}

/** Is a player generally available for a game (ignoring joined timing) */
function isAvailable(
  id: string,
  gameNumber: number,
  resolved: ResolvedAvailability,
): boolean {
  // Pure late (no joined) = unavailable everywhere
  if (resolved.lateIds.has(id) && !resolved.joinedDuring.has(id)) {
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

/**
 * Can a player be selected for on-field in a specific game?
 *
 * Late+joined players arrived during a specific game (duringGame).
 * - Games <= duringGame: excluded (they were absent or just arriving)
 * - Games > duringGame: ELIGIBLE (game starts after they arrived)
 */
function isFieldEligible(
  id: string,
  gameNumber: number,
  resolved: ResolvedAvailability,
): boolean {
  if (!isAvailable(id, gameNumber, resolved)) return false;

  const arrivedDuring = resolved.joinedDuring.get(id);
  if (resolved.lateIds.has(id) && arrivedDuring !== undefined) {
    return gameNumber > arrivedDuring;
  }

  return true;
}

/**
 * Is a player in this game at all (field or bench)?
 *
 * Late+joined players are present from the game they arrived in onwards
 * (on bench for that game, eligible for field from the next one).
 */
function isInGame(
  id: string,
  gameNumber: number,
  resolved: ResolvedAvailability,
): boolean {
  if (!isAvailable(id, gameNumber, resolved)) return false;

  const arrivedDuring = resolved.joinedDuring.get(id);
  if (resolved.lateIds.has(id) && arrivedDuring !== undefined) {
    return gameNumber >= arrivedDuring;
  }

  return true;
}

// ---- Apply events ----

/**
 * Rebuilds the rotation plan with events applied.
 *
 * The plan is rebuilt from scratch every time. `currentGame` represents
 * the game currently being played (or about to be played).
 *
 * Late+joined players:
 * - NOT on field for any game <= currentGame (they were absent)
 * - ELIGIBLE for games > currentGame (they've arrived, future games)
 * - On the BENCH for currentGame (available for replacement if needed)
 *
 * This ensures:
 * - Current game lineup is stable (no mid-game displacement)
 * - Preview of future games shows the joined player correctly
 * - After advancing, the joined player plays (they're now in a future game)
 */
export function applyEvents(
  plan: RotationPlan,
  events: RotationEvent[],
  allPlayerIds: string[],
  playersPerTeam: number,
  _currentGame: number,
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

    // Who can be selected for on-field?
    const fieldEligible = allPlayerIds.filter((id) =>
      isFieldEligible(id, gameNumber, resolved),
    );

    // Who is in this game at all (field or bench)?
    const allAvailable = allPlayerIds.filter((id) =>
      isInGame(id, gameNumber, resolved),
    );

    const avgPool = getAvgPoolSize(trackers) || allAvailable.length;
    const onField = selectOnField(fieldEligible, playersPerTeam, trackers, playersPerTeam, avgPool);
    const preSubOnField = [...onField];
    const onFieldSet = new Set(onField);

    // Bench: all available players not on field
    const bench = allAvailable.filter((id) => !onFieldSet.has(id));

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

    const credits = computePlayCredits(preSubOnField, onField);
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
  events: RotationEvent[] = [],
): { playerIn: string; playerOut: string } | null {
  const currentGame = plan.games.find((g) => g.gameNumber === currentGameNumber);
  if (!currentGame) return null;

  const availableBench = currentGame.bench.filter((id) => !unavailableIds.has(id));
  const availableField = currentGame.onField.filter((id) => !unavailableIds.has(id));
  if (availableBench.length === 0 || availableField.length === 0) return null;

  // Build sub lookup for accurate credit calculation
  const subsByGame = new Map<number, Array<{ playerOut: string; playerIn: string }>>();
  for (const e of events) {
    if (e.type === "sub") {
      if (!subsByGame.has(e.gameNumber)) subsByGame.set(e.gameNumber, []);
      subsByGame.get(e.gameNumber)!.push({ playerOut: e.playerOut, playerIn: e.playerIn });
    }
  }

  const trackers = new Map<string, PlayerTracker>();
  for (const game of plan.games) {
    if (game.gameNumber > currentGameNumber) break;
    const allInGame = [...game.onField, ...game.bench];
    for (const id of allInGame) {
      const t = trackers.get(id) ?? createTracker();
      t.gamesAvailable++;
      trackers.set(id, t);
    }

    const gameSubs = subsByGame.get(game.gameNumber);
    const subbedIn = new Set<string>();
    const subbedOut = new Set<string>();
    if (gameSubs) {
      for (const sub of gameSubs) {
        subbedIn.add(sub.playerIn);
        subbedOut.add(sub.playerOut);
      }
    }

    for (const id of game.onField) {
      const t = trackers.get(id) ?? createTracker();
      t.playTimeUnits += subbedIn.has(id) ? SUB_APPEARANCE : FULL_GAME;
      t.lastPlayedGame = game.gameNumber;
      trackers.set(id, t);
    }
    for (const id of subbedOut) {
      const t = trackers.get(id) ?? createTracker();
      t.playTimeUnits += SUB_APPEARANCE;
      trackers.set(id, t);
    }
  }

  const avgPool = getAvgPoolSize(trackers) || (availableBench.length + availableField.length);
  const ppt = availableField.length;

  const playerIn = availableBench.reduce((best, id) => {
    const bestT = trackers.get(best) ?? createTracker();
    const thisT = trackers.get(id) ?? createTracker();
    const bestDebt = fairnessDebt(bestT, ppt, avgPool);
    const thisDebt = fairnessDebt(thisT, ppt, avgPool);
    if (Math.abs(thisDebt - bestDebt) > 0.001) {
      return thisDebt > bestDebt ? id : best;
    }
    return thisT.lastPlayedGame < bestT.lastPlayedGame ? id : best;
  });

  const playerOut = availableField.reduce((best, id) => {
    const bestT = trackers.get(best) ?? createTracker();
    const thisT = trackers.get(id) ?? createTracker();
    const bestDebt = fairnessDebt(bestT, ppt, avgPool);
    const thisDebt = fairnessDebt(thisT, ppt, avgPool);
    if (Math.abs(thisDebt - bestDebt) > 0.001) {
      return thisDebt < bestDebt ? id : best;
    }
    return thisT.lastPlayedGame > bestT.lastPlayedGame ? id : best;
  });

  return { playerIn, playerOut };
}

/**
 * Returns ranked lists of bench and field players for sub cycling.
 * Bench sorted by highest fairness debt (most deserving of time).
 * Field sorted by lowest fairness debt (most overplayed).
 */
export function getSubCandidates(
  plan: RotationPlan,
  currentGameNumber: number,
  unavailableIds: Set<string>,
  events: RotationEvent[] = [],
): { benchRanked: string[]; fieldRanked: string[] } | null {
  const currentGame = plan.games.find((g) => g.gameNumber === currentGameNumber);
  if (!currentGame) return null;

  const availableBench = currentGame.bench.filter((id) => !unavailableIds.has(id));
  const availableField = currentGame.onField.filter((id) => !unavailableIds.has(id));
  if (availableBench.length === 0 || availableField.length === 0) return null;

  const subsByGame = new Map<number, Array<{ playerOut: string; playerIn: string }>>();
  for (const e of events) {
    if (e.type === "sub") {
      if (!subsByGame.has(e.gameNumber)) subsByGame.set(e.gameNumber, []);
      subsByGame.get(e.gameNumber)!.push({ playerOut: e.playerOut, playerIn: e.playerIn });
    }
  }

  const trackers = new Map<string, PlayerTracker>();
  for (const game of plan.games) {
    if (game.gameNumber > currentGameNumber) break;
    const allInGame = [...game.onField, ...game.bench];
    for (const id of allInGame) {
      const t = trackers.get(id) ?? createTracker();
      t.gamesAvailable++;
      trackers.set(id, t);
    }

    const gameSubs = subsByGame.get(game.gameNumber);
    const subbedIn = new Set<string>();
    const subbedOut = new Set<string>();
    if (gameSubs) {
      for (const sub of gameSubs) {
        subbedIn.add(sub.playerIn);
        subbedOut.add(sub.playerOut);
      }
    }

    for (const id of game.onField) {
      const t = trackers.get(id) ?? createTracker();
      t.playTimeUnits += subbedIn.has(id) ? SUB_APPEARANCE : FULL_GAME;
      t.lastPlayedGame = game.gameNumber;
      trackers.set(id, t);
    }
    for (const id of subbedOut) {
      const t = trackers.get(id) ?? createTracker();
      t.playTimeUnits += SUB_APPEARANCE;
      trackers.set(id, t);
    }
  }

  const avgPool = getAvgPoolSize(trackers) || (availableBench.length + availableField.length);
  const ppt = availableField.length;

  const benchRanked = [...availableBench].sort((a, b) => {
    const aT = trackers.get(a) ?? createTracker();
    const bT = trackers.get(b) ?? createTracker();
    const aDebt = fairnessDebt(aT, ppt, avgPool);
    const bDebt = fairnessDebt(bT, ppt, avgPool);
    if (Math.abs(aDebt - bDebt) > 0.001) return bDebt - aDebt;
    return aT.lastPlayedGame - bT.lastPlayedGame;
  });

  const fieldRanked = [...availableField].sort((a, b) => {
    const aT = trackers.get(a) ?? createTracker();
    const bT = trackers.get(b) ?? createTracker();
    const aDebt = fairnessDebt(aT, ppt, avgPool);
    const bDebt = fairnessDebt(bT, ppt, avgPool);
    if (Math.abs(aDebt - bDebt) > 0.001) return aDebt - bDebt;
    return bT.lastPlayedGame - aT.lastPlayedGame;
  });

  return { benchRanked, fieldRanked };
}

export function getPlayerStats(
  plan: RotationPlan,
  allPlayerIds: string[],
  events: RotationEvent[] = [],
): PlayerStats[] {
  const trackers = new Map<string, PlayerTracker>();

  for (const id of allPlayerIds) {
    trackers.set(id, createTracker());
  }

  // Build sub lookup: gameNumber → list of subs
  const subsByGame = new Map<number, Array<{ playerOut: string; playerIn: string }>>();
  for (const e of events) {
    if (e.type === "sub") {
      if (!subsByGame.has(e.gameNumber)) subsByGame.set(e.gameNumber, []);
      subsByGame.get(e.gameNumber)!.push({ playerOut: e.playerOut, playerIn: e.playerIn });
    }
  }

  for (const game of plan.games) {
    const allInGame = [...game.onField, ...game.bench];
    for (const id of allInGame) {
      const t = trackers.get(id) ?? createTracker();
      t.gamesAvailable++;
      trackers.set(id, t);
    }

    // Determine who was subbed in/out for this game
    const gameSubs = subsByGame.get(game.gameNumber);
    const subbedIn = new Set<string>();
    const subbedOut = new Set<string>();
    if (gameSubs) {
      for (const sub of gameSubs) {
        subbedIn.add(sub.playerIn);
        subbedOut.add(sub.playerOut);
      }
    }

    // Credit on-field players
    for (const id of game.onField) {
      const t = trackers.get(id) ?? createTracker();
      // Subbed on mid-game = 0.5, full game = 1.0
      t.playTimeUnits += subbedIn.has(id) ? SUB_APPEARANCE : FULL_GAME;
      trackers.set(id, t);
    }

    // Credit subbed-off players (they're in bench now but played half)
    for (const id of subbedOut) {
      const t = trackers.get(id) ?? createTracker();
      t.playTimeUnits += SUB_APPEARANCE;
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
      fairnessScore: Math.round(-debt * 100) / 100,
    };
  });
}
