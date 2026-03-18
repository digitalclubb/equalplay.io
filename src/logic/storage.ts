import type { Player, RotationEvent } from "../types/index.js";

const STORAGE_KEY = "equalplay_state";

export interface SavedState {
  players: Player[];
  playersPerTeam: number;
  numberOfGames: number;
  events: RotationEvent[];
  currentGame: number;
  gameLabels: Record<string, string>;
}

export function saveState(state: SavedState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage full or unavailable — silently fail
  }
}

export function loadState(): SavedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Basic shape validation
    if (
      !Array.isArray(parsed.players) ||
      typeof parsed.playersPerTeam !== "number" ||
      typeof parsed.numberOfGames !== "number"
    ) {
      return null;
    }
    return parsed as SavedState;
  } catch {
    return null;
  }
}

export function clearSavedState(): void {
  localStorage.removeItem(STORAGE_KEY);
}
