import { createForm } from "./components/form.js";
import type { FormHandle } from "./components/form.js";
import { createLogo } from "./components/logo.js";
import { renderResults } from "./components/results.js";
import type { ResultsCallbacks } from "./components/results.js";
import { showToast } from "./components/toast.js";
import {
  generateInitialPlan,
  applyEvents,
  getReplacements,
  getUnavailableForGame,
} from "./logic/rotation.js";
import { saveState, loadState, clearSavedState } from "./logic/storage.js";
import { validateInputs, hasErrors } from "./logic/validate.js";
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
    <p class="subtitle">Fair rotations for youth sport</p>
  `;
  root.appendChild(header);

  const resultsContainer = document.createElement("div");
  resultsContainer.id = "results";

  let state: AppState | null = null;
  let previousEvents: RotationEvent[] | null = null;

  function persist(): void {
    if (!state) return;
    saveState({
      players: [...state.playerMap.values()],
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
      state.initialPlan, state.events, state.originalPlayerIds,
      state.playersPerTeam, state.currentGame,
    );
    const game = plan.games.find((g) => g.gameNumber === gameNumber);
    if (!game) return null;
    const unavailable = getUnavailableForGame(gameNumber, state.originalPlayerIds, state.events);
    const suggestions = getReplacements(game, unavailable);
    const match = suggestions.find((s) => s.outPlayerId === playerId);
    return match?.inPlayerId
      ? state.playerMap.get(match.inPlayerId)?.name ?? null
      : null;
  }

  function resetSession(): void {
    clearSavedState();
    state = null;
    previousEvents = null;
    resultsContainer.innerHTML = "";
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
      const detail = replacementName ? `${replacementName} comes on` : "No replacement available";
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

    onNextGame() {
      if (!state) return;
      const totalGames = state.initialPlan.games.length;
      if (state.currentGame > totalGames) return;
      const nextNum = state.currentGame + 1;
      state.currentGame = nextNum;
      rerender();
      persist();
      if (nextNum > totalGames) {
        showToast("All games completed.");
      } else {
        showToast(`Game ${nextNum} is now live.`);
      }
    },

    onStartNew() {
      resetSession();
      showToast("Session cleared.");
    },
  };

  /**
   * Auto-generate: called whenever squad or settings change.
   * Only generates if inputs are valid. No explicit button needed.
   */
  function autoGenerate(handle: FormHandle): void {
    handle.clearErrors();

    const players = handle.getPlayers();
    const playersPerTeam = handle.getPlayersPerTeam();
    const numberOfGames = handle.getNumberOfGames();

    // Don't generate until we have enough valid inputs
    const errors = validateInputs(players.length, playersPerTeam, numberOfGames);
    if (hasErrors(errors)) {
      // Show errors only if user has tried (has some players)
      if (players.length > 0) {
        handle.showErrors(errors);
      }
      // If currently invalid but we had a previous state, keep it
      if (!state) {
        resultsContainer.innerHTML = "";
      }
      return;
    }

    const playerMap = new Map<string, Player>(
      players.map((p) => [p.id, p]),
    );

    const plan = generateInitialPlan({
      players,
      playersPerTeam,
      numberOfGames,
    });

    // Preserve events and game labels if the player set hasn't changed
    const prevEvents = state?.events ?? [];
    const prevLabels = state?.gameLabels ?? {};
    const prevGame = state?.currentGame ?? 1;

    state = {
      initialPlan: plan,
      originalPlayerIds: players.map((p) => p.id),
      playersPerTeam,
      playerMap,
      events: prevEvents,
      currentGame: prevGame,
      gameLabels: prevLabels,
    };

    rerender();
    persist();
  }

  const formHandle = createForm(autoGenerate);

  // Auto-restore
  const saved = loadState();
  if (saved) {
    const playerMap = new Map<string, Player>(
      saved.players.map((p) => [p.id, p]),
    );
    const plan = generateInitialPlan({
      players: saved.players,
      playersPerTeam: saved.playersPerTeam,
      numberOfGames: saved.numberOfGames,
    });

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

  root.appendChild(formHandle.element);
  root.appendChild(resultsContainer);
}
