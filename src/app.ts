import { createForm } from "./components/form.js";
import { createLogo } from "./components/logo.js";
import { renderResults } from "./components/results.js";
import { renderSummary, clearSummary } from "./components/summary.js";
import {
  generateInitialPlan,
  applyEvents,
} from "./logic/rotation.js";
import { validateInputs, hasErrors, computeSummary } from "./logic/validate.js";
import type {
  Player,
  RotationEvent,
  RotationPlan,
} from "./types/index.js";

interface AppState {
  initialPlan: RotationPlan;
  originalPlayerIds: string[];
  playersPerTeam: number;
  playerMap: Map<string, Player>;
  events: RotationEvent[];
}

export function mountApp(root: HTMLElement): void {
  const header = document.createElement("header");
  header.className = "app-header";
  header.innerHTML = `
    ${createLogo()}
    <p class="subtitle">Fair player rotations for youth team sports</p>
  `;
  root.appendChild(header);

  const summaryContainer = document.createElement("div");
  summaryContainer.id = "summary";

  const resultsContainer = document.createElement("div");
  resultsContainer.id = "results";

  let state: AppState | null = null;

  /** Re-renders the plan from current state + events */
  function rerender(): void {
    if (!state) return;

    const plan = state.events.length > 0
      ? applyEvents(
          state.initialPlan,
          state.events,
          state.originalPlayerIds,
          state.playersPerTeam,
        )
      : state.initialPlan;

    renderResults(
      resultsContainer,
      plan,
      state.playerMap,
      state.playersPerTeam,
      state.events,
      handlePlayerAction,
    );
  }

  /** Handles chip actions from the rotation view */
  function handlePlayerAction(event: RotationEvent): void {
    if (!state) return;

    // Handle "clear" events (prefixed with __clear__)
    const clearPrefix = "__clear__";
    if (event.type === "late" && event.playerId.startsWith(clearPrefix)) {
      const targetId = event.playerId.slice(clearPrefix.length);
      state.events = state.events.filter((e) => e.playerId !== targetId);
      rerender();
      return;
    }

    // Don't add duplicate events for the same player
    const existing = state.events.find((e) => e.playerId === event.playerId);
    if (existing) {
      // Replace the existing event
      state.events = state.events.filter((e) => e.playerId !== event.playerId);
    }
    state.events.push(event);
    rerender();
  }

  // Close action bars when tapping outside chips
  document.addEventListener("click", () => {
    document.querySelectorAll(".chip-actions").forEach((el) => el.remove());
    document.querySelectorAll(".chip-active").forEach((el) => {
      el.classList.remove("chip-active");
    });
  });

  const formHandle = createForm((handle) => {
    handle.clearErrors();
    clearSummary(summaryContainer);
    resultsContainer.innerHTML = "";
    state = null;

    const players = handle.getPlayers();
    const playersPerTeam = handle.getPlayersPerTeam();
    const numberOfGames = handle.getNumberOfGames();

    const errors = validateInputs(players.length, playersPerTeam, numberOfGames);
    if (hasErrors(errors)) {
      handle.showErrors(errors);
      return;
    }

    const summary = computeSummary(players.length, playersPerTeam, numberOfGames);
    renderSummary(summaryContainer, summary);

    const playerMap = new Map<string, Player>(
      players.map((p) => [p.id, p]),
    );

    handle.setLoading(true);
    setTimeout(() => {
      const plan = generateInitialPlan({
        players,
        playersPerTeam,
        numberOfGames,
      });

      state = {
        initialPlan: plan,
        originalPlayerIds: players.map((p) => p.id),
        playersPerTeam,
        playerMap,
        events: [],
      };

      rerender();
      handle.setLoading(false);
    }, 300);
  });

  root.appendChild(formHandle.element);
  root.appendChild(summaryContainer);
  root.appendChild(resultsContainer);
}
