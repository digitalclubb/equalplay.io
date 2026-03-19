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
  onNextGame: () => void;
  onStartNew: () => void;
}

type ChipStatus = "active" | "late" | "injured" | "joined";

export function renderResults(
  container: HTMLElement,
  plan: RotationPlan,
  playerMap: PlayerMap,
  _playersPerTeam: number,
  events: RotationEvent[],
  allPlayerIds: string[],
  currentGame: number,
  gameLabels: Record<string, string>,
  callbacks: ResultsCallbacks,
): void {
  container.innerHTML = "";

  const lookup = buildEventLookup(events);
  const totalGames = plan.games.length;
  const nextGameNum = currentGame + 1;
  const hasNextGame = nextGameNum <= totalGames;

  // Reset session — at top, always accessible
  const resetBtn = document.createElement("button");
  resetBtn.type = "button";
  resetBtn.className = "btn-reset";
  resetBtn.textContent = "Reset session";
  resetBtn.addEventListener("click", () => {
    if (window.confirm("This will clear all players, games and events. Are you sure?")) {
      callbacks.onStartNew();
    }
  });
  container.appendChild(resetBtn);

  const isSessionFinished = currentGame > totalGames;

  // Session finished — all games completed
  if (isSessionFinished) {
    const finishedBanner = document.createElement("div");
    finishedBanner.className = "session-finished";
    finishedBanner.innerHTML = `
      <h3>All games completed</h3>
      <p>Well done! Check the playing time breakdown below.</p>
    `;
    container.appendChild(finishedBanner);
  }

  // Completed games (before current) — collapsed
  for (const game of plan.games) {
    if (game.gameNumber >= currentGame) break;
    const unavailable = getUnavailableForGame(game.gameNumber, allPlayerIds, events);
    container.appendChild(
      renderGameCard(game, playerMap, lookup, unavailable, "completed", gameLabels, callbacks),
    );
  }

  // Current game — sticky (only if session not finished)
  const currentGameData = isSessionFinished
    ? undefined
    : plan.games.find((g) => g.gameNumber === currentGame);
  if (currentGameData) {
    const unavailable = getUnavailableForGame(currentGame, allPlayerIds, events);

    const sticky = document.createElement("div");
    sticky.className = "sticky-current";

    const card = renderGameCard(
      currentGameData, playerMap, lookup, unavailable,
      "current", gameLabels, callbacks,
    );

    // Primary action: "Make sub"
    const subSuggestion = getNextSubSuggestion(plan, currentGame, unavailable);
    if (subSuggestion) {
      const inName = playerMap.get(subSuggestion.playerIn)?.name ?? "?";
      const outName = playerMap.get(subSuggestion.playerOut)?.name ?? "?";

      const subAction = document.createElement("div");
      subAction.className = "sub-action";

      const subText = document.createElement("div");
      subText.className = "sub-action-text";
      subText.innerHTML = `
        <span class="chip chip-field chip-sm">${esc(inName)}</span>
        <span class="sub-action-arrow">&rarr;</span>
        <span class="chip chip-bench chip-sm">${esc(outName)}</span>
      `;
      subAction.appendChild(subText);

      const subBtn = document.createElement("button");
      subBtn.type = "button";
      subBtn.className = "btn-next-sub";
      subBtn.textContent = "Make sub";
      subBtn.addEventListener("click", () => {
        callbacks.onMakeSub(currentGame, subSuggestion.playerOut, subSuggestion.playerIn);
      });
      subAction.appendChild(subBtn);

      card.appendChild(subAction);
    }

    // Game progression button
    if (hasNextGame) {
      const nextGameBtn = document.createElement("button");
      nextGameBtn.type = "button";
      nextGameBtn.className = "btn-next-game";
      nextGameBtn.textContent = `Start game ${nextGameNum}`;
      nextGameBtn.addEventListener("click", () => {
        callbacks.onNextGame();
      });
      card.appendChild(nextGameBtn);
    } else {
      const endGameBtn = document.createElement("button");
      endGameBtn.type = "button";
      endGameBtn.className = "btn-end-game";
      endGameBtn.textContent = "End game";
      endGameBtn.addEventListener("click", () => {
        callbacks.onNextGame();
      });
      card.appendChild(endGameBtn);
    }

    sticky.appendChild(card);
    container.appendChild(sticky);
  }

  // Future games (after current)
  for (const game of plan.games) {
    if (game.gameNumber <= currentGame) continue;

    const unavailable = getUnavailableForGame(game.gameNumber, allPlayerIds, events);
    const isNext = game.gameNumber === nextGameNum;
    const emphasis: GameEmphasis = isNext ? "next" : "future";

    container.appendChild(
      renderGameCard(game, playerMap, lookup, unavailable, emphasis, gameLabels, callbacks),
    );
  }

  // Fairness breakdown
  const stats = getPlayerStats(plan, allPlayerIds);
  container.appendChild(renderFairnessSummary(stats, playerMap));

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
    return lookup.joinedIds.has(playerId) ? "joined" : "late";
  }
  return "active";
}

// ---- Game card ----

type GameEmphasis = "completed" | "current" | "next" | "future";

const BADGE_LABELS: Partial<Record<GameEmphasis, { text: string; className: string }>> = {
  completed: { text: "Completed", className: "game-badge-completed" },
  current: { text: "Live", className: "game-badge-current" },
  next: { text: "Up next", className: "game-badge-next" },
};

function renderGameCard(
  game: Game,
  playerMap: PlayerMap,
  lookup: EventLookup,
  unavailable: Set<string>,
  emphasis: GameEmphasis,
  gameLabels: Record<string, string>,
  callbacks: ResultsCallbacks,
): HTMLElement {
  const card = document.createElement("div");
  card.className = `game-card game-card-${emphasis}`;

  // Header
  const headerRow = document.createElement("div");
  headerRow.className = "game-header";

  const title = document.createElement("h3");
  title.textContent = `Game ${game.gameNumber}`;
  const badge = BADGE_LABELS[emphasis];
  if (badge) {
    title.appendChild(createBadge(badge.text, badge.className));
  }
  headerRow.appendChild(title);

  // Opponent label: display mode with edit icon, toggles to input + save
  const savedLabel = gameLabels[String(game.gameNumber)] ?? "";
  headerRow.appendChild(
    createGameLabel(savedLabel, emphasis === "completed", (newLabel) => {
      callbacks.onGameLabelChange(game.gameNumber, newLabel);
    }),
  );

  card.appendChild(headerRow);

  // Content — collapsible for completed and distant future games
  const content = document.createElement("div");
  content.className = "game-content";

  const isCollapsible = emphasis === "completed" || emphasis === "future";
  if (isCollapsible) {
    content.classList.add("game-content-collapsed");
    headerRow.classList.add("game-header-collapsible");
    headerRow.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).classList.contains("game-label-input")) return;
      content.classList.toggle("game-content-collapsed");
    });
  }

  // Sections
  content.appendChild(renderSection("On field", game.onField, "field", game.gameNumber, playerMap, lookup, callbacks));

  if (game.bench.length > 0) {
    content.appendChild(renderSection("On the bench", game.bench, "bench", game.gameNumber, playerMap, lookup, callbacks));
  }

  const unavailableIds = [...unavailable].filter(
    (id) => !game.onField.includes(id) && !game.bench.includes(id),
  );
  if (unavailableIds.length > 0) {
    content.appendChild(renderSection("Not available", unavailableIds, "unavailable", game.gameNumber, playerMap, lookup, callbacks));
  }

  // Replacement suggestions
  const onFieldUnavailable = new Set(game.onField.filter((id) => unavailable.has(id)));
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

/**
 * Creates the game opponent label with display/edit toggle.
 * Shows saved text + pen icon in display mode.
 * Tapping pen switches to input + save button.
 */
function createGameLabel(
  savedLabel: string,
  readOnly: boolean,
  onSave: (label: string) => void,
): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "game-label";

  // Display mode
  const display = document.createElement("div");
  display.className = "game-label-display";

  const labelText = document.createElement("span");
  labelText.className = "game-label-text";
  labelText.textContent = savedLabel || "vs \u2026";
  if (!savedLabel) labelText.classList.add("game-label-placeholder");
  display.appendChild(labelText);

  if (!readOnly) {
    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "game-label-edit-btn";
    editBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>`;
    editBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      display.hidden = true;
      editor.hidden = false;
      input.value = savedLabel;
      input.focus();
    });
    display.appendChild(editBtn);
  }

  wrapper.appendChild(display);

  // Edit mode
  const editor = document.createElement("div");
  editor.className = "game-label-editor";
  editor.hidden = true;

  const input = document.createElement("input");
  input.type = "text";
  input.className = "game-label-input";
  input.placeholder = "e.g. Tigers";
  input.value = savedLabel;

  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "game-label-save-btn";
  saveBtn.textContent = "Save";

  function save(): void {
    const val = input.value.trim();
    onSave(val);
    labelText.textContent = val || "vs \u2026";
    labelText.classList.toggle("game-label-placeholder", !val);
    editor.hidden = true;
    display.hidden = false;
  }

  saveBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    save();
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      save();
    }
  });

  editor.appendChild(input);
  editor.appendChild(saveBtn);
  wrapper.appendChild(editor);

  return wrapper;
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

// ---- Chips (display-only, tap opens action sheet) ----

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

  const player = playerMap.get(playerId);
  const name = player?.name ?? playerId;
  const chipRole = role === "unavailable" ? "bench" : role;

  if (status === "late") {
    chip.className = "chip chip-late";
    chip.innerHTML = `${esc(name)}<span class="chip-status-dot"></span>`;
  } else if (status === "injured") {
    chip.className = "chip chip-injured";
    chip.textContent = name;
  } else if (status === "joined") {
    chip.className = `chip chip-${chipRole} chip-joined`;
    chip.textContent = name;
  } else {
    chip.className = `chip chip-${chipRole}`;
    chip.textContent = name;
  }

  chip.addEventListener("click", (e) => {
    e.stopPropagation();
    showActionSheet(playerId, name, status, gameNumber, lookup, callbacks);
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
  lookup: EventLookup,
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

  // Build status line for header
  let statusBadge = "";
  if (status === "late") {
    statusBadge = `<span class="action-sheet-status action-sheet-status-late">Not here yet</span>`;
  } else if (status === "injured") {
    const injAt = lookup.injuredAt.get(playerId);
    statusBadge = `<span class="action-sheet-status action-sheet-status-injured">Injured${injAt ? ` game ${injAt}` : ""}</span>`;
  }

  let actionsHTML = "";

  if (status === "active" || status === "joined") {
    actionsHTML = `
      <button type="button" class="action-btn action-btn-late" data-action="late">
        Not here yet
        <span class="action-desc">Sit out until they arrive</span>
      </button>
      <button type="button" class="action-btn action-btn-injured" data-action="injured">
        Player injured
        <span class="action-desc">Replaced from game ${gameNumber}</span>
      </button>
    `;
  } else if (status === "late") {
    actionsHTML = `
      <button type="button" class="action-btn action-btn-joined" data-action="joined">
        Player has arrived
        <span class="action-desc">On the bench and ready if needed</span>
      </button>
      <button type="button" class="action-btn action-btn-clear" data-action="clear">
        Reset player
        <span class="action-desc">Put back into the full rotation</span>
      </button>
    `;
  } else {
    actionsHTML = `
      <button type="button" class="action-btn action-btn-clear" data-action="clear">
        Reset player
        <span class="action-desc">Put back into the full rotation</span>
      </button>
    `;
  }

  sheet.innerHTML = `
    <div class="action-sheet-header">${esc(playerName)}${statusBadge}</div>
    <div class="action-sheet-actions">${actionsHTML}</div>
  `;

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
        <span class="chip chip-injured chip-sm">${outName}</span>
        <span class="replacement-arrow">&rarr;</span>
        <span class="chip chip-field chip-sm">${inName}</span>
      </div>
    `;
  }

  return `
    <div class="replacement-row">
      <span class="chip chip-injured chip-sm">${outName}</span>
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

  const maxScore = Math.max(...stats.map((s) => Math.abs(s.fairnessScore)));
  const isBalanced = maxScore < 0.5;

  let headerText = "Playing time";
  if (isBalanced) headerText += " \u2014 balanced";

  section.innerHTML = `<h4 class="fairness-title">${headerText}</h4>`;

  const list = document.createElement("div");
  list.className = "fairness-list";

  // Sort by fairness score ascending (most underplayed first)
  const sorted = [...stats].sort((a, b) => a.fairnessScore - b.fairnessScore);

  for (const stat of sorted) {
    const name = playerMap.get(stat.playerId)?.name ?? stat.playerId;
    const totalGames = stat.playTimeUnits + stat.gamesBenched;
    const pct = totalGames > 0 ? Math.round((stat.playTimeUnits / totalGames) * 100) : 0;

    // Format: show decimal only when fractional (2.5 not 2.0)
    const timeLabel = Number.isInteger(stat.playTimeUnits)
      ? String(stat.playTimeUnits)
      : stat.playTimeUnits.toFixed(1);

    const scoreLabel = stat.fairnessScore > 0
      ? `+${stat.fairnessScore}`
      : String(stat.fairnessScore);

    const row = document.createElement("div");
    row.className = "fairness-row";
    row.innerHTML = `
      <span class="fairness-name">${esc(name)}</span>
      <span class="fairness-bar-track">
        <span class="fairness-bar-fill" style="width: ${pct}%"></span>
      </span>
      <span class="fairness-count">${timeLabel}</span>
      <span class="fairness-score ${stat.fairnessScore < -0.5 ? "fairness-under" : stat.fairnessScore > 0.5 ? "fairness-over" : ""}">${scoreLabel}</span>
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
