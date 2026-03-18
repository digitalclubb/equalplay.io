export enum SubstitutionType {
  None = "none",
  Halftime = "halftime",
  Rolling = "rolling",
}

export interface Player {
  name: string;
}

/** A single game's lineup and substitutions */
export interface Game {
  gameNumber: number;
  starters: Player[];
  bench: Player[];
  substitutions: Substitution[];
}

export interface Substitution {
  /** When the sub happens (e.g. "halftime", "Q2", etc.) */
  timing: string;
  playerOut: Player;
  playerIn: Player;
}

/** The full rotation plan returned by the generator */
export interface RotationResult {
  games: Game[];
  playersPerTeam: number;
  totalPlayers: number;
  substitutionType: SubstitutionType;
}

/** User-supplied config passed into the rotation generator */
export interface RotationConfig {
  players: Player[];
  playersPerTeam: number;
  numberOfGames: number;
  substitutionType: SubstitutionType;
}

/** Validation errors keyed by field name */
export interface ValidationErrors {
  players?: string;
  playersPerTeam?: string;
  numberOfGames?: string;
}

/** Pre-generation summary stats derived from a valid config */
export interface GameSummary {
  totalPlayers: number;
  playersOnField: number;
  benchPerGame: number;
  totalSlots: number;
  avgPlaytime: number;
  isEvenDistribution: boolean;
}
