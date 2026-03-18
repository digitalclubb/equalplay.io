import type { GameSummary } from "../types/index.js";

/** Renders the game summary card and optional fairness warning */
export function renderSummary(container: HTMLElement, summary: GameSummary): void {
  const avgFormatted = Number.isInteger(summary.avgPlaytime)
    ? summary.avgPlaytime.toString()
    : summary.avgPlaytime.toFixed(1);

  let html = `
    <div class="summary-card">
      <h3>Game summary</h3>
      <div class="summary-grid">
        <div class="summary-stat">
          <span class="summary-value">${summary.totalPlayers}</span>
          <span class="summary-label">Total players</span>
        </div>
        <div class="summary-stat">
          <span class="summary-value">${summary.playersOnField}</span>
          <span class="summary-label">On field</span>
        </div>
        <div class="summary-stat">
          <span class="summary-value">${summary.benchPerGame}</span>
          <span class="summary-label">On the bench</span>
        </div>
        <div class="summary-stat">
          <span class="summary-value">${summary.totalSlots}</span>
          <span class="summary-label">Play slots</span>
        </div>
        <div class="summary-stat">
          <span class="summary-value">${avgFormatted}</span>
          <span class="summary-label">Average per player</span>
        </div>
      </div>
  `;

  if (!summary.isEvenDistribution) {
    html += `
      <div class="fairness-warning">
        Perfectly equal playing time isn't possible with these numbers. Some players may play slightly more than others.
      </div>
    `;
  }

  html += `</div>`;
  container.innerHTML = html;
}

export function clearSummary(container: HTMLElement): void {
  container.innerHTML = "";
}
