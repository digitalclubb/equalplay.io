import { createForm } from "./components/form.js";
import type { FormHandle } from "./components/form.js";
import { createLogo } from "./components/logo.js";
import { renderResults } from "./components/results.js";
import type { ResultsCallbacks } from "./components/results.js";
import { renderTeamTabs } from "./components/teamTabs.js";
import { showToast } from "./components/toast.js";
import {
  generateInitialPlan,
  applyEvents,
} from "./logic/rotation.js";
import {
  saveTeams,
  loadTeams,
} from "./logic/storage.js";
import type { SavedData } from "./logic/storage.js";
import { validateInputs, hasErrors } from "./logic/validate.js";
import type {
  Player,
  MatchMode,
  RotationEvent,
  RotationPlan,
} from "./types/index.js";

// ---- Per-team state ----

interface TeamState {
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

let nextTeamId = 1;
function generateTeamId(): string {
  return `team-${nextTeamId++}`;
}

// ---- App ----

export function mountApp(root: HTMLElement): void {
  // Header bar is static HTML in index.html for instant LCP.
  // Adopt existing elements; fall back to creating them if missing.
  let headerBar = document.getElementById("header-bar");
  let tabsContainer: HTMLElement | null = document.getElementById("tabs-container");

  if (!headerBar) {
    headerBar = document.createElement("div");
    headerBar.className = "header-bar";

    const header = document.createElement("header");
    header.className = "app-header";
    header.innerHTML = `
      ${createLogo()}
      <h1 class="subtitle">Fair team rotation for youth sports</h1>
    `;
    headerBar.appendChild(header);

    tabsContainer = document.createElement("div");
    headerBar.appendChild(tabsContainer);

    root.appendChild(headerBar);
  }

  if (!tabsContainer) {
    tabsContainer = document.createElement("nav");
    tabsContainer.setAttribute("aria-label", "Teams");
    headerBar.appendChild(tabsContainer);
  }

  const tabs = tabsContainer as HTMLElement;

  const resultsContainer = document.createElement("div");
  resultsContainer.id = "results";

  // Multi-team state
  let teams: TeamState[] = [createEmptyTeam(generateTeamId(), "Team 1")];
  let activeTeamId = teams[0].id;
  let previousEvents: RotationEvent[] | null = null;

  function getActive(): TeamState {
    return teams.find((t) => t.id === activeTeamId)!;
  }

  // ---- Persistence ----

  // ---- Session sync (lazy-loaded) ----

  let sessionId: string | null = localStorage.getItem("equalplay_session_id");
  let ownerSync: { push(state: SavedData): void; destroy(): void } | null = null;
  let sharePending = false;
  let shareEnabled = false;

  // Lazy-load Supabase + sync module only when needed
  async function loadSync() {
    const { supabase } = await import("./logic/supabase.js");
    if (!supabase) return null;
    const sync = await import("./logic/sync.js");
    return { supabase, ...sync };
  }

  // Reconnect sync if session was previously shared
  if (sessionId) {
    loadSync().then((mod) => {
      if (mod) {
        shareEnabled = true;
        ownerSync = mod.createOwnerSync(sessionId!);
      }
    });
  } else {
    // Probe for Supabase availability in the background
    loadSync().then((mod) => {
      if (mod) {
        shareEnabled = true;
        rerenderResults(); // show the share button now that we know it's available
      }
    });
  }

  function buildSavedData(): SavedData {
    return {
      teams: teams.map((t) => ({
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
      activeTeamId,
    };
  }

  function persist(): void {
    const data = buildSavedData();
    saveTeams(data);
    // Non-blocking async sync to Supabase (if shared)
    ownerSync?.push(data);
  }

  // ---- Rendering ----

  function renderTabs(): void {
    renderTeamTabs(
      tabs,
      teams.map((t) => ({ id: t.id, name: t.name })),
      activeTeamId,
      {
        onSelect(teamId) {
          saveDraft();
          activeTeamId = teamId;
          previousEvents = null;
          rerenderAll();
          persist();
        },
        onAdd() {
          saveDraft();
          const id = generateTeamId();
          const name = `Team ${teams.length + 1}`;
          teams.push(createEmptyTeam(id, name));
          activeTeamId = id;
          previousEvents = null;
          rerenderAll();
          persist();
          showToast(`${name} created.`);
        },
        onDelete(teamId) {
          if (teams.length <= 1) return;
          teams = teams.filter((t) => t.id !== teamId);
          if (activeTeamId === teamId) {
            activeTeamId = teams[0].id;
          }
          previousEvents = null;
          rerenderAll();
          persist();
          showToast("Team deleted.");
        },
        onRename(teamId, newName) {
          const team = teams.find((t) => t.id === teamId);
          if (team) {
            team.name = newName;
            renderTabs();
            persist();
          }
        },
      },
    );
  }

  /** Convert string-keyed overrides to number-keyed for the logic layer */
  function numericOverrides(overrides: Record<string, number>): Record<number, number> | undefined {
    const keys = Object.keys(overrides);
    if (keys.length === 0) return undefined;
    const out: Record<number, number> = {};
    for (const k of keys) out[Number(k)] = overrides[k];
    return out;
  }

  function rerenderResults(): void {
    const team = getActive();
    if (!team.initialPlan) {
      resultsContainer.innerHTML = "";
      return;
    }

    const overrides = numericOverrides(team.teamSizeOverrides);
    const needsRecompute = team.events.length > 0 || overrides;
    const plan = needsRecompute
      ? applyEvents(
          team.initialPlan,
          team.events,
          team.originalPlayerIds,
          team.playersPerTeam,
          team.currentGame,
          overrides,
        )
      : team.initialPlan;

    renderResults(
      resultsContainer,
      plan,
      team.playerMap,
      team.playersPerTeam,
      team.events,
      team.originalPlayerIds,
      team.currentGame,
      team.gameLabels,
      callbacks,
      false,
      team.matchMode,
      team.teamSizeOverrides,
    );
  }

  function rerenderAll(): void {
    rebuildForm();
    renderTabs();
    rerenderResults();
  }

  // ---- Actions ----

  function undo(): void {
    const team = getActive();
    if (!team.initialPlan || previousEvents === null) return;
    team.events = previousEvents;
    previousEvents = null;
    rerenderResults();
    persist();
    showToast("Undone");
  }

  function applyAction(mutate: () => void): void {
    const team = getActive();
    if (!team.initialPlan) return;
    previousEvents = [...team.events];
    mutate();
    rerenderResults();
    persist();
  }

  function getName(playerId: string): string {
    return getActive().playerMap.get(playerId)?.name ?? "Player";
  }

  // ---- Callbacks ----

  const callbacks: ResultsCallbacks = {
    onMarkLate(playerId) {
      const name = getName(playerId);
      applyAction(() => {
        const team = getActive();
        team.events = team.events.filter((e) => !("playerId" in e && e.playerId === playerId));
        team.events.push({ type: "late", playerId });
      });
      showToast(`${name} isn't here yet. Rotation updated.`, undo);
    },

    onMarkInjured(playerId, gameNumber) {
      const name = getName(playerId);
      applyAction(() => {
        const team = getActive();
        team.events = team.events.filter((e) => !("playerId" in e && e.playerId === playerId));
        team.events.push({ type: "injured", playerId, gameNumber });
      });
      showToast(`${name} injured. Use Make sub to replace.`, undo);
    },

    onMarkJoined(playerId) {
      const name = getName(playerId);
      applyAction(() => {
        getActive().events.push({ type: "joined", playerId, duringGame: getActive().currentGame });
      });
      showToast(`${name} has arrived and is on the bench.`, undo);
    },

    onMarkLeaving(playerId, afterGame) {
      const name = getName(playerId);
      applyAction(() => {
        const team = getActive();
        // Remove any existing leaving event for this player
        team.events = team.events.filter(
          (e) => !(e.type === "leaving" && e.playerId === playerId),
        );
        team.events.push({ type: "leaving", playerId, afterGame });
      });
      showToast(`${name} leaves after game ${afterGame}. Rotation updated.`, undo);
    },

    onClearStatus(playerId) {
      const name = getName(playerId);
      applyAction(() => {
        const team = getActive();
        team.events = team.events.filter((e) => !("playerId" in e && e.playerId === playerId));
      });
      showToast(`${name} is back in the rotation.`, undo);
    },

    onTeamSizeChange(gameNumber, size) {
      const team = getActive();
      if (size === team.playersPerTeam) {
        delete team.teamSizeOverrides[String(gameNumber)];
      } else {
        team.teamSizeOverrides[String(gameNumber)] = size;
      }
      rerenderResults();
      persist();
    },

    onGameLabelChange(gameNumber, label) {
      const team = getActive();
      if (label) {
        team.gameLabels[String(gameNumber)] = label;
      } else {
        delete team.gameLabels[String(gameNumber)];
      }
      persist();
    },

    onMakeSub(gameNumber, playerOut, playerIn) {
      const outName = getName(playerOut);
      const inName = getName(playerIn);
      applyAction(() => {
        getActive().events.push({ type: "sub", gameNumber, playerOut, playerIn });
      });
      showToast(`${inName} on for ${outName}.`, undo);
    },

    onNextGame() {
      const team = getActive();
      if (!team.initialPlan) return;
      const totalGames = team.initialPlan.games.length;
      if (team.currentGame > totalGames) return;
      const nextNum = team.currentGame + 1;
      team.currentGame = nextNum;
      rerenderResults();
      persist();
      if (nextNum > totalGames) {
        showToast("All games completed.");
      } else {
        showToast(`Game ${nextNum} is now live.`);
      }
    },

    onStartMatch() {
      const team = getActive();
      team.matchMode = "live";
      rerenderResults();
      persist();
      showToast("Game 1 is live.");
    },

    onStartNew() {
      const team = getActive();
      team.initialPlan = null;
      team.events = [];
      team.currentGame = 1;
      team.gameLabels = {};
      team.matchMode = "setup";
      team.teamSizeOverrides = {};
      team.playerMap = new Map();
      team.originalPlayerIds = [];
      previousEvents = null;
      resultsContainer.innerHTML = "";

      // Disconnect shared session — old link becomes stale
      if (ownerSync) {
        ownerSync.destroy();
        ownerSync = null;
      }
      sessionId = null;
      localStorage.removeItem("equalplay_session_id");

      persist();
      showToast("Session cleared.");
    },

  };

  // Share — label is a getter so it reflects current state on every render
  Object.defineProperty(callbacks, "shareLabel", {
    get(): string {
      return sharePending ? "Sharing..." : "Share live plan \u2197";
    },
    enumerable: true,
  });

  // onShare only appears when Supabase is available (shareEnabled set async on load)
  Object.defineProperty(callbacks, "onShare", {
    get(): (() => Promise<void>) | undefined {
      if (!shareEnabled) return undefined;
      return async () => {
        if (sharePending) return;

        if (sessionId) {
          const url = `${window.location.origin}/session/${sessionId}`;
          try {
            await navigator.clipboard.writeText(url);
            showToast("Link copied");
          } catch {
            showToast("Could not copy link");
          }
          return;
        }

        sharePending = true;
        rerenderResults();

        const mod = await loadSync();
        if (!mod) {
          sharePending = false;
          rerenderResults();
          showToast("Sharing not available.");
          return;
        }

        const data = buildSavedData();
        const id = await mod.createSession(data);
        sharePending = false;

        if (id) {
          sessionId = id;
          localStorage.setItem("equalplay_session_id", id);
          ownerSync = mod.createOwnerSync(id);
          const url = `${window.location.origin}/session/${id}`;
          try {
            await navigator.clipboard.writeText(url);
            showToast("Link copied. Live updates enabled.");
          } catch {
            showToast("Live updates enabled");
          }
          rerenderResults();
        } else {
          rerenderResults();
          showToast("Could not share. Try again.");
        }
      };
    },
    enumerable: true,
  });

  // ---- Generate ----

  function generate(handle: FormHandle): void {
    handle.clearErrors();
    resultsContainer.innerHTML = "";
    previousEvents = null;

    const players = handle.getPlayers();
    const playersPerTeam = handle.getPlayersPerTeam();
    const numberOfGames = handle.getNumberOfGames();

    const errors = validateInputs(players.length, playersPerTeam, numberOfGames);
    if (hasErrors(errors)) {
      handle.showErrors(errors);
      return;
    }

    const playerMap = new Map<string, Player>(
      players.map((p) => [p.id, p]),
    );

    handle.setLoading(true);
    setTimeout(() => {
      const plan = generateInitialPlan({ players, playersPerTeam, numberOfGames });
      const team = getActive();

      team.initialPlan = plan;
      team.originalPlayerIds = players.map((p) => p.id);
      team.playersPerTeam = playersPerTeam;
      team.numberOfGames = numberOfGames;
      team.playerMap = playerMap;
      team.events = [];
      team.currentGame = 1;
      team.gameLabels = {};
      team.matchMode = "setup";
      team.teamSizeOverrides = {};

      rerenderResults();
      persist();
      handle.setLoading(false);
    }, 200);
  }

  // Form container — rebuilt on every team switch so inputs are fresh
  const formContainer = document.createElement("div");
  let currentFormHandle: { getRawNames: () => string[] } | null = null;

  /** Save current form inputs to the active team's draft before switching */
  function saveDraft(): void {
    if (currentFormHandle) {
      getActive().draftPlayerNames = currentFormHandle.getRawNames();
    }
  }

  function rebuildForm(): void {
    formContainer.innerHTML = "";
    const team = getActive();
    const form = createForm(generate, team.draftPlayerNames);
    currentFormHandle = form;
    formContainer.appendChild(form.element);
  }

  // ---- Restore ----

  const saved = loadTeams();
  if (saved) {
    teams = saved.teams.map((st) => {
      const playerMap = new Map<string, Player>(
        st.players.map((p) => [p.id, p]),
      );

      const numPart = parseInt(st.id.replace("team-", ""), 10);
      if (!isNaN(numPart) && numPart >= nextTeamId) {
        nextTeamId = numPart + 1;
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

    if (teams.length === 0) {
      teams = [createEmptyTeam(generateTeamId(), "Team 1")];
    }

    activeTeamId = saved.activeTeamId;
    if (!teams.find((t) => t.id === activeTeamId)) {
      activeTeamId = teams[0].id;
    }
  }

  // ---- Mount ----

  root.appendChild(formContainer);
  root.appendChild(resultsContainer);
  rerenderAll();
}
