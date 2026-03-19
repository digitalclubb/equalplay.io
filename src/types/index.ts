// ---- Core domain types (used by pure logic) ----

export interface Player {
  id: string;
  name: string;
}

export interface Game {
  gameNumber: number;
  onField: string[]; // player IDs
  bench: string[];   // player IDs
}

export interface RotationPlan {
  games: Game[];
}

export type RotationEvent =
  | { type: "late"; playerId: string }
  | { type: "joined"; playerId: string }
  | { type: "injured"; playerId: string; gameNumber: number }
  | { type: "sub"; gameNumber: number; playerOut: string; playerIn: string };

export interface RotationConfig {
  players: Player[];
  playersPerTeam: number;
  numberOfGames: number;
}

export interface ReplacementSuggestion {
  outPlayerId: string;
  inPlayerId: string | null;
}

/** Per-player fairness stats computed from a rotation plan */
export interface PlayerStats {
  playerId: string;
  /** Fractional play time: full game = 1.0, sub appearance = 0.5 */
  playTimeUnits: number;
  gamesBenched: number;
  /** playTimeUnits - expectedPlayTime. Negative = underplayed, positive = overplayed */
  fairnessScore: number;
}

// ---- UI-layer types ----

export enum SubstitutionType {
  None = "none",
  Halftime = "halftime",
  Rolling = "rolling",
}

export interface ValidationErrors {
  players?: string;
  playersPerTeam?: string;
  numberOfGames?: string;
}

export interface GameSummary {
  totalPlayers: number;
  playersOnField: number;
  benchPerGame: number;
  totalSlots: number;
  avgPlaytime: number;
  isEvenDistribution: boolean;
}
