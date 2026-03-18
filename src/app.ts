import { createForm } from "./components/form.js";
import { createLogo } from "./components/logo.js";
import { renderResults, updateResultsLive } from "./components/results.js";
import { renderSummary, clearSummary } from "./components/summary.js";
import {
  generateInitialPlan,
  applyEvents,
} from "./logic/rotation.js";
import { validateInputs, hasErrors, computeSummary } from "./logic/validate.js";
import type {
  Player,
  PlayerWithStatus,
  RotationEvent,
  RotationPlan,
} from "./types/index.js";

/**
 * App state — holds the original plan and config so we can recompute
 * when player statuses change without re-submitting the form.
 */
interface AppState {
  /** The initial plan generated from active players at submit time */
  initialPlan: RotationPlan;
  /** All players that were active when the plan was generated */
  originalPlayerIds: string[];
  /** Players per team setting used for this plan */
  playersPerTeam: number;
  /** Full player lookup (ID → Player) for rendering names */
  playerMap: Map<string, Player>;
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

  const formHandle = createForm((handle) => {
    handle.clearErrors();
    clearSummary(summaryContainer);
    resultsContainer.innerHTML = "";
    state = null;

    const allPlayers = handle.getPlayers();
    const activePlayers = allPlayers.filter((p) => p.status === "active");
    const playersPerTeam = handle.getPlayersPerTeam();
    const numberOfGames = handle.getNumberOfGames();

    // Validate against active players only
    const errors = validateInputs(activePlayers.length, playersPerTeam, numberOfGames);
    if (hasErrors(errors)) {
      handle.showErrors(errors);
      return;
    }

    const summary = computeSummary(activePlayers.length, playersPerTeam, numberOfGames);
    renderSummary(summaryContainer, summary);

    // Build player map from ALL players (so we can look up names later
    // even for players who become late/injured after generation)
    const playerMap = new Map<string, Player>(
      allPlayers.map((p) => [p.id, { id: p.id, name: p.name }]),
    );

    handle.setLoading(true);
    setTimeout(() => {
      const plan = generateInitialPlan({
        players: activePlayers,
        playersPerTeam,
        numberOfGames,
      });

      state = {
        initialPlan: plan,
        originalPlayerIds: activePlayers.map((p) => p.id),
        playersPerTeam,
        playerMap,
      };

      renderResults(resultsContainer, plan, playerMap, playersPerTeam);
      handle.setLoading(false);
    }, 300);
  });

  // Live updates: when a player status changes after generation,
  // derive events from current statuses and recompute the plan
  formHandle.playerList.onStatusChange(() => {
    if (!state) return;

    const currentPlayers = formHandle.getPlayers();
    const events = deriveEvents(currentPlayers, state.initialPlan);
    const updatedPlan = applyEvents(
      state.initialPlan,
      events,
      state.originalPlayerIds,
      state.playersPerTeam,
    );

    // Full re-render when the plan structure changes (late players
    // cause full recalculation), live-update for injuries only
    if (events.some((e) => e.type === "late")) {
      renderResults(resultsContainer, updatedPlan, state.playerMap, state.playersPerTeam);
      // After re-render, also apply injury styling
      updateResultsLive(resultsContainer, updatedPlan, currentPlayers);
    } else {
      updateResultsLive(resultsContainer, state.initialPlan, currentPlayers);
    }
  });

  root.appendChild(formHandle.element);
  root.appendChild(summaryContainer);
  root.appendChild(resultsContainer);
}

/**
 * Derives rotation events from current player statuses.
 * Late → remove from all games. Injured → injured in game 1 (current game).
 */
function deriveEvents(
  players: PlayerWithStatus[],
  plan: RotationPlan,
): RotationEvent[] {
  const events: RotationEvent[] = [];
  const currentGameNumber = 1; // Default to game 1 for now

  for (const player of players) {
    if (player.status === "late") {
      events.push({ type: "late", playerId: player.id });
    } else if (player.status === "injured") {
      // Find the first game this player appears on field
      const gameOnField = plan.games.find((g) =>
        g.onField.includes(player.id),
      );
      events.push({
        type: "injured",
        playerId: player.id,
        gameNumber: gameOnField?.gameNumber ?? currentGameNumber,
      });
    }
  }

  return events;
}
