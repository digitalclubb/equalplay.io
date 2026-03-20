/**
 * Viewer mode — read-only shared session.
 * Fetches state from Supabase, renders results, subscribes to live updates.
 */

import { createLogo } from "./components/logo.js";
import { renderResults } from "./components/results.js";
import type { ResultsCallbacks } from "./components/results.js";
import {
  generateInitialPlan,
  applyEvents,
} from "./logic/rotation.js";
import { loadSession, subscribeAsViewer, type SyncStatus } from "./logic/sync.js";
import type { SavedData } from "./logic/storage.js";
import type { Player, RotationPlan } from "./types/index.js";

// No-op callbacks — viewer cannot interact
const noopCallbacks: ResultsCallbacks = {
  onMarkLate() {},
  onMarkInjured() {},
  onMarkJoined() {},
  onMarkLeaving() {},
  onClearStatus() {},
  onGameLabelChange() {},
  onMakeSub() {},
  onNextGame() {},
  onStartNew() {},
};

function renderState(container: HTMLElement, data: SavedData): void {
  const team = data.teams.find((t) => t.id === data.activeTeamId) ?? data.teams[0];
  if (!team || team.players.length === 0) {
    container.innerHTML = `<p class="viewer-empty">No rotation data yet.</p>`;
    return;
  }

  const playerMap = new Map<string, Player>(
    team.players.map((p) => [p.id, p]),
  );

  const initialPlan: RotationPlan = generateInitialPlan({
    players: team.players,
    playersPerTeam: team.playersPerTeam,
    numberOfGames: team.numberOfGames,
  });

  const events = team.events ?? [];
  const currentGame = team.currentGame ?? 1;
  const allPlayerIds = team.players.map((p) => p.id);

  const plan = events.length > 0
    ? applyEvents(initialPlan, events, allPlayerIds, team.playersPerTeam, currentGame)
    : initialPlan;

  renderResults(
    container,
    plan,
    playerMap,
    team.playersPerTeam,
    events,
    allPlayerIds,
    currentGame,
    team.gameLabels ?? {},
    noopCallbacks,
    true, // readOnly
  );
}

export async function mountViewer(root: HTMLElement, sessionId: string): Promise<void> {
  // Header
  const headerBar = document.getElementById("header-bar");
  if (!headerBar) {
    const bar = document.createElement("div");
    bar.className = "header-bar";
    const header = document.createElement("header");
    header.className = "app-header";
    header.innerHTML = `
      ${createLogo()}
      <h1 class="subtitle">Fair team rotation for youth sports</h1>
    `;
    bar.appendChild(header);
    root.insertBefore(bar, root.firstChild);
  }

  // Status bar
  const statusBar = document.createElement("div");
  statusBar.className = "viewer-status";
  statusBar.textContent = "Loading live plan...";
  root.appendChild(statusBar);

  // Results container
  const resultsContainer = document.createElement("div");
  resultsContainer.id = "results";
  root.appendChild(resultsContainer);

  // Load initial state
  const data = await loadSession(sessionId);
  if (!data) {
    statusBar.textContent = "";
    resultsContainer.innerHTML = `
      <div class="viewer-error">
        <h3>Session not available</h3>
        <p>This link may have expired or the session hasn't been shared yet.</p>
      </div>
    `;
    return;
  }

  // Render initial state
  renderState(resultsContainer, data);
  statusBar.textContent = "Viewing live plan";
  statusBar.classList.add("viewer-status-live");

  // Subscribe to updates
  subscribeAsViewer(
    sessionId,
    (updatedData) => {
      renderState(resultsContainer, updatedData);
    },
    (status: SyncStatus) => {
      if (status === "connected") {
        statusBar.textContent = "Viewing live plan";
        statusBar.className = "viewer-status viewer-status-live";
      } else if (status === "polling") {
        statusBar.textContent = "Reconnecting...";
        statusBar.className = "viewer-status viewer-status-reconnecting";
      } else {
        statusBar.textContent = "Offline — showing last update";
        statusBar.className = "viewer-status viewer-status-offline";
      }
    },
  );
}
