import type {
  Player,
  MatchMode,
  RotationEvent,
  RotationPlan,
} from "../types/index.js";
import type { SavedData } from "./storage.js";
import { generateInitialPlan } from "./rotation.js";

// ---- Per-team state ----

export interface TeamState {
  id: string;
  name: string;
  initialPlan: RotationPlan | null;
  originalPlayerIds: string[];
  playersPerTeam: number;
  numberOfGames: number;
  playerMap: Map<string, Player>;
  events: RotationEvent[];
  currentGame: number;
  gameLabels: Record<string, string>;
  matchMode: MatchMode;
  teamSizeOverrides: Record<string, number>;
  /** Draft player names — saved before generation so they survive tab switches */
  draftPlayerNames: string[];
}

function createEmptyTeam(id: string, name: string): TeamState {
  return {
    id,
    name,
    initialPlan: null,
    originalPlayerIds: [],
    playersPerTeam: 7,
    numberOfGames: 3,
    playerMap: new Map(),
    events: [],
    currentGame: 1,
    gameLabels: {},
    matchMode: "setup",
    teamSizeOverrides: {},
    draftPlayerNames: [],
  };
}

// ---- Team store ----

export class TeamStore {
  teams: TeamState[];
  activeTeamId: string;
  private nextTeamId = 1;

  constructor() {
    const first = createEmptyTeam(this.generateTeamId(), "Team 1");
    this.teams = [first];
    this.activeTeamId = first.id;
  }

  private generateTeamId(): string {
    return `team-${this.nextTeamId++}`;
  }

  getActive(): TeamState {
    return this.teams.find((t) => t.id === this.activeTeamId)!;
  }

  getTeam(teamId: string): TeamState | undefined {
    return this.teams.find((t) => t.id === teamId);
  }

  addTeam(): TeamState {
    const id = this.generateTeamId();
    const name = `Team ${this.teams.length + 1}`;
    const team = createEmptyTeam(id, name);
    this.teams.push(team);
    this.activeTeamId = id;
    return team;
  }

  deleteTeam(teamId: string): boolean {
    if (this.teams.length <= 1) return false;
    this.teams = this.teams.filter((t) => t.id !== teamId);
    if (this.activeTeamId === teamId) {
      this.activeTeamId = this.teams[0].id;
    }
    return true;
  }

  renameTeam(teamId: string, newName: string): boolean {
    const team = this.getTeam(teamId);
    if (!team) return false;
    team.name = newName;
    return true;
  }

  /** Build serialisable data for persistence */
  buildSavedData(): SavedData {
    return {
      teams: this.teams.map((t) => ({
        id: t.id,
        name: t.name,
        players: [...t.playerMap.values()],
        playersPerTeam: t.playersPerTeam,
        numberOfGames: t.numberOfGames,
        events: t.events,
        currentGame: t.currentGame,
        gameLabels: t.gameLabels,
        matchMode: t.matchMode,
        teamSizeOverrides: t.teamSizeOverrides,
      })),
      activeTeamId: this.activeTeamId,
    };
  }

  /** Restore from persisted data */
  restoreFrom(saved: SavedData): void {
    this.teams = saved.teams.map((st) => {
      const playerMap = new Map<string, Player>(
        st.players.map((p) => [p.id, p]),
      );

      const numPart = parseInt(st.id.replace("team-", ""), 10);
      if (!isNaN(numPart) && numPart >= this.nextTeamId) {
        this.nextTeamId = numPart + 1;
      }

      const plan = st.players.length > 0
        ? generateInitialPlan({
            players: st.players,
            playersPerTeam: st.playersPerTeam,
            numberOfGames: st.numberOfGames,
          })
        : null;

      return {
        id: st.id,
        name: st.name,
        initialPlan: plan,
        originalPlayerIds: st.players.map((p) => p.id),
        playersPerTeam: st.playersPerTeam,
        numberOfGames: st.numberOfGames,
        playerMap,
        events: st.events ?? [],
        currentGame: st.currentGame ?? 1,
        gameLabels: st.gameLabels ?? {},
        matchMode: st.matchMode ?? "setup",
        teamSizeOverrides: st.teamSizeOverrides ?? {},
        draftPlayerNames: st.players.map((p) => p.name),
      };
    });

    if (this.teams.length === 0) {
      const first = createEmptyTeam(this.generateTeamId(), "Team 1");
      this.teams = [first];
    }

    this.activeTeamId = saved.activeTeamId;
    if (!this.teams.find((t) => t.id === this.activeTeamId)) {
      this.activeTeamId = this.teams[0].id;
    }
  }
}
