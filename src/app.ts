import { createForm } from "./components/form.js";
import { renderResults } from "./components/results.js";
import { generateRotation } from "./logic/generateRotation.js";
import { SubstitutionType } from "./types/index.js";
import type { RotationConfig } from "./types/index.js";

/** Mounts the app into the given root element */
export function mountApp(root: HTMLElement): void {
  root.innerHTML = `
    <h1>Equal Play</h1>
    <p class="subtitle">Fair player rotations for youth team sports</p>
  `;

  const resultsContainer = document.createElement("div");
  resultsContainer.id = "results";

  const form = createForm((formEl) => {
    const config = parseFormInputs(formEl);
    if (!config) return;

    const result = generateRotation(config);
    renderResults(resultsContainer, result);
  });

  root.appendChild(form);
  root.appendChild(resultsContainer);
}

/** Extracts and validates form values into a typed config */
function parseFormInputs(form: HTMLFormElement): RotationConfig | null {
  const rawNames = (form.querySelector("#players") as HTMLTextAreaElement).value;
  const playersPerTeam = parseInt(
    (form.querySelector("#players-per-team") as HTMLInputElement).value,
  );
  const numberOfGames = parseInt(
    (form.querySelector("#num-games") as HTMLInputElement).value,
  );
  const substitutionType = (form.querySelector("#sub-type") as HTMLSelectElement)
    .value as SubstitutionType;

  // Split on newlines, trim whitespace, drop empty lines
  const names = rawNames
    .split("\n")
    .map((n) => n.trim())
    .filter(Boolean);

  if (names.length === 0) {
    alert("Enter at least one player name.");
    return null;
  }

  if (playersPerTeam < 1 || playersPerTeam > names.length) {
    alert(`Players per team must be between 1 and ${names.length}.`);
    return null;
  }

  return {
    players: names.map((name) => ({ name })),
    playersPerTeam,
    numberOfGames,
    substitutionType,
  };
}
