import type {
  Game,
  Player,
  RotationEvent,
  RotationPlan,
  ReplacementSuggestion,
} from "../types/index.js";
import { getReplacements, getUnavailableForGame } from "../logic/rotation.js";

type PlayerMap = Map<string, Player>;

export interface ResultsCallbacks {
  onMarkLate: (playerId: string) => void;
  onMarkInjured: (playerId: string, gameNumber: number) => void;
  onMarkJoined: (playerId: string, fromGameNumber: number) => void;
  onClearStatus: (playerId: string) => void;
}

type ChipStatus = "active" | "late" | "injured" | "joined";

/**
 * Renders the full rotation plan with current-game focus,
 * unavailable player visibility, and interactive chips.
 */
export function renderResults(
  container: HTMLElement,
  plan: RotationPlan,
  playerMap: PlayerMap,
  playersPerTeam: number,
  events: RotationEvent[],
  allPlayerIds: string[],
  currentGame: number,
  callbacks: ResultsCallbacks,
): void {
  container.innerHTML = "";

  const lateCount = events.filter((e) => e.type === "late").length;
  const joinedCount = events.filter((e) => e.type === "joined").length;
  const activePlayerCount = playerMap.size - lateCount + joinedCount;

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

  // Build event lookup maps
  const eventLookup = buildEventLookup(events);

  for (const game of plan.games) {
    const unavailable = getUnavailableForGame(game.gameNumber, allPlayerIds, events);
    const isCurrent = game.gameNumber === currentGame;
    const isFuture = game.gameNumber > currentGame;

    const card = renderGameCard(
      game, playerMap, eventLookup, unavailable, isCurrent, isFuture, currentGame, callbacks,
    );
    container.appendChild(card);
  }

  container.appendChild(createActionSheet());
}

// ---- Event lookup ----

interface EventLookup {
  lateIds: Set<string>;
  joinedFrom: Map<string, number>;
  injuredAt: Map<string, number>;
}

function buildEventLookup(events: RotationEvent[]): EventLookup {
  const lateIds = new Set<string>();
  const joinedFrom = new Map<string, number>();
  const injuredAt = new Map<string, number>();

  for (const e of events) {
    if (e.type === "late") lateIds.add(e.playerId);
    else if (e.type === "joined") joinedFrom.set(e.playerId, e.fromGameNumber);
    else injuredAt.set(e.playerId, e.gameNumber);
  }

  return { lateIds, joinedFrom, injuredAt };
}

function getChipStatus(
  playerId: string,
  gameNumber: number,
  lookup: EventLookup,
): ChipStatus {
  // Check injured
  const injAt = lookup.injuredAt.get(playerId);
  if (injAt !== undefined && gameNumber >= injAt) return "injured";

  // Check late/joined
  if (lookup.lateIds.has(playerId)) {
    const joinAt = lookup.joinedFrom.get(playerId);
    if (joinAt !== undefined && gameNumber >= joinAt) return "joined";
    return "late";
  }

  return "active";
}

// ---- Game card ----

function renderGameCard(
  game: Game,
  playerMap: PlayerMap,
  lookup: EventLookup,
  unavailable: Set<string>,
  isCurrent: boolean,
  isFuture: boolean,
  currentGame: number,
  callbacks: ResultsCallbacks,
): HTMLElement {
  const card = document.createElement("div");
  card.className = "game-card";
  if (isCurrent) card.classList.add("game-card-current");
  if (isFuture) card.classList.add("game-card-future");

  const title = document.createElement("h3");
  title.textContent = `Game ${game.gameNumber}`;
  if (isCurrent) {
    const badge = document.createElement("span");
    badge.className = "game-badge-current";
    badge.textContent = "Current";
    title.appendChild(badge);
  }
  card.appendChild(title);

  // On field
  card.appendChild(
    renderSection("On Field", game.onField, "field", game.gameNumber, playerMap, lookup, currentGame, callbacks),
  );

  // Bench
  if (game.bench.length > 0) {
    card.appendChild(
      renderSection("Bench", game.bench, "bench", game.gameNumber, playerMap, lookup, currentGame, callbacks),
    );
  }

  // Unavailable players (late/injured) — show greyed out so they're not hidden
  const unavailableIds = [...unavailable].filter(
    (id) => !game.onField.includes(id) && !game.bench.includes(id),
  );
  if (unavailableIds.length > 0) {
    card.appendChild(
      renderSection("Unavailable", unavailableIds, "unavailable", game.gameNumber, playerMap, lookup, currentGame, callbacks),
    );
  }

  // Replacement suggestions for on-field players who are unavailable
  const onFieldUnavailable = new Set(
    game.onField.filter((id) => unavailable.has(id)),
  );
  if (onFieldUnavailable.size > 0) {
    const suggestions = getReplacements(game, unavailable);
    if (suggestions.length > 0) {
      card.appendChild(renderReplacements(suggestions, playerMap));
    }
  }

  return card;
}

function renderSection(
  label: string,
  playerIds: string[],
  role: "field" | "bench" | "unavailable",
  gameNumber: number,
  playerMap: PlayerMap,
  lookup: EventLookup,
  currentGame: number,
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
    const status = role === "unavailable"
      ? getChipStatus(id, gameNumber, lookup)
      : getChipStatus(id, gameNumber, lookup);
    chipList.appendChild(createChip(id, playerMap, role, status, gameNumber, lookup, currentGame, callbacks));
  }
  section.appendChild(chipList);
  return section;
}

// ---- Chips ----

function createChip(
  playerId: string,
  playerMap: PlayerMap,
  role: "field" | "bench" | "unavailable",
  status: ChipStatus,
  gameNumber: number,
  lookup: EventLookup,
  currentGame: number,
  callbacks: ResultsCallbacks,
): HTMLElement {
  const chip = document.createElement("button");
  chip.type = "button";
  chip.dataset.playerId = playerId;

  const player = playerMap.get(playerId);
  const name = player?.name ?? playerId;

  if (status === "late") {
    chip.className = "chip chip-late";
    chip.innerHTML = `${esc(name)} <span class="chip-label">Late</span>`;
  } else if (status === "injured") {
    const injAt = lookup.injuredAt.get(playerId);
    chip.className = "chip chip-injured";
    chip.innerHTML = `${esc(name)} <span class="chip-label">Injured G${injAt}</span>`;
  } else if (status === "joined") {
    chip.className = `chip chip-${role === "unavailable" ? "bench" : role} chip-joined`;
    chip.textContent = name;
  } else {
    chip.className = `chip chip-${role === "unavailable" ? "bench" : role}`;
    chip.textContent = name;
  }

  chip.addEventListener("click", (e) => {
    e.stopPropagation();
    showActionSheet(playerId, name, status, gameNumber, currentGame, callbacks);
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
  currentGame: number,
  callbacks: ResultsCallbacks,
): void {
  const sheet = document.getElementById("action-sheet");
  if (!sheet) return;

  if (!sheet.hidden && sheet.dataset.playerId === playerId && sheet.dataset.gameNumber === String(gameNumber)) {
    dismissActionSheet();
    return;
  }

  sheet.dataset.playerId = playerId;
  sheet.dataset.gameNumber = String(gameNumber);

  let backdrop = document.getElementById("action-backdrop");
  if (!backdrop) {
    backdrop = document.createElement("div");
    backdrop.id = "action-backdrop";
    backdrop.className = "action-backdrop";
    backdrop.addEventListener("click", dismissActionSheet);
    document.body.appendChild(backdrop);
  }
  backdrop.hidden = false;

  if (status === "active" || status === "joined") {
    sheet.innerHTML = `
      <div class="action-sheet-header">${esc(playerName)}</div>
      <div class="action-sheet-actions">
        <button type="button" class="action-btn action-btn-late" data-action="late">
          Mark Late
          <span class="action-desc">Greyed out in all games</span>
        </button>
        <button type="button" class="action-btn action-btn-injured" data-action="injured">
          Mark Injured
          <span class="action-desc">Replaced from Game ${gameNumber}</span>
        </button>
      </div>
    `;
  } else if (status === "late") {
    const nextGame = currentGame + 1;
    sheet.innerHTML = `
      <div class="action-sheet-header">
        ${esc(playerName)}
        <span class="action-sheet-status action-sheet-status-late">Late</span>
      </div>
      <div class="action-sheet-actions">
        <button type="button" class="action-btn action-btn-joined" data-action="joined">
          Mark Joined
          <span class="action-desc">Add back from Game ${nextGame}</span>
        </button>
        <button type="button" class="action-btn action-btn-clear" data-action="clear">
          Clear Status
          <span class="action-desc">Restore to active in all games</span>
        </button>
      </div>
    `;
  } else {
    // injured
    sheet.innerHTML = `
      <div class="action-sheet-header">
        ${esc(playerName)}
        <span class="action-sheet-status action-sheet-status-injured">Injured (Game ${gameNumber})</span>
      </div>
      <div class="action-sheet-actions">
        <button type="button" class="action-btn action-btn-clear" data-action="clear">
          Clear Status
          <span class="action-desc">Restore to active</span>
        </button>
      </div>
    `;
  }

  sheet.querySelectorAll<HTMLButtonElement>(".action-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const action = btn.dataset.action;
      dismissActionSheet();
      if (action === "late") callbacks.onMarkLate(playerId);
      else if (action === "injured") callbacks.onMarkInjured(playerId, gameNumber);
      else if (action === "joined") callbacks.onMarkJoined(playerId, currentGame + 1);
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

function esc(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
