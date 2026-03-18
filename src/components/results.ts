import type { RotationResult } from "../types/index.js";

/** Renders the rotation results into the given container */
export function renderResults(
  container: HTMLElement,
  result: RotationResult,
): void {
  container.innerHTML = `
    <h2>Rotation Plan</h2>
    <p class="subtitle">
      ${result.totalPlayers} players, ${result.playersPerTeam} per team,
      ${result.games.length} game(s) — subs: ${result.substitutionType}
    </p>
  `;

  for (const game of result.games) {
    const card = document.createElement("div");
    card.className = "game-card";
    card.innerHTML = `
      <h3>Game ${game.gameNumber}</h3>
      <p><strong>Starters:</strong> ${game.starters.map((p) => p.name).join(", ")}</p>
      <p><strong>Bench:</strong> ${game.bench.length ? game.bench.map((p) => p.name).join(", ") : "—"}</p>
    `;
    container.appendChild(card);
  }
}
