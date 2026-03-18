import { createForm } from "./components/form.js";
import type { FormHandle } from "./components/form.js";
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
import { saveState, loadState, clearSavedState } from "./logic/storage.js";
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
  gameLabels: Record<string, string>;
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

  function persist(): void {
    if (!state) return;
    const players = [...state.playerMap.values()];
    saveState({
      players,
      playersPerTeam: state.playersPerTeam,
      numberOfGames: state.initialPlan.games.length,
      events: state.events,
      currentGame: state.currentGame,
      gameLabels: state.gameLabels,
    });
  }

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
      state.gameLabels,
      callbacks,
    );
  }

  function undo(): void {
    if (!state || previousEvents === null) return;
    state.events = previousEvents;
    previousEvents = null;
    rerender();
    persist();
    showToast("Undone");
  }

  function applyAction(mutate: () => void): void {
    if (!state) return;
    previousEvents = [...state.events];
    mutate();
    rerender();
    persist();
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
        state!.events = state!.events.filter((e) => !("playerId" in e && e.playerId === playerId));
        state!.events.push({ type: "late", playerId });
      });
      showToast(`${name} isn't here yet. Rotation updated.`, undo);
    },

    onMarkInjured(playerId, gameNumber) {
      const name = getName(playerId);
      applyAction(() => {
        state!.events = state!.events.filter((e) => !("playerId" in e && e.playerId === playerId));
        state!.events.push({ type: "injured", playerId, gameNumber });
      });
      const replacementName = findReplacementName(playerId, gameNumber);
      const detail = replacementName
        ? `${replacementName} comes on`
        : "No replacement available";
      showToast(`${name} injured in game ${gameNumber}. ${detail}`, undo);
    },

    onMarkJoined(playerId) {
      const name = getName(playerId);
      applyAction(() => {
        state!.events.push({ type: "joined", playerId });
      });
      showToast(`${name} has arrived and is on the bench.`, undo);
    },

    onClearStatus(playerId) {
      const name = getName(playerId);
      applyAction(() => {
        state!.events = state!.events.filter((e) => !("playerId" in e && e.playerId === playerId));
      });
      showToast(`${name} is back in the rotation.`, undo);
    },

    onGameLabelChange(gameNumber, label) {
      if (!state) return;
      if (label) {
        state.gameLabels[String(gameNumber)] = label;
      } else {
        delete state.gameLabels[String(gameNumber)];
      }
      persist();
    },

    onMakeSub(gameNumber, playerOut, playerIn) {
      const outName = getName(playerOut);
      const inName = getName(playerIn);
      applyAction(() => {
        state!.events.push({ type: "sub", gameNumber, playerOut, playerIn });
      });
      showToast(`${inName} on for ${outName}.`, undo);
    },
  };

  function generateFromForm(handle: FormHandle): void {
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
        gameLabels: {},
      };

      rerender();
      persist();
      handle.setLoading(false);
    }, 300);
  }

  function restoreFromSaved(
    saved: NonNullable<ReturnType<typeof loadState>>,
  ): void {
    const playerMap = new Map<string, Player>(
      saved.players.map((p) => [p.id, p]),
    );

    const plan = generateInitialPlan({
      players: saved.players,
      playersPerTeam: saved.playersPerTeam,
      numberOfGames: saved.numberOfGames,
    });

    const summary = computeSummary(
      saved.players.length,
      saved.playersPerTeam,
      saved.numberOfGames,
    );
    renderSummary(summaryContainer, summary);

    state = {
      initialPlan: plan,
      originalPlayerIds: saved.players.map((p) => p.id),
      playersPerTeam: saved.playersPerTeam,
      playerMap,
      events: saved.events ?? [],
      currentGame: saved.currentGame ?? 1,
      gameLabels: saved.gameLabels ?? {},
    };

    rerender();
  }

  const formHandle = createForm(generateFromForm);

  // Try to restore saved state on load
  const saved = loadState();
  if (saved) {
    restoreFromSaved(saved);
    showToast("Previous session restored", () => {
      clearSavedState();
      state = null;
      resultsContainer.innerHTML = "";
      clearSummary(summaryContainer);
      showToast("Session cleared");
    });
  }

  root.appendChild(formHandle.element);
  root.appendChild(summaryContainer);
  root.appendChild(resultsContainer);
}
