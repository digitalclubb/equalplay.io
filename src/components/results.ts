import type {
  Game,
  Player,
  RotationEvent,
  RotationPlan,
  ReplacementSuggestion,
} from "../types/index.js";
import { getReplacements } from "../logic/rotation.js";

type PlayerMap = Map<string, Player>;

export interface ResultsCallbacks {
  onMarkLate: (playerId: string) => void;
  onMarkInjured: (playerId: string, gameNumber: number) => void;
  onClearStatus: (playerId: string) => void;
}

/**
 * Renders the full rotation plan. Chips are tappable — tapping opens
 * a bottom action sheet with status options.
 */
export function renderResults(
  container: HTMLElement,
  plan: RotationPlan,
  playerMap: PlayerMap,
  playersPerTeam: number,
  events: RotationEvent[],
  callbacks: ResultsCallbacks,
): void {
  container.innerHTML = "";

  const activePlayerCount = playerMap.size - countLate(events);
  const header = document.createElement("div");
  header.innerHTML = `
    <h2>Rotation Plan</h2>
    <p class="subtitle">
      ${activePlayerCount} active players, ${playersPerTeam} per team,
      ${plan.games.length} game(s)
    </p>
    <p class="results-hint">Tap a player to update availability during the match</p>
  `;
  container.appendChild(header);

  // Build lookup sets from events
  const lateIds = new Set<string>();
  const injuredIds = new Map<string, number>();
  for (const e of events) {
    if (e.type === "late") lateIds.add(e.playerId);
    else injuredIds.set(e.playerId, e.gameNumber);
  }
  const unavailableIds = new Set([...lateIds, ...injuredIds.keys()]);

  for (const game of plan.games) {
    container.appendChild(
      renderGameCard(game, playerMap, lateIds, injuredIds, unavailableIds, callbacks),
    );
  }

  // Single action sheet element shared across all chips
  container.appendChild(createActionSheet());
}

// ---- Game card ----

function renderGameCard(
  game: Game,
  playerMap: PlayerMap,
  lateIds: Set<string>,
  injuredIds: Map<string, number>,
  unavailableIds: Set<string>,
  callbacks: ResultsCallbacks,
): HTMLElement {
  const card = document.createElement("div");
  card.className = "game-card";

  const title = document.createElement("h3");
  title.textContent = `Game ${game.gameNumber}`;
  card.appendChild(title);

  // On field
  card.appendChild(
    renderSection("On Field", game.onField, "field", game.gameNumber, playerMap, lateIds, injuredIds, callbacks),
  );

  // Bench
  if (game.bench.length === 0) {
    const benchSection = document.createElement("div");
    benchSection.className = "game-section";
    const benchLabel = document.createElement("span");
    benchLabel.className = "game-section-label";
    benchLabel.textContent = "Bench";
    benchSection.appendChild(benchLabel);
    const none = document.createElement("span");
    none.className = "chip-none";
    none.textContent = "\u2014";
    benchSection.appendChild(none);
    card.appendChild(benchSection);
  } else {
    card.appendChild(
      renderSection("Bench", game.bench, "bench", game.gameNumber, playerMap, lateIds, injuredIds, callbacks),
    );
  }

  // Replacement suggestions
  const suggestions = getReplacements(game, unavailableIds);
  if (suggestions.length > 0) {
    card.appendChild(renderReplacements(suggestions, playerMap));
  }

  return card;
}

function renderSection(
  label: string,
  playerIds: string[],
  role: "field" | "bench",
  gameNumber: number,
  playerMap: PlayerMap,
  lateIds: Set<string>,
  injuredIds: Map<string, number>,
  callbacks: ResultsCallbacks,
): HTMLElement {
  const section = document.createElement("div");
  section.className = "game-section";

  const sectionLabel = document.createElement("span");
  sectionLabel.className = "game-section-label";
  sectionLabel.textContent = label;
  section.appendChild(sectionLabel);

  const chipList = document.createElement("div");
  chipList.className = "chip-list";
  for (const id of playerIds) {
    const status = getStatus(id, gameNumber, lateIds, injuredIds);
    chipList.appendChild(createChip(id, playerMap, role, status, gameNumber, injuredIds, callbacks));
  }
  section.appendChild(chipList);
  return section;
}

// ---- Chips ----

type ChipStatus = "active" | "late" | "injured";

function getStatus(
  playerId: string,
  gameNumber: number,
  lateIds: Set<string>,
  injuredIds: Map<string, number>,
): ChipStatus {
  if (lateIds.has(playerId)) return "late";
  const injuredAt = injuredIds.get(playerId);
  if (injuredAt !== undefined && gameNumber >= injuredAt) return "injured";
  return "active";
}

function createChip(
  playerId: string,
  playerMap: PlayerMap,
  role: "field" | "bench",
  status: ChipStatus,
  gameNumber: number,
  injuredIds: Map<string, number>,
  callbacks: ResultsCallbacks,
): HTMLElement {
  const chip = document.createElement("button");
  chip.type = "button";
  chip.dataset.playerId = playerId;
  chip.dataset.gameNumber = String(gameNumber);
  chip.dataset.status = status;

  const player = playerMap.get(playerId);
  const name = player?.name ?? playerId;

  // Build chip class and content based on status
  if (status === "late") {
    chip.className = `chip chip-late`;
    chip.innerHTML = `${esc(name)} <span class="chip-label">Late</span>`;
  } else if (status === "injured") {
    const injuredAt = injuredIds.get(playerId);
    chip.className = `chip chip-injured`;
    chip.innerHTML = `${esc(name)} <span class="chip-label">Injured G${injuredAt}</span>`;
  } else {
    chip.className = `chip chip-${role}`;
    chip.textContent = name;
  }

  chip.addEventListener("click", (e) => {
    e.stopPropagation();
    showActionSheet(playerId, name, status, gameNumber, callbacks);
  });

  return chip;
}

// ---- Action Sheet ----

function createActionSheet(): HTMLElement {
  const sheet = document.createElement("div");
  sheet.id = "action-sheet";
  sheet.className = "action-sheet";
  sheet.hidden = true;
  return sheet;
}

function showActionSheet(
  playerId: string,
  playerName: string,
  status: ChipStatus,
  gameNumber: number,
  callbacks: ResultsCallbacks,
): void {
  const sheet = document.getElementById("action-sheet");
  if (!sheet) return;

  // If tapping the same player, toggle off
  if (!sheet.hidden && sheet.dataset.playerId === playerId && sheet.dataset.gameNumber === String(gameNumber)) {
    dismissActionSheet();
    return;
  }

  sheet.dataset.playerId = playerId;
  sheet.dataset.gameNumber = String(gameNumber);

  // Show backdrop
  let backdrop = document.getElementById("action-backdrop");
  if (!backdrop) {
    backdrop = document.createElement("div");
    backdrop.id = "action-backdrop";
    backdrop.className = "action-backdrop";
    backdrop.addEventListener("click", dismissActionSheet);
    document.body.appendChild(backdrop);
  }
  backdrop.hidden = false;

  if (status === "active") {
    sheet.innerHTML = `
      <div class="action-sheet-header">${esc(playerName)}</div>
      <div class="action-sheet-actions">
        <button type="button" class="action-btn action-btn-late" data-action="late">
          Mark Late
          <span class="action-desc">Removed from all games</span>
        </button>
        <button type="button" class="action-btn action-btn-injured" data-action="injured">
          Mark Injured
          <span class="action-desc">Replaced in Game ${gameNumber}+</span>
        </button>
      </div>
    `;
  } else {
    const statusLabel = status === "late" ? "Late" : `Injured (Game ${gameNumber})`;
    sheet.innerHTML = `
      <div class="action-sheet-header">
        ${esc(playerName)}
        <span class="action-sheet-status action-sheet-status-${status}">${statusLabel}</span>
      </div>
      <div class="action-sheet-actions">
        <button type="button" class="action-btn action-btn-clear" data-action="clear">
          Clear Status
          <span class="action-desc">Restore to active</span>
        </button>
      </div>
    `;
  }

  // Wire up action buttons
  sheet.querySelectorAll<HTMLButtonElement>(".action-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const action = btn.dataset.action;
      dismissActionSheet();
      if (action === "late") callbacks.onMarkLate(playerId);
      else if (action === "injured") callbacks.onMarkInjured(playerId, gameNumber);
      else if (action === "clear") callbacks.onClearStatus(playerId);
    });
  });

  sheet.hidden = false;
}

function dismissActionSheet(): void {
  const sheet = document.getElementById("action-sheet");
  if (sheet) {
    sheet.hidden = true;
    sheet.dataset.playerId = "";
  }
  const backdrop = document.getElementById("action-backdrop");
  if (backdrop) backdrop.hidden = true;
}

// ---- Replacement suggestions ----

function renderReplacements(
  suggestions: ReplacementSuggestion[],
  playerMap: PlayerMap,
): HTMLElement {
  const card = document.createElement("div");
  card.className = "replacement-card";
  card.innerHTML = `
    <span class="replacement-title">Suggested Replacements</span>
    ${suggestions.map((s) => renderReplacementRow(s, playerMap)).join("")}
  `;
  return card;
}

function renderReplacementRow(
  suggestion: ReplacementSuggestion,
  playerMap: PlayerMap,
): string {
  const outName = esc(playerMap.get(suggestion.outPlayerId)?.name ?? "?");

  if (suggestion.inPlayerId) {
    const inName = esc(playerMap.get(suggestion.inPlayerId)?.name ?? "?");
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

// ---- Helpers ----

function countLate(events: RotationEvent[]): number {
  return events.filter((e) => e.type === "late").length;
}

function esc(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
