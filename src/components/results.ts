import type {
  Game,
  Player,
  PlayerWithStatus,
  RotationPlan,
  ReplacementSuggestion,
} from "../types/index.js";
import { getReplacements } from "../logic/rotation.js";

/** Lookup map from player ID to Player for rendering names */
type PlayerMap = Map<string, Player>;

/**
 * Renders the full rotation plan with player chips and live replacement support.
 */
export function renderResults(
  container: HTMLElement,
  plan: RotationPlan,
  playerMap: PlayerMap,
  playersPerTeam: number,
): void {
  container.innerHTML = "";

  const totalPlayers = playerMap.size;
  const header = document.createElement("div");
  header.innerHTML = `
    <h2>Rotation Plan</h2>
    <p class="subtitle">
      ${totalPlayers} players, ${playersPerTeam} per team,
      ${plan.games.length} game(s)
    </p>
  `;
  container.appendChild(header);

  for (const game of plan.games) {
    const card = renderGameCard(game, playerMap);
    container.appendChild(card);
  }
}

/**
 * Live-updates all game cards with current player statuses.
 * Updates chip styles and replacement suggestions.
 */
export function updateResultsLive(
  container: HTMLElement,
  plan: RotationPlan,
  currentPlayers: PlayerWithStatus[],
): void {
  const playerMap = new Map(currentPlayers.map((p) => [p.id, p]));
  const unavailableIds = new Set(
    currentPlayers.filter((p) => p.status !== "active").map((p) => p.id),
  );

  const cards = container.querySelectorAll<HTMLElement>(".game-card");

  for (let i = 0; i < cards.length && i < plan.games.length; i++) {
    const card = cards[i];
    const game = plan.games[i];

    // Update on-field chip styles
    const fieldChips = card.querySelectorAll<HTMLElement>(
      ".game-section:first-of-type .chip",
    );
    for (const chip of fieldChips) {
      const pid = chip.dataset.playerId;
      if (!pid) continue;
      const player = playerMap.get(pid);
      chip.classList.remove("chip-injured", "chip-late");
      if (player?.status === "injured") chip.classList.add("chip-injured");
      if (player?.status === "late") chip.classList.add("chip-late");
    }

    // Update replacement slot
    const slot = card.querySelector<HTMLElement>(".replacement-slot");
    if (!slot) continue;

    const suggestions = getReplacements(game, unavailableIds);
    if (suggestions.length === 0) {
      slot.innerHTML = "";
      continue;
    }

    slot.innerHTML = `
      <div class="replacement-card">
        <span class="replacement-title">Suggested Replacements</span>
        ${suggestions.map((s) => renderReplacementRow(s, playerMap)).join("")}
      </div>
    `;
  }
}

function renderGameCard(game: Game, playerMap: PlayerMap): HTMLElement {
  const card = document.createElement("div");
  card.className = "game-card";
  card.dataset.gameNumber = String(game.gameNumber);

  const title = document.createElement("h3");
  title.textContent = `Game ${game.gameNumber}`;
  card.appendChild(title);

  // On field
  const fieldSection = document.createElement("div");
  fieldSection.className = "game-section";
  const fieldLabel = document.createElement("span");
  fieldLabel.className = "game-section-label";
  fieldLabel.textContent = "On Field";
  fieldSection.appendChild(fieldLabel);
  const fieldChips = document.createElement("div");
  fieldChips.className = "chip-list";
  for (const id of game.onField) {
    fieldChips.appendChild(createChip(id, playerMap, "field"));
  }
  fieldSection.appendChild(fieldChips);
  card.appendChild(fieldSection);

  // Bench
  const benchSection = document.createElement("div");
  benchSection.className = "game-section";
  const benchLabel = document.createElement("span");
  benchLabel.className = "game-section-label";
  benchLabel.textContent = "Bench";
  benchSection.appendChild(benchLabel);
  const benchChips = document.createElement("div");
  benchChips.className = "chip-list";
  if (game.bench.length === 0) {
    const none = document.createElement("span");
    none.className = "chip-none";
    none.textContent = "\u2014";
    benchChips.appendChild(none);
  } else {
    for (const id of game.bench) {
      benchChips.appendChild(createChip(id, playerMap, "bench"));
    }
  }
  benchSection.appendChild(benchChips);
  card.appendChild(benchSection);

  // Replacement slot (populated live)
  const replacementSlot = document.createElement("div");
  replacementSlot.className = "replacement-slot";
  card.appendChild(replacementSlot);

  return card;
}

function createChip(
  playerId: string,
  playerMap: PlayerMap,
  role: "field" | "bench",
): HTMLElement {
  const chip = document.createElement("span");
  chip.className = `chip chip-${role}`;
  chip.dataset.playerId = playerId;
  const player = playerMap.get(playerId);
  chip.textContent = player?.name ?? playerId;
  return chip;
}

function renderReplacementRow(
  suggestion: ReplacementSuggestion,
  playerMap: PlayerMap,
): string {
  const outName = escapeHtml(playerMap.get(suggestion.outPlayerId)?.name ?? "?");

  if (suggestion.inPlayerId) {
    const inName = escapeHtml(playerMap.get(suggestion.inPlayerId)?.name ?? "?");
    return `
      <div class="replacement-row">
        <span class="chip chip-injured">${outName}</span>
        <span class="replacement-arrow">&rarr;</span>
        <span class="chip chip-replacement">${inName}</span>
      </div>
    `;
  }

  return `
    <div class="replacement-row">
      <span class="chip chip-injured">${outName}</span>
      <span class="replacement-arrow">&rarr;</span>
      <span class="replacement-none">No available replacement</span>
    </div>
  `;
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
