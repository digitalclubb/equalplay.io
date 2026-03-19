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
import {
  iconSub,
  iconNext,
  iconEnd,
  iconLate,
  iconInjured,
  iconArrived,
  iconLeaving,
  iconReset,
} from "./icons.js";

type PlayerMap = Map<string, Player>;

export interface ResultsCallbacks {
  onMarkLate: (playerId: string) => void;
  onMarkInjured: (playerId: string, gameNumber: number) => void;
  onMarkJoined: (playerId: string) => void;
  onMarkLeaving: (playerId: string, afterGame: number) => void;
  onClearStatus: (playerId: string) => void;
  onGameLabelChange: (gameNumber: number, label: string) => void;
  onMakeSub: (gameNumber: number, playerOut: string, playerIn: string) => void;
  onNextGame: () => void;
  onStartNew: () => void;
}

type ChipStatus = "active" | "late" | "injured" | "joined" | "leaving";

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

  if (isSessionFinished) {
    const finishedBanner = document.createElement("div");
    finishedBanner.className = "session-finished";
    finishedBanner.innerHTML = `
      <h3>All games completed</h3>
      <p>Well done! Check the playing time breakdown below.</p>
    `;
    container.appendChild(finishedBanner);
  }

  // Completed games — collapsed
  for (const game of plan.games) {
    if (game.gameNumber >= currentGame) break;
    const unavailable = getUnavailableForGame(game.gameNumber, allPlayerIds, events);
    container.appendChild(
      renderGameCard(game, plan, playerMap, lookup, unavailable, "completed", gameLabels, events, callbacks),
    );
  }

  // Current game — sticky
  const currentGameData = isSessionFinished
    ? undefined
    : plan.games.find((g) => g.gameNumber === currentGame);
  if (currentGameData) {
    const unavailable = getUnavailableForGame(currentGame, allPlayerIds, events);

    const sticky = document.createElement("div");
    sticky.className = "sticky-current";

    const card = renderGameCard(
      currentGameData, plan, playerMap, lookup, unavailable,
      "current", gameLabels, events, callbacks,
    );

    // ---- Actions zone (visually separated) ----
    const actionsZone = document.createElement("div");
    actionsZone.className = "game-actions";

    // Substitution control
    const subSuggestion = getNextSubSuggestion(plan, currentGame, unavailable, events);
    if (subSuggestion) {
      const inName = playerMap.get(subSuggestion.playerIn)?.name ?? "?";
      const outName = playerMap.get(subSuggestion.playerOut)?.name ?? "?";

      const subText = document.createElement("div");
      subText.className = "sub-action-text";
      subText.innerHTML = `<span class="chip chip-field chip-sm">${esc(inName)}</span> replaces <span class="chip chip-bench chip-sm">${esc(outName)}</span>`;
      actionsZone.appendChild(subText);

      const subBtn = document.createElement("button");
      subBtn.type = "button";
      subBtn.className = "btn-next-sub";
      subBtn.innerHTML = `${iconSub} Make sub`;
      subBtn.addEventListener("click", () => {
        callbacks.onMakeSub(currentGame, subSuggestion.playerOut, subSuggestion.playerIn);
      });
      actionsZone.appendChild(subBtn);
    }

    // Game progression
    if (hasNextGame) {
      const nextGameBtn = document.createElement("button");
      nextGameBtn.type = "button";
      nextGameBtn.className = "btn-next-game";
      nextGameBtn.innerHTML = `${iconNext} Start game ${nextGameNum}`;
      nextGameBtn.addEventListener("click", () => callbacks.onNextGame());
      actionsZone.appendChild(nextGameBtn);
    } else {
      const endGameBtn = document.createElement("button");
      endGameBtn.type = "button";
      endGameBtn.className = "btn-end-game";
      endGameBtn.innerHTML = `${iconEnd} End game`;
      endGameBtn.addEventListener("click", () => callbacks.onNextGame());
      actionsZone.appendChild(endGameBtn);
    }

    card.appendChild(actionsZone);
    sticky.appendChild(card);
    container.appendChild(sticky);
  }

  // Future games
  for (const game of plan.games) {
    if (game.gameNumber <= currentGame) continue;
    const unavailable = getUnavailableForGame(game.gameNumber, allPlayerIds, events);
    const emphasis: GameEmphasis = game.gameNumber === nextGameNum ? "next" : "future";
    container.appendChild(
      renderGameCard(game, plan, playerMap, lookup, unavailable, emphasis, gameLabels, events, callbacks),
    );
  }

  // Fairness breakdown
  const stats = getPlayerStats(plan, allPlayerIds, events);
  container.appendChild(renderFairnessSummary(stats, playerMap));

  container.appendChild(createActionSheet());
}

// ---- Event lookup ----

interface EventLookup {
  lateIds: Set<string>;
  joinedIds: Set<string>;
  injuredAt: Map<string, number>;
  leavingAfter: Map<string, number>;
}

function buildEventLookup(events: RotationEvent[]): EventLookup {
  const lateIds = new Set<string>();
  const joinedIds = new Set<string>();
  const injuredAt = new Map<string, number>();
  const leavingAfter = new Map<string, number>();

  for (const e of events) {
    if (e.type === "late") lateIds.add(e.playerId);
    else if (e.type === "joined") joinedIds.add(e.playerId);
    else if (e.type === "injured") injuredAt.set(e.playerId, e.gameNumber);
    else if (e.type === "leaving") leavingAfter.set(e.playerId, e.afterGame);
  }

  return { lateIds, joinedIds, injuredAt, leavingAfter };
}

function getChipStatus(
  playerId: string,
  gameNumber: number,
  lookup: EventLookup,
): ChipStatus {
  const injAt = lookup.injuredAt.get(playerId);
  if (injAt !== undefined && gameNumber >= injAt) return "injured";
  const leaveAt = lookup.leavingAfter.get(playerId);
  if (leaveAt !== undefined && gameNumber > leaveAt) return "leaving";
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
  plan: RotationPlan,
  playerMap: PlayerMap,
  lookup: EventLookup,
  unavailable: Set<string>,
  emphasis: GameEmphasis,
  gameLabels: Record<string, string>,
  events: RotationEvent[],
  callbacks: ResultsCallbacks,
): HTMLElement {
  const card = document.createElement("div");
  card.className = `game-card game-card-${emphasis}`;

  // ---- A. Header zone ----
  const headerRow = document.createElement("div");
  headerRow.className = "game-header";

  const savedLabel = gameLabels[String(game.gameNumber)] ?? "";
  const badgeInfo = BADGE_LABELS[emphasis];
  const badgeHTML = badgeInfo ? ` <span class="${badgeInfo.className}">${badgeInfo.text}</span>` : "";

  headerRow.appendChild(
    createGameTitle(
      game.gameNumber,
      savedLabel,
      badgeHTML,
      emphasis === "completed",
      (newLabel) => callbacks.onGameLabelChange(game.gameNumber, newLabel),
    ),
  );

  card.appendChild(headerRow);

  // ---- B. Players zone ----
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

  content.appendChild(renderSection("Playing", game.onField, "field", game.gameNumber, playerMap, lookup, callbacks));

  if (game.bench.length > 0) {
    content.appendChild(renderSection("Bench", game.bench, "bench", game.gameNumber, playerMap, lookup, callbacks));
  }

  const unavailableIds = [...unavailable].filter(
    (id) => !game.onField.includes(id) && !game.bench.includes(id),
  );
  if (unavailableIds.length > 0) {
    content.appendChild(renderSection("Unavailable", unavailableIds, "unavailable", game.gameNumber, playerMap, lookup, callbacks));
  }

  // Replacement suggestions
  const onFieldUnavailable = new Set(game.onField.filter((id) => unavailable.has(id)));
  if (onFieldUnavailable.size > 0) {
    const suggestions = getReplacements(game, unavailable);
    if (suggestions.length > 0) {
      content.appendChild(renderReplacements(suggestions, playerMap));
    }
  }

  // Fairness hint (current game only) — subtle guidance
  if (emphasis === "current" && game.bench.length > 0) {
    const stats = getPlayerStats(plan, [...game.onField, ...game.bench], events);
    const sorted = [...stats].sort((a, b) => a.fairnessScore - b.fairnessScore);
    const mostUnderplayed = sorted[0];
    if (mostUnderplayed && mostUnderplayed.fairnessScore < -0.3) {
      const name = playerMap.get(mostUnderplayed.playerId)?.name ?? "?";
      const hint = document.createElement("div");
      hint.className = "fairness-hint";
      hint.textContent = `${name} needs more time`;
      content.appendChild(hint);
    }
  }

  card.appendChild(content);
  return card;
}

/**
 * Creates a single editable game title: "Game 1 vs Tigers [pen]"
 * The prefix "Game N" is static. The opponent name is editable.
 * Pen icon and title are on one line, vertically centred.
 */
function createGameTitle(
  gameNumber: number,
  savedLabel: string,
  badgeHTML: string,
  readOnly: boolean,
  onSave: (label: string) => void,
): HTMLElement {
  const wrapper = document.createElement("h3");
  wrapper.className = "game-title";

  let currentLabel = savedLabel;

  // Static prefix
  const prefix = document.createElement("span");
  prefix.innerHTML = `Game ${gameNumber}${badgeHTML}`;
  wrapper.appendChild(prefix);

  // Editable label portion
  const labelSpan = document.createElement("span");
  labelSpan.className = "game-title-label";
  labelSpan.textContent = currentLabel ? ` ${currentLabel}` : "";
  wrapper.appendChild(labelSpan);

  // Hidden input — replaces the label when editing
  const input = document.createElement("input");
  input.type = "text";
  input.className = "game-title-input";
  input.placeholder = "Opponent";
  input.hidden = true;
  wrapper.appendChild(input);

  if (!readOnly) {
    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "game-title-edit";
    editBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>`;

    function startEdit(e: Event): void {
      e.stopPropagation();
      input.value = currentLabel;
      labelSpan.hidden = true;
      editBtn.hidden = true;
      input.hidden = false;
      input.focus();
      input.select();
    }

    function commitEdit(): void {
      const val = input.value.trim();
      currentLabel = val;
      onSave(val);
      labelSpan.textContent = val ? ` ${val}` : "";
      input.hidden = true;
      labelSpan.hidden = false;
      editBtn.hidden = false;
    }

    editBtn.addEventListener("click", startEdit);
    input.addEventListener("blur", commitEdit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); commitEdit(); }
      else if (e.key === "Escape") { input.value = currentLabel; commitEdit(); }
    });

    wrapper.appendChild(editBtn);
  }

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
  sectionLabel.className = `game-section-label game-section-label-${role}`;
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

  const player = playerMap.get(playerId);
  const name = player?.name ?? playerId;
  const chipRole = role === "unavailable" ? "bench" : role;

  if (status === "late") {
    chip.className = "chip chip-late";
    chip.innerHTML = `${esc(name)}<span class="chip-status-dot"></span>`;
  } else if (status === "injured") {
    chip.className = "chip chip-injured";
    chip.textContent = name;
  } else if (status === "leaving") {
    chip.className = "chip chip-late";
    chip.innerHTML = `${esc(name)}<span class="chip-status-dot"></span>`;
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

  let statusBadge = "";
  if (status === "late") {
    statusBadge = `<span class="action-sheet-status action-sheet-status-late">Not here</span>`;
  } else if (status === "injured") {
    const injAt = lookup.injuredAt.get(playerId);
    statusBadge = `<span class="action-sheet-status action-sheet-status-injured">Injured${injAt ? ` game ${injAt}` : ""}</span>`;
  } else if (status === "leaving") {
    const leaveAt = lookup.leavingAfter.get(playerId);
    statusBadge = `<span class="action-sheet-status action-sheet-status-late">Leaving after game ${leaveAt}</span>`;
  }

  let actionsHTML = "";

  if (status === "active" || status === "joined") {
    actionsHTML = `
      <button type="button" class="action-btn action-btn-late" data-action="late">
        <span class="action-btn-row">${iconLate} Not here yet</span>
        <span class="action-desc">Unavailable until they arrive</span>
      </button>
      <button type="button" class="action-btn action-btn-injured" data-action="injured">
        <span class="action-btn-row">${iconInjured} Injured</span>
        <span class="action-desc">Out for remaining games</span>
      </button>
      <button type="button" class="action-btn" data-action="leaving">
        <span class="action-btn-row">${iconLeaving} Leaving early</span>
        <span class="action-desc">Unavailable for later games</span>
      </button>
    `;
  } else if (status === "late") {
    actionsHTML = `
      <button type="button" class="action-btn action-btn-joined" data-action="joined">
        <span class="action-btn-row">${iconArrived} Arrived</span>
        <span class="action-desc">On the bench and ready</span>
      </button>
      <button type="button" class="action-btn action-btn-clear" data-action="clear">
        <span class="action-btn-row">${iconReset} Reset</span>
        <span class="action-desc">Back into the full rotation</span>
      </button>
    `;
  } else {
    actionsHTML = `
      <button type="button" class="action-btn action-btn-clear" data-action="clear">
        <span class="action-btn-row">${iconReset} Reset</span>
        <span class="action-desc">Back into the full rotation</span>
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
      else if (action === "leaving") callbacks.onMarkLeaving(playerId, gameNumber);
    });
  });

  sheet.hidden = false;
}

function dismissActionSheet(): void {
  const sheet = document.getElementById("action-sheet");
  if (sheet) { sheet.hidden = true; sheet.dataset.playerId = ""; }
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
    <span class="replacement-title">Replacements</span>
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
        <span class="chip chip-field chip-sm">${inName}</span>
        <span class="replacement-arrow">replaces</span>
        <span class="chip chip-injured chip-sm">${outName}</span>
      </div>
    `;
  }

  return `
    <div class="replacement-row">
      <span class="chip chip-injured chip-sm">${outName}</span>
      <span class="replacement-arrow">&mdash;</span>
      <span class="replacement-none">no replacement available</span>
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

  const sorted = [...stats].sort((a, b) => a.fairnessScore - b.fairnessScore);

  for (const stat of sorted) {
    const name = playerMap.get(stat.playerId)?.name ?? stat.playerId;
    const totalGames = stat.playTimeUnits + stat.gamesBenched;
    const pct = totalGames > 0 ? Math.round((stat.playTimeUnits / totalGames) * 100) : 0;

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
