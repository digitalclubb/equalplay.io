import type {
  Game,
  Player,
  RotationEvent,
  RotationPlan,
  ReplacementSuggestion,
} from "../types/index.js";
import { getReplacements } from "../logic/rotation.js";

type PlayerMap = Map<string, Player>;

/** Callback fired when user marks a player via chip interaction */
export type OnPlayerAction = (event: RotationEvent) => void;

/**
 * Renders the full rotation plan. Chips are tappable — tapping opens
 * an inline action bar with Late/Injured options.
 */
export function renderResults(
  container: HTMLElement,
  plan: RotationPlan,
  playerMap: PlayerMap,
  playersPerTeam: number,
  events: RotationEvent[],
  onAction: OnPlayerAction,
): void {
  container.innerHTML = "";

  const activePlayerCount = playerMap.size - countLateEvents(events);
  const header = document.createElement("div");
  header.innerHTML = `
    <h2>Rotation Plan</h2>
    <p class="subtitle">
      ${activePlayerCount} active players, ${playersPerTeam} per team,
      ${plan.games.length} game(s)
    </p>
  `;
  container.appendChild(header);

  // Build sets for quick status lookup
  const lateIds = new Set<string>();
  const injuredIds = new Map<string, number>(); // playerId → gameNumber
  for (const e of events) {
    if (e.type === "late") lateIds.add(e.playerId);
    else injuredIds.set(e.playerId, e.gameNumber);
  }

  const unavailableIds = new Set([...lateIds, ...injuredIds.keys()]);

  for (const game of plan.games) {
    const card = renderGameCard(
      game,
      playerMap,
      lateIds,
      injuredIds,
      unavailableIds,
      onAction,
    );
    container.appendChild(card);
  }
}

function renderGameCard(
  game: Game,
  playerMap: PlayerMap,
  lateIds: Set<string>,
  injuredIds: Map<string, number>,
  unavailableIds: Set<string>,
  onAction: OnPlayerAction,
): HTMLElement {
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
    const status = getPlayerStatus(id, game.gameNumber, lateIds, injuredIds);
    fieldChips.appendChild(
      createInteractiveChip(id, playerMap, "field", status, game.gameNumber, onAction),
    );
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
      const status = getPlayerStatus(id, game.gameNumber, lateIds, injuredIds);
      benchChips.appendChild(
        createInteractiveChip(id, playerMap, "bench", status, game.gameNumber, onAction),
      );
    }
  }
  benchSection.appendChild(benchChips);
  card.appendChild(benchSection);

  // Replacement suggestions
  const suggestions = getReplacements(game, unavailableIds);
  if (suggestions.length > 0) {
    const replacementCard = document.createElement("div");
    replacementCard.className = "replacement-card";
    replacementCard.innerHTML = `
      <span class="replacement-title">Suggested Replacements</span>
      ${suggestions.map((s) => renderReplacementRow(s, playerMap)).join("")}
    `;
    card.appendChild(replacementCard);
  }

  return card;
}

type ChipStatus = "active" | "late" | "injured";

function getPlayerStatus(
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

/**
 * Creates a tappable chip. Tapping toggles an inline action bar below it.
 * Only one action bar is visible across the entire results area at a time.
 */
function createInteractiveChip(
  playerId: string,
  playerMap: PlayerMap,
  role: "field" | "bench",
  status: ChipStatus,
  gameNumber: number,
  onAction: OnPlayerAction,
): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "chip-wrapper";

  const chip = document.createElement("button");
  chip.type = "button";
  chip.className = `chip chip-${role}`;
  chip.dataset.playerId = playerId;

  if (status === "injured") chip.classList.add("chip-injured");
  if (status === "late") chip.classList.add("chip-late");

  const player = playerMap.get(playerId);
  chip.textContent = player?.name ?? playerId;

  chip.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleActionBar(wrapper, playerId, status, gameNumber, onAction);
  });

  wrapper.appendChild(chip);
  return wrapper;
}

/** Closes any open action bar in the document */
function closeAllActionBars(): void {
  document.querySelectorAll(".chip-actions").forEach((el) => el.remove());
  document.querySelectorAll(".chip-active").forEach((el) => {
    el.classList.remove("chip-active");
  });
}

function toggleActionBar(
  wrapper: HTMLElement,
  playerId: string,
  status: ChipStatus,
  gameNumber: number,
  onAction: OnPlayerAction,
): void {
  const existing = wrapper.querySelector(".chip-actions");
  const chip = wrapper.querySelector(".chip")!;

  // If this chip's bar is already open, close it
  if (existing) {
    existing.remove();
    chip.classList.remove("chip-active");
    return;
  }

  // Close any other open bar first
  closeAllActionBars();
  chip.classList.add("chip-active");

  const bar = document.createElement("div");
  bar.className = "chip-actions";

  if (status === "active") {
    // Show Late / Injured options
    const lateBtn = document.createElement("button");
    lateBtn.type = "button";
    lateBtn.className = "chip-action chip-action-late";
    lateBtn.textContent = "Late";
    lateBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      closeAllActionBars();
      onAction({ type: "late", playerId });
    });

    const injuredBtn = document.createElement("button");
    injuredBtn.type = "button";
    injuredBtn.className = "chip-action chip-action-injured";
    injuredBtn.textContent = "Injured";
    injuredBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      closeAllActionBars();
      onAction({ type: "injured", playerId, gameNumber });
    });

    bar.appendChild(lateBtn);
    bar.appendChild(injuredBtn);
  } else {
    // Player is already late or injured — offer to clear
    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "chip-action chip-action-clear";
    clearBtn.textContent = `Clear ${status}`;
    clearBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      closeAllActionBars();
      // Remove matching event — fire a synthetic "clear" by removing from events
      // We signal this by re-dispatching without this player's event
      onAction({ type: "late", playerId: `__clear__${playerId}` });
    });

    bar.appendChild(clearBtn);
  }

  wrapper.appendChild(bar);
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

function countLateEvents(events: RotationEvent[]): number {
  return events.filter((e) => e.type === "late").length;
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
