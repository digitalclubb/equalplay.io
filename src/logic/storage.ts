import type { Player, RotationEvent } from "../types/index.js";

const STORAGE_KEY = "equalplay_teams";
const LEGACY_KEY = "equalplay_state";

export interface SavedTeam {
  id: string;
  name: string;
  players: Player[];
  playersPerTeam: number;
  numberOfGames: number;
  events: RotationEvent[];
  currentGame: number;
  gameLabels: Record<string, string>;
  matchMode?: "setup" | "live";
}

export interface SavedData {
  teams: SavedTeam[];
  activeTeamId: string;
}

export function saveTeams(data: SavedData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // silently fail
  }
}

export function loadTeams(): SavedData | null {
  try {
    // Try new multi-team format first
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.teams) && parsed.teams.length > 0) {
        return parsed as SavedData;
      }
    }

    // Migrate legacy single-team format
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const old = JSON.parse(legacy);
      if (Array.isArray(old.players) && typeof old.playersPerTeam === "number") {
        const team: SavedTeam = {
          id: "team-1",
          name: "Team 1",
          players: old.players,
          playersPerTeam: old.playersPerTeam,
          numberOfGames: old.numberOfGames,
          events: old.events ?? [],
          currentGame: old.currentGame ?? 1,
          gameLabels: old.gameLabels ?? {},
        };
        const data: SavedData = { teams: [team], activeTeamId: team.id };
        // Save in new format and remove legacy
        saveTeams(data);
        localStorage.removeItem(LEGACY_KEY);
        return data;
      }
    }

    return null;
  } catch {
    return null;
  }
}

export function clearAllTeams(): void {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(LEGACY_KEY);
}
