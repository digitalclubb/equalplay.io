import { createForm } from "./components/form.js";
import { createLogo } from "./components/logo.js";
import { renderResults } from "./components/results.js";
import type { ResultsCallbacks } from "./components/results.js";
import { renderSummary, clearSummary } from "./components/summary.js";
import { showToast } from "./components/toast.js";
import {
  generateInitialPlan,
  applyEvents,
  getReplacements,
  getUnavailableForGame,
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
  currentGame: number;
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
  let previousEvents: RotationEvent[] | null = null;

  function rerender(): void {
    if (!state) return;

    const plan = state.events.length > 0
      ? applyEvents(
          state.initialPlan,
          state.events,
          state.originalPlayerIds,
          state.playersPerTeam,
          state.currentGame,
        )
      : state.initialPlan;

    renderResults(
      resultsContainer,
      plan,
      state.playerMap,
      state.playersPerTeam,
      state.events,
      state.originalPlayerIds,
      state.currentGame,
      callbacks,
    );
  }

  function undo(): void {
    if (!state || previousEvents === null) return;
    state.events = previousEvents;
    previousEvents = null;
    rerender();
    showToast("Action undone");
  }

  function applyAction(mutate: () => void): void {
    if (!state) return;
    previousEvents = [...state.events];
    mutate();
    rerender();
  }

  function getName(playerId: string): string {
    return state?.playerMap.get(playerId)?.name ?? "Player";
  }

  function findReplacementName(playerId: string, gameNumber: number): string | null {
    if (!state) return null;
    const plan = applyEvents(
      state.initialPlan,
      state.events,
      state.originalPlayerIds,
      state.playersPerTeam,
      state.currentGame,
    );
    const game = plan.games.find((g) => g.gameNumber === gameNumber);
    if (!game) return null;

    const unavailable = getUnavailableForGame(
      gameNumber,
      state.originalPlayerIds,
      state.events,
    );
    const suggestions = getReplacements(game, unavailable);
    const match = suggestions.find((s) => s.outPlayerId === playerId);
    if (match?.inPlayerId) {
      return state.playerMap.get(match.inPlayerId)?.name ?? null;
    }
    return null;
  }

  const callbacks: ResultsCallbacks = {
    onMarkLate(playerId) {
      const name = getName(playerId);
      applyAction(() => {
        state!.events = state!.events.filter((e) => e.playerId !== playerId);
        state!.events.push({ type: "late", playerId });
      });
      showToast(`${name} marked as late. Rotation updated.`, undo);
    },

    onMarkInjured(playerId, gameNumber) {
      const name = getName(playerId);
      applyAction(() => {
        state!.events = state!.events.filter((e) => e.playerId !== playerId);
        state!.events.push({ type: "injured", playerId, gameNumber });
      });
      const replacementName = findReplacementName(playerId, gameNumber);
      const detail = replacementName
        ? `Replacement: ${replacementName}`
        : "No replacement available";
      showToast(`${name} injured in Game ${gameNumber}. ${detail}`, undo);
    },

    onMarkJoined(playerId) {
      const name = getName(playerId);
      applyAction(() => {
        state!.events.push({ type: "joined", playerId });
      });
      showToast(`${name} is now available and on the bench.`, undo);
    },

    onClearStatus(playerId) {
      const name = getName(playerId);
      applyAction(() => {
        state!.events = state!.events.filter((e) => e.playerId !== playerId);
      });
      showToast(`${name} restored to active.`, undo);
    },
  };

  const formHandle = createForm((handle) => {
    handle.clearErrors();
    clearSummary(summaryContainer);
    resultsContainer.innerHTML = "";
    state = null;
    previousEvents = null;

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
        currentGame: 1,
      };

      rerender();
      handle.setLoading(false);
    }, 300);
  });

  root.appendChild(formHandle.element);
  root.appendChild(summaryContainer);
  root.appendChild(resultsContainer);
}
