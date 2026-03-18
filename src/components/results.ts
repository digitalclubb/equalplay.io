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
  onMarkJoined: (playerId: string) => void;
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

  const lookup = buildEventLookup(events);
  // Active = total minus (late who haven't joined) minus injured
  const unavailableCount = allPlayerIds.filter((id) => {
    if (lookup.lateIds.has(id) && !lookup.joinedIds.has(id)) return true;
    if (lookup.injuredAt.has(id)) return true;
    return false;
  }).length;
  const activePlayerCount = playerMap.size - unavailableCount;

  const header = document.createElement("div");
  header.innerHTML = `
    <h2>Rotation Plan</h2>
    <p class="subtitle">
      ${activePlayerCount} players available, ${playersPerTeam} per team,
      ${plan.games.length} game(s)
    </p>
    <p class="results-hint">Tap a player to update their availability during the match</p>
  `;
  container.appendChild(header);

  for (const game of plan.games) {
    const unavailable = getUnavailableForGame(game.gameNumber, allPlayerIds, events);
    const isCurrent = game.gameNumber === currentGame;
    const isFuture = game.gameNumber > currentGame;

    const card = renderGameCard(
      game, playerMap, lookup, unavailable, isCurrent, isFuture, callbacks,
    );
    container.appendChild(card);
  }

  container.appendChild(createActionSheet());
}

// ---- Event lookup ----

interface EventLookup {
  lateIds: Set<string>;
  joinedIds: Set<string>;
  injuredAt: Map<string, number>;
}

function buildEventLookup(events: RotationEvent[]): EventLookup {
  const lateIds = new Set<string>();
  const joinedIds = new Set<string>();
  const injuredAt = new Map<string, number>();

  for (const e of events) {
    if (e.type === "late") lateIds.add(e.playerId);
    else if (e.type === "joined") joinedIds.add(e.playerId);
    else injuredAt.set(e.playerId, e.gameNumber);
  }

  return { lateIds, joinedIds, injuredAt };
}

function getChipStatus(
  playerId: string,
  gameNumber: number,
  lookup: EventLookup,
): ChipStatus {
  const injAt = lookup.injuredAt.get(playerId);
  if (injAt !== undefined && gameNumber >= injAt) return "injured";

  if (lookup.lateIds.has(playerId)) {
    // Joined cancels late — player is immediately available
    if (lookup.joinedIds.has(playerId)) return "joined";
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
    renderSection("On field", game.onField, "field", game.gameNumber, playerMap, lookup, callbacks),
  );

  // Bench
  if (game.bench.length > 0) {
    card.appendChild(
      renderSection("On the bench", game.bench, "bench", game.gameNumber, playerMap, lookup, callbacks),
    );
  }

  // Unavailable players (late/injured not in onField or bench)
  const unavailableIds = [...unavailable].filter(
    (id) => !game.onField.includes(id) && !game.bench.includes(id),
  );
  if (unavailableIds.length > 0) {
    card.appendChild(
      renderSection("Not available", unavailableIds, "unavailable", game.gameNumber, playerMap, lookup, callbacks),
    );
  }

  // Replacement suggestions
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
    const status = getChipStatus(id, gameNumber, lookup);
    chipList.appendChild(createChip(id, playerMap, role, status, gameNumber, lookup, callbacks));
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
  callbacks: ResultsCallbacks,
): HTMLElement {
  const chip = document.createElement("button");
  chip.type = "button";
  chip.dataset.playerId = playerId;

  const player = playerMap.get(playerId);
  const name = player?.name ?? playerId;
  const chipRole = role === "unavailable" ? "bench" : role;

  if (status === "late") {
    chip.className = "chip chip-late";
    chip.innerHTML = `${esc(name)} <span class="chip-label">Not here</span>`;
  } else if (status === "injured") {
    const injAt = lookup.injuredAt.get(playerId);
    chip.className = "chip chip-injured";
    chip.innerHTML = `${esc(name)} <span class="chip-label">Injured game ${injAt}</span>`;
  } else if (status === "joined") {
    chip.className = `chip chip-${chipRole} chip-joined`;
    chip.textContent = name;
  } else {
    chip.className = `chip chip-${chipRole}`;
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
          Not here yet
          <span class="action-desc">Sit out until they arrive</span>
        </button>
        <button type="button" class="action-btn action-btn-injured" data-action="injured">
          Player injured
          <span class="action-desc">Replaced from game ${gameNumber}</span>
        </button>
      </div>
    `;
  } else if (status === "late") {
    sheet.innerHTML = `
      <div class="action-sheet-header">
        ${esc(playerName)}
        <span class="action-sheet-status action-sheet-status-late">Not here yet</span>
      </div>
      <div class="action-sheet-actions">
        <button type="button" class="action-btn action-btn-joined" data-action="joined">
          Player has arrived
          <span class="action-desc">On the bench and ready if needed</span>
        </button>
        <button type="button" class="action-btn action-btn-clear" data-action="clear">
          Reset player
          <span class="action-desc">Put back into the full rotation</span>
        </button>
      </div>
    `;
  } else {
    sheet.innerHTML = `
      <div class="action-sheet-header">
        ${esc(playerName)}
        <span class="action-sheet-status action-sheet-status-injured">Injured (game ${gameNumber})</span>
      </div>
      <div class="action-sheet-actions">
        <button type="button" class="action-btn action-btn-clear" data-action="clear">
          Reset player
          <span class="action-desc">Put back into the full rotation</span>
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
      else if (action === "joined") callbacks.onMarkJoined(playerId);
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
    <span class="replacement-title">Suggested replacements</span>
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
      <span class="replacement-none">No replacement available</span>
    </div>
  `;
}

// ---- Helpers ----

function esc(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
