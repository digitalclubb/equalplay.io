import type {
  Game,
  Player,
  PlayerStats,
  RotationEvent,
  RotationPlan,
  ReplacementSuggestion,
} from "../types/index.js";
import {
  getReplacements,
  getUnavailableForGame,
  getNextSubSuggestion,
  getPlayerStats,
} from "../logic/rotation.js";

type PlayerMap = Map<string, Player>;

export interface ResultsCallbacks {
  onMarkLate: (playerId: string) => void;
  onMarkInjured: (playerId: string, gameNumber: number) => void;
  onMarkJoined: (playerId: string) => void;
  onClearStatus: (playerId: string) => void;
  onGameLabelChange: (gameNumber: number, label: string) => void;
  onMakeSub: (gameNumber: number, playerOut: string, playerIn: string) => void;
  onStartNew: () => void;
}

type ChipStatus = "active" | "late" | "injured" | "joined";

/**
 * Renders the rotation plan with a sticky current game, inline quick
 * actions, a prominent "Next sub" button, and scrollable future games.
 */
export function renderResults(
  container: HTMLElement,
  plan: RotationPlan,
  playerMap: PlayerMap,
  playersPerTeam: number,
  events: RotationEvent[],
  allPlayerIds: string[],
  currentGame: number,
  gameLabels: Record<string, string>,
  callbacks: ResultsCallbacks,
): void {
  container.innerHTML = "";

  const lookup = buildEventLookup(events);
  const unavailableCount = allPlayerIds.filter((id) => {
    if (lookup.lateIds.has(id) && !lookup.joinedIds.has(id)) return true;
    if (lookup.injuredAt.has(id)) return true;
    return false;
  }).length;
  const activePlayerCount = playerMap.size - unavailableCount;

  const header = document.createElement("div");
  header.innerHTML = `
    <h2>Rotation plan</h2>
    <p class="subtitle">
      ${activePlayerCount} players available, ${playersPerTeam} per team,
      ${plan.games.length} game(s)
    </p>
    <p class="results-hint">Tap a player to update their availability during the match</p>
  `;
  container.appendChild(header);

  const nextGameNum = currentGame + 1;

  // Current game: sticky at top
  const currentGameData = plan.games.find((g) => g.gameNumber === currentGame);
  if (currentGameData) {
    const unavailable = getUnavailableForGame(currentGame, allPlayerIds, events);

    const stickyWrapper = document.createElement("div");
    stickyWrapper.className = "sticky-current";

    const card = renderGameCard(
      currentGameData, playerMap, lookup, unavailable,
      true, false, false,
      gameLabels, callbacks,
    );
    stickyWrapper.appendChild(card);

    // Prominent "Next sub" button — outside the card, always visible
    const subSuggestion = getNextSubSuggestion(plan, currentGame, unavailable);
    if (subSuggestion) {
      const inName = playerMap.get(subSuggestion.playerIn)?.name ?? "?";
      const outName = playerMap.get(subSuggestion.playerOut)?.name ?? "?";

      const subBar = document.createElement("div");
      subBar.className = "sticky-sub-bar";
      subBar.innerHTML = `
        <span class="sticky-sub-text">
          <span class="chip chip-replacement chip-mini">${esc(inName)}</span>
          on for
          <span class="chip chip-bench chip-mini">${esc(outName)}</span>
        </span>
      `;

      const subBtn = document.createElement("button");
      subBtn.type = "button";
      subBtn.className = "btn-next-sub";
      subBtn.textContent = "Next sub";
      subBtn.addEventListener("click", () => {
        callbacks.onMakeSub(currentGame, subSuggestion.playerOut, subSuggestion.playerIn);
      });
      subBar.appendChild(subBtn);

      stickyWrapper.appendChild(subBar);
    }

    container.appendChild(stickyWrapper);
  }

  // Remaining games
  for (const game of plan.games) {
    if (game.gameNumber === currentGame) continue;

    const unavailable = getUnavailableForGame(game.gameNumber, allPlayerIds, events);
    const isNext = game.gameNumber === nextGameNum;
    const isFuture = game.gameNumber > currentGame;

    const card = renderGameCard(
      game, playerMap, lookup, unavailable,
      false, isNext, isFuture,
      gameLabels, callbacks,
    );
    container.appendChild(card);
  }

  // Fairness breakdown
  const stats = getPlayerStats(plan, allPlayerIds);
  container.appendChild(renderFairnessSummary(stats, playerMap));

  // Start new session
  const resetBtn = document.createElement("button");
  resetBtn.type = "button";
  resetBtn.className = "btn-start-new";
  resetBtn.textContent = "Start new session";
  resetBtn.addEventListener("click", () => {
    const confirmed = window.confirm(
      "This will clear all players, games and events. Are you sure?",
    );
    if (confirmed) callbacks.onStartNew();
  });
  container.appendChild(resetBtn);

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
    else if (e.type === "injured") injuredAt.set(e.playerId, e.gameNumber);
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
  isNext: boolean,
  isFuture: boolean,
  gameLabels: Record<string, string>,
  callbacks: ResultsCallbacks,
): HTMLElement {
  const card = document.createElement("div");
  card.className = "game-card";
  if (isCurrent) card.classList.add("game-card-current");
  else if (isNext) card.classList.add("game-card-next");
  else if (isFuture) card.classList.add("game-card-future");

  // Header
  const headerRow = document.createElement("div");
  headerRow.className = "game-header";

  const title = document.createElement("h3");
  title.textContent = `Game ${game.gameNumber}`;

  if (isCurrent) {
    title.appendChild(createBadge("Now", "game-badge-current"));
  } else if (isNext) {
    title.appendChild(createBadge("Next", "game-badge-next"));
  }

  headerRow.appendChild(title);

  const labelInput = document.createElement("input");
  labelInput.type = "text";
  labelInput.className = "game-label-input";
  labelInput.placeholder = "e.g. vs Tigers";
  labelInput.value = gameLabels[String(game.gameNumber)] ?? "";
  labelInput.addEventListener("change", () => {
    callbacks.onGameLabelChange(game.gameNumber, labelInput.value.trim());
  });
  headerRow.appendChild(labelInput);

  card.appendChild(headerRow);

  // Content — collapsible for distant future games
  const content = document.createElement("div");
  content.className = "game-content";

  if (isFuture && !isNext) {
    content.classList.add("game-content-collapsed");
    headerRow.classList.add("game-header-collapsible");
    headerRow.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).classList.contains("game-label-input")) return;
      content.classList.toggle("game-content-collapsed");
    });
  }

  // On field — current game gets quick actions
  content.appendChild(
    renderSection(
      "On field", game.onField, "field", game.gameNumber,
      playerMap, lookup, isCurrent, callbacks,
    ),
  );

  // Bench
  if (game.bench.length > 0) {
    content.appendChild(
      renderSection(
        "On the bench", game.bench, "bench", game.gameNumber,
        playerMap, lookup, isCurrent, callbacks,
      ),
    );
  }

  // Not available
  const unavailableIds = [...unavailable].filter(
    (id) => !game.onField.includes(id) && !game.bench.includes(id),
  );
  if (unavailableIds.length > 0) {
    content.appendChild(
      renderSection(
        "Not available", unavailableIds, "unavailable", game.gameNumber,
        playerMap, lookup, false, callbacks,
      ),
    );
  }

  // Replacement suggestions
  const onFieldUnavailable = new Set(
    game.onField.filter((id) => unavailable.has(id)),
  );
  if (onFieldUnavailable.size > 0) {
    const suggestions = getReplacements(game, unavailable);
    if (suggestions.length > 0) {
      content.appendChild(renderReplacements(suggestions, playerMap));
    }
  }

  card.appendChild(content);
  return card;
}

function createBadge(text: string, className: string): HTMLElement {
  const badge = document.createElement("span");
  badge.className = className;
  badge.textContent = text;
  return badge;
}

function renderSection(
  label: string,
  playerIds: string[],
  role: "field" | "bench" | "unavailable",
  gameNumber: number,
  playerMap: PlayerMap,
  lookup: EventLookup,
  showQuickActions: boolean,
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
    if (showQuickActions && status !== "injured") {
      chipList.appendChild(
        createChipWithQuickActions(id, playerMap, role, status, gameNumber, lookup, callbacks),
      );
    } else {
      chipList.appendChild(
        createChip(id, playerMap, role, status, gameNumber, lookup, callbacks),
      );
    }
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

/**
 * Creates a chip with inline quick-action buttons for the current game.
 * Active/joined chips get "Late" + "Injured" buttons.
 * Late chips get an "Arrived" button.
 */
function createChipWithQuickActions(
  playerId: string,
  playerMap: PlayerMap,
  role: "field" | "bench" | "unavailable",
  status: ChipStatus,
  gameNumber: number,
  lookup: EventLookup,
  callbacks: ResultsCallbacks,
): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "chip-quick-wrap";

  const chip = createChip(playerId, playerMap, role, status, gameNumber, lookup, callbacks);
  wrapper.appendChild(chip);

  const actions = document.createElement("div");
  actions.className = "chip-quick-actions";

  if (status === "active" || status === "joined") {
    const lateBtn = document.createElement("button");
    lateBtn.type = "button";
    lateBtn.className = "chip-quick-btn chip-quick-late";
    lateBtn.textContent = "Late";
    lateBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      callbacks.onMarkLate(playerId);
    });
    actions.appendChild(lateBtn);

    const injBtn = document.createElement("button");
    injBtn.type = "button";
    injBtn.className = "chip-quick-btn chip-quick-injured";
    injBtn.textContent = "Injured";
    injBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      callbacks.onMarkInjured(playerId, gameNumber);
    });
    actions.appendChild(injBtn);
  } else if (status === "late") {
    const joinBtn = document.createElement("button");
    joinBtn.type = "button";
    joinBtn.className = "chip-quick-btn chip-quick-joined";
    joinBtn.textContent = "Arrived";
    joinBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      callbacks.onMarkJoined(playerId);
    });
    actions.appendChild(joinBtn);
  }

  wrapper.appendChild(actions);
  return wrapper;
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

// ---- Fairness summary ----

function renderFairnessSummary(
  stats: PlayerStats[],
  playerMap: PlayerMap,
): HTMLElement {
  const section = document.createElement("div");
  section.className = "fairness-summary";

  const minPlayed = Math.min(...stats.map((s) => s.gamesPlayed));
  const maxPlayed = Math.max(...stats.map((s) => s.gamesPlayed));
  const spread = maxPlayed - minPlayed;

  let headerText = "Playing time breakdown";
  if (spread === 0) {
    headerText += " \u2014 perfectly even";
  } else if (spread === 1) {
    headerText += " \u2014 within 1 game";
  }

  section.innerHTML = `<h4 class="fairness-title">${headerText}</h4>`;

  const list = document.createElement("div");
  list.className = "fairness-list";

  const sorted = [...stats].sort((a, b) => b.gamesPlayed - a.gamesPlayed);

  for (const stat of sorted) {
    const name = playerMap.get(stat.playerId)?.name ?? stat.playerId;
    const totalGames = stat.gamesPlayed + stat.gamesBenched;
    const pct = totalGames > 0 ? Math.round((stat.gamesPlayed / totalGames) * 100) : 0;

    const row = document.createElement("div");
    row.className = "fairness-row";
    row.innerHTML = `
      <span class="fairness-name">${esc(name)}</span>
      <span class="fairness-bar-track">
        <span class="fairness-bar-fill" style="width: ${pct}%"></span>
      </span>
      <span class="fairness-count">${stat.gamesPlayed}</span>
    `;
    list.appendChild(row);
  }

  section.appendChild(list);
  return section;
}

// ---- Helpers ----

function esc(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
