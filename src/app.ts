import { createForm } from "./components/form.js";
import { createLogo } from "./components/logo.js";
import { renderResults } from "./components/results.js";
import { renderSummary, clearSummary } from "./components/summary.js";
import { generateRotation } from "./logic/generateRotation.js";
import { validateInputs, hasErrors, computeSummary } from "./logic/validate.js";
import type { RotationConfig } from "./types/index.js";

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

  const formHandle = createForm((handle) => {
    // Clear previous output
    handle.clearErrors();
    clearSummary(summaryContainer);
    resultsContainer.innerHTML = "";

    const names = handle.getPlayerNames();
    const playersPerTeam = handle.getPlayersPerTeam();
    const numberOfGames = handle.getNumberOfGames();
    const substitutionType = handle.getSubstitutionType();

    // Validate
    const errors = validateInputs(names, playersPerTeam, numberOfGames);
    if (hasErrors(errors)) {
      handle.showErrors(errors);
      return;
    }

    const config: RotationConfig = {
      players: names.map((name) => ({ name })),
      playersPerTeam,
      numberOfGames,
      substitutionType,
    };

    // Show summary before generating
    const summary = computeSummary(names.length, playersPerTeam, numberOfGames);
    renderSummary(summaryContainer, summary);

    // Brief loading state so the user sees the button respond
    handle.setLoading(true);
    setTimeout(() => {
      const result = generateRotation(config);
      renderResults(resultsContainer, result);
      handle.setLoading(false);
    }, 300);
  });

  root.appendChild(formHandle.element);
  root.appendChild(summaryContainer);
  root.appendChild(resultsContainer);
}
