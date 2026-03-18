import { createForm } from "./components/form.js";
import { createLogo } from "./components/logo.js";
import { renderResults, updateReplacements } from "./components/results.js";
import { renderSummary, clearSummary } from "./components/summary.js";
import { generateRotation } from "./logic/generateRotation.js";
import { validateInputs, hasErrors, computeSummary } from "./logic/validate.js";
import type { RotationConfig, RotationResult } from "./types/index.js";

/** Mounts the app into the given root element */
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

  // Track the last generated result so we can live-update replacements
  let lastResult: RotationResult | null = null;

  const formHandle = createForm((handle) => {
    handle.clearErrors();
    clearSummary(summaryContainer);
    resultsContainer.innerHTML = "";
    lastResult = null;

    const allPlayers = handle.getPlayers();
    const activePlayers = allPlayers.filter((p) => p.status === "active");
    const playersPerTeam = handle.getPlayersPerTeam();
    const numberOfGames = handle.getNumberOfGames();
    const substitutionType = handle.getSubstitutionType();

    // Validate against active players only
    const errors = validateInputs(activePlayers.length, playersPerTeam, numberOfGames);
    if (hasErrors(errors)) {
      handle.showErrors(errors);
      return;
    }

    const config: RotationConfig = {
      players: activePlayers,
      playersPerTeam,
      numberOfGames,
      substitutionType,
    };

    const summary = computeSummary(activePlayers.length, playersPerTeam, numberOfGames);
    renderSummary(summaryContainer, summary);

    handle.setLoading(true);
    setTimeout(() => {
      lastResult = generateRotation(config);
      renderResults(resultsContainer, lastResult, () => handle.getPlayers());
      handle.setLoading(false);
    }, 300);
  });

  // When a player's status changes after generation, live-update replacement suggestions
  formHandle.playerList.onStatusChange(() => {
    if (lastResult) {
      updateReplacements(resultsContainer, () => formHandle.getPlayers());
    }
  });

  root.appendChild(formHandle.element);
  root.appendChild(summaryContainer);
  root.appendChild(resultsContainer);
}
