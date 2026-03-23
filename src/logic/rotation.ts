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

/** Frozen sentinel for read-only fallback — avoids allocating in hot comparators */
const EMPTY_TRACKER: Readonly<PlayerTracker> = Object.freeze(
  { playTimeUnits: 0, lastPlayedGame: 0, gamesAvailable: 0 },
);

function fairnessDebt(t: Readonly<PlayerTracker>, playersPerTeam: number, avgPoolSize: number): number {
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
  subbedOffPrevGame: Set<string> = new Set(),
): string[] {
  const sorted = [...available].sort((a, b) => {
    const ta = trackers.get(a) ?? EMPTY_TRACKER;
    const tb = trackers.get(b) ?? EMPTY_TRACKER;
    // Players subbed off last game get a 0.5 debt boost — they were
    // on the bench for half a game and should be prioritised to start.
    const aDebt = fairnessDebt(ta, playersPerTeam, avgPoolSize)
      + (subbedOffPrevGame.has(a) ? 0.5 : 0);
    const bDebt = fairnessDebt(tb, playersPerTeam, avgPoolSize)
      + (subbedOffPrevGame.has(b) ? 0.5 : 0);
    const debtDiff = bDebt - aDebt;
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
    if (t.gamesAvailable > maxGames) maxGames = t.gamesAvailable;
  }
  return maxGames > 0 ? totalAvail / maxGames : 1;
}

// ---- Plan generation ----

export function generateInitialPlan(
  config: RotationConfig,
  teamSizeOverrides?: Record<number, number>,
): RotationPlan {
  const { players, playersPerTeam, numberOfGames } = config;
  const ids = players.map((p) => p.id);
  const trackers = new Map<string, PlayerTracker>();

  for (const id of ids) {
    trackers.set(id, createTracker());
  }

  const games: Game[] = [];
  for (let i = 0; i < numberOfGames; i++) {
    const gameNumber = i + 1;
    const ppt = teamSizeOverrides?.[gameNumber] ?? playersPerTeam;
    const avgPool = ids.length;
    const onField = selectOnField(ids, ppt, trackers, ppt, avgPool);
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
  teamSizeOverrides?: Record<number, number>,
): RotationPlan {
  if (events.length === 0 && !teamSizeOverrides) return plan;

  const resolved = resolveEvents(events);
  const trackers = new Map<string, PlayerTracker>();

  for (const id of allPlayerIds) {
    trackers.set(id, createTracker());
  }

  const games: Game[] = [];
  let subbedOffPrevGame = new Set<string>();

  for (let i = 0; i < plan.games.length; i++) {
    const gameNumber = i + 1;
    const ppt = teamSizeOverrides?.[gameNumber] ?? playersPerTeam;

    // Who can be selected for on-field?
    const fieldEligible = allPlayerIds.filter((id) =>
      isFieldEligible(id, gameNumber, resolved),
    );

    // Who is in this game at all (field or bench)?
    const allAvailable = allPlayerIds.filter((id) =>
      isInGame(id, gameNumber, resolved),
    );

    const avgPool = getAvgPoolSize(trackers) || allAvailable.length;
    const onField = selectOnField(fieldEligible, ppt, trackers, ppt, avgPool, subbedOffPrevGame);
    const preSubOnField = [...onField];
    const onFieldSet = new Set(onField);

    // Bench: all available players not on field
    const bench = allAvailable.filter((id) => !onFieldSet.has(id));

    // Apply substitutions and track who was subbed off this game
    subbedOffPrevGame = new Set<string>();
    const gameSubs = resolved.subs.get(gameNumber);
    if (gameSubs) {
      for (const sub of gameSubs) {
        const outIdx = onField.indexOf(sub.playerOut);
        const inIdx = bench.indexOf(sub.playerIn);
        if (outIdx !== -1 && inIdx !== -1) {
          onField[outIdx] = sub.playerIn;
          bench[inIdx] = sub.playerOut;
          subbedOffPrevGame.add(sub.playerOut);
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

/** Single-pass extraction of sub metadata from events */
function extractSubMeta(events: RotationEvent[], currentGameNumber: number): {
  subOffCount: Map<string, number>;
  subbedOffPrevGame: Set<string>;
} {
  const subOffCount = new Map<string, number>();
  const subbedOffPrevGame = new Set<string>();
  const prevGame = currentGameNumber - 1;
  for (const e of events) {
    if (e.type === "sub") {
      subOffCount.set(e.playerOut, (subOffCount.get(e.playerOut) ?? 0) + 1);
      if (e.gameNumber === prevGame) {
        subbedOffPrevGame.add(e.playerOut);
      }
    }
  }
  return { subOffCount, subbedOffPrevGame };
}

/**
 * Build play-time trackers from plan games up to (and including) a given game.
 * Uses resolved.subs for credit calculation — no extra event iteration needed.
 */
function buildTrackers(
  plan: RotationPlan,
  upToGame: number,
  resolved: ResolvedAvailability,
): Map<string, PlayerTracker> {
  const trackers = new Map<string, PlayerTracker>();

  for (const game of plan.games) {
    if (game.gameNumber > upToGame) break;

    // Increment gamesAvailable for all participants (iterate both arrays, no spread)
    for (const id of game.onField) {
      const t = trackers.get(id) ?? createTracker();
      t.gamesAvailable++;
      trackers.set(id, t);
    }
    for (const id of game.bench) {
      const t = trackers.get(id) ?? createTracker();
      t.gamesAvailable++;
      trackers.set(id, t);
    }

    // Credit play time using resolved subs
    const gameSubs = resolved.subs.get(game.gameNumber);
    const subbedIn = new Set<string>();
    const subbedOut = new Set<string>();
    if (gameSubs) {
      for (const sub of gameSubs) {
        subbedIn.add(sub.playerIn);
        subbedOut.add(sub.playerOut);
      }
    }

    for (const id of game.onField) {
      const t = trackers.get(id)!;
      t.playTimeUnits += subbedIn.has(id) ? SUB_APPEARANCE : FULL_GAME;
      t.lastPlayedGame = game.gameNumber;
    }
    for (const id of subbedOut) {
      const t = trackers.get(id)!;
      t.playTimeUnits += SUB_APPEARANCE;
      t.lastPlayedGame = game.gameNumber;
    }
  }

  return trackers;
}

export function getNextSubSuggestion(
  plan: RotationPlan,
  currentGameNumber: number,
  unavailableIds: Set<string>,
  events: RotationEvent[] = [],
): { playerIn: string; playerOut: string } | null {
  const currentGame = plan.games[currentGameNumber - 1];
  if (!currentGame) return null;

  // Late+joined players in their arrival game are available but deprioritised —
  // on-time bench players get subbed on first.
  const resolved = resolveEvents(events);
  const lateInArrivalGame = new Set<string>();
  const availableBench = currentGame.bench.filter((id) => {
    if (unavailableIds.has(id)) return false;
    if (resolved.lateIds.has(id)) {
      const arrivedDuring = resolved.joinedDuring.get(id);
      if (arrivedDuring !== undefined && currentGameNumber <= arrivedDuring) {
        lateInArrivalGame.add(id);
      }
    }
    return true;
  });
  const availableField = currentGame.onField.filter((id) => !unavailableIds.has(id));
  if (availableBench.length === 0 || availableField.length === 0) return null;

  const trackers = buildTrackers(plan, currentGameNumber, resolved);

  const avgPool = getAvgPoolSize(trackers) || (availableBench.length + availableField.length);
  const ppt = availableField.length;

  const { subOffCount, subbedOffPrevGame } = extractSubMeta(events, currentGameNumber);

  // Pre-compute effective debt for all relevant players (avoids recomputing in comparators)
  const debtCache = new Map<string, number>();
  for (const id of availableBench) {
    const t = trackers.get(id) ?? EMPTY_TRACKER;
    debtCache.set(id, fairnessDebt(t, ppt, avgPool) + (subbedOffPrevGame.has(id) ? 0.5 : 0));
  }
  for (const id of availableField) {
    const t = trackers.get(id) ?? EMPTY_TRACKER;
    debtCache.set(id, fairnessDebt(t, ppt, avgPool) + (subbedOffPrevGame.has(id) ? 0.5 : 0));
  }

  const playerIn = availableBench.reduce((best, id) => {
    // On-time bench players always come before late arrivals in their arrival game
    const bestLate = lateInArrivalGame.has(best);
    const thisLate = lateInArrivalGame.has(id);
    if (bestLate !== thisLate) return thisLate ? best : id;

    const bestDebt = debtCache.get(best)!;
    const thisDebt = debtCache.get(id)!;
    if (Math.abs(thisDebt - bestDebt) > 0.001) {
      return thisDebt > bestDebt ? id : best;
    }
    const bestT = trackers.get(best) ?? EMPTY_TRACKER;
    const thisT = trackers.get(id) ?? EMPTY_TRACKER;
    return thisT.lastPlayedGame < bestT.lastPlayedGame ? id : best;
  });

  const playerOut = availableField.reduce((best, id) => {
    const bestDebt = debtCache.get(best)!;
    const thisDebt = debtCache.get(id)!;
    if (Math.abs(thisDebt - bestDebt) > 0.001) {
      return thisDebt < bestDebt ? id : best;
    }
    // Spread sub burden: prefer player with fewer prior sub-offs
    const bestOffs = subOffCount.get(best) ?? 0;
    const thisOffs = subOffCount.get(id) ?? 0;
    if (thisOffs !== bestOffs) {
      return thisOffs < bestOffs ? id : best;
    }
    const bestT = trackers.get(best) ?? EMPTY_TRACKER;
    const thisT = trackers.get(id) ?? EMPTY_TRACKER;
    return thisT.lastPlayedGame > bestT.lastPlayedGame ? id : best;
  });

  // Only recommend if the sub would improve fairness
  if (debtCache.get(playerIn)! <= debtCache.get(playerOut)! + 0.001) return null;

  return { playerIn, playerOut };
}

/**
 * Returns ranked lists of bench and field players for sub cycling.
 * Bench sorted by highest fairness debt (most deserving of time).
 * Field sorted by lowest fairness debt (most overplayed).
 *
 * Injury override: if any on-field player is injured in the current game
 * and hasn't been subbed off yet, they are forced to position 0 in fieldRanked.
 */
export function getSubCandidates(
  plan: RotationPlan,
  currentGameNumber: number,
  unavailableIds: Set<string>,
  events: RotationEvent[] = [],
): { benchRanked: string[]; fieldRanked: string[]; injuredOut: boolean } | null {
  const currentGame = plan.games[currentGameNumber - 1];
  if (!currentGame) return null;

  // Late+joined players in their arrival game are available but deprioritised —
  // on-time bench players get subbed on first.
  const resolved = resolveEvents(events);
  const lateInArrivalGame = new Set<string>();
  const availableBench = currentGame.bench.filter((id) => {
    if (unavailableIds.has(id)) return false;
    if (resolved.lateIds.has(id)) {
      const arrivedDuring = resolved.joinedDuring.get(id);
      if (arrivedDuring !== undefined && currentGameNumber <= arrivedDuring) {
        lateInArrivalGame.add(id);
      }
    }
    return true;
  });

  // Find on-field players injured THIS game who haven't been subbed off yet.
  // Single pass over events for both subbedOff and injuredOnField.
  const subbedOff = new Set<string>();
  const injuredOnField: string[] = [];
  const onFieldSet = new Set(currentGame.onField);
  for (const e of events) {
    if (e.type === "sub" && e.gameNumber === currentGameNumber) {
      subbedOff.add(e.playerOut);
    } else if (
      e.type === "injured" &&
      e.gameNumber === currentGameNumber &&
      onFieldSet.has(e.playerId) &&
      !subbedOff.has(e.playerId)
    ) {
      injuredOnField.push(e.playerId);
    }
  }

  const injuredSet = new Set(injuredOnField);
  const availableField = currentGame.onField.filter(
    (id) => !unavailableIds.has(id) || injuredSet.has(id),
  );

  if (availableBench.length === 0 || availableField.length === 0) return null;

  const trackers = buildTrackers(plan, currentGameNumber, resolved);

  const avgPool = getAvgPoolSize(trackers) || (availableBench.length + availableField.length);
  const ppt = availableField.length;

  const { subOffCount, subbedOffPrevGame } = extractSubMeta(events, currentGameNumber);

  // Pre-compute effective debt for all relevant players
  const debtCache = new Map<string, number>();
  for (const id of availableBench) {
    const t = trackers.get(id) ?? EMPTY_TRACKER;
    debtCache.set(id, fairnessDebt(t, ppt, avgPool) + (subbedOffPrevGame.has(id) ? 0.5 : 0));
  }
  for (const id of availableField) {
    const t = trackers.get(id) ?? EMPTY_TRACKER;
    debtCache.set(id, fairnessDebt(t, ppt, avgPool) + (subbedOffPrevGame.has(id) ? 0.5 : 0));
  }

  const benchRanked = [...availableBench].sort((a, b) => {
    // On-time bench players always ranked before late arrivals in arrival game
    const aLate = lateInArrivalGame.has(a);
    const bLate = lateInArrivalGame.has(b);
    if (aLate !== bLate) return aLate ? 1 : -1;

    const diff = debtCache.get(b)! - debtCache.get(a)!;
    if (Math.abs(diff) > 0.001) return diff;
    return (trackers.get(a) ?? EMPTY_TRACKER).lastPlayedGame
      - (trackers.get(b) ?? EMPTY_TRACKER).lastPlayedGame;
  });

  // Injured on-field players forced to front — they must come off first
  const hasInjury = injuredOnField.length > 0;
  const fieldRanked = [...availableField].sort((a, b) => {
    const aInj = injuredSet.has(a);
    const bInj = injuredSet.has(b);
    if (aInj !== bInj) return aInj ? -1 : 1;

    const diff = debtCache.get(a)! - debtCache.get(b)!;
    if (Math.abs(diff) > 0.001) return diff;
    // Spread sub burden: fewer prior sub-offs = picked off first
    const aOffs = subOffCount.get(a) ?? 0;
    const bOffs = subOffCount.get(b) ?? 0;
    if (aOffs !== bOffs) return aOffs - bOffs;
    return (trackers.get(b) ?? EMPTY_TRACKER).lastPlayedGame
      - (trackers.get(a) ?? EMPTY_TRACKER).lastPlayedGame;
  });

  // Only recommend a sub if it would actually improve fairness:
  // the most deserving bench player must have higher debt than the
  // most overplayed field player.  When the lineup is already balanced
  // (e.g. 10 players, 5 per team, game 2 — everyone has equal time),
  // any sub would worsen fairness.  Injury overrides skip this check.
  if (!hasInjury) {
    if (debtCache.get(benchRanked[0])! <= debtCache.get(fieldRanked[0])! + 0.001) return null;
  }

  return { benchRanked, fieldRanked, injuredOut: hasInjury };
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
    // Increment gamesAvailable — iterate both arrays, no spread
    for (const id of game.onField) {
      const t = trackers.get(id) ?? createTracker();
      t.gamesAvailable++;
      trackers.set(id, t);
    }
    for (const id of game.bench) {
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
      const t = trackers.get(id)!;
      // Subbed on mid-game = 0.5, full game = 1.0
      t.playTimeUnits += subbedIn.has(id) ? SUB_APPEARANCE : FULL_GAME;
    }

    // Credit subbed-off players (they're in bench now but played half)
    for (const id of subbedOut) {
      const t = trackers.get(id)!;
      t.playTimeUnits += SUB_APPEARANCE;
    }
  }

  const avgPool = getAvgPoolSize(trackers) || allPlayerIds.length;
  const playersPerTeam = plan.games.length > 0 ? plan.games[0].onField.length : 5;

  return allPlayerIds.map((id) => {
    const t = trackers.get(id) ?? EMPTY_TRACKER;
    const debt = fairnessDebt(t, playersPerTeam, avgPool);

    return {
      playerId: id,
      playTimeUnits: Math.round(t.playTimeUnits * 10) / 10,
      gamesBenched: Math.max(0, t.gamesAvailable - Math.ceil(t.playTimeUnits)),
      fairnessScore: Math.round(-debt * 100) / 100,
    };
  });
}
