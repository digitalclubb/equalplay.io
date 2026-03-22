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
  getSubCandidates,
  getPlayerStats,
} from "../logic/rotation.js";
import {
  iconSub,
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
  onStartMatch: () => void;
  onStartNew: () => void;
  onShare?: () => void;
  /** If set, the share button shows this label instead of the default */
  shareLabel?: string;
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
  readOnly = false,
  matchMode: "setup" | "live" = "live",
): void {
  container.innerHTML = "";

  const lookup = buildEventLookup(events);
  const totalGames = plan.games.length;
  const nextGameNum = currentGame + 1;
  const hasNextGame = nextGameNum <= totalGames;

  if (!readOnly) {
    const actionsRow = document.createElement("div");
    actionsRow.className = "session-actions-row";

    if (callbacks.onShare) {
      const shareBtn = document.createElement("button");
      shareBtn.type = "button";
      shareBtn.className = "btn-share-live";
      shareBtn.textContent = callbacks.shareLabel ?? "Share live plan \u2197";
      shareBtn.addEventListener("click", () => {
        callbacks.onShare!();
      });
      actionsRow.appendChild(shareBtn);
    }

    const resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.className = "btn-reset";
    resetBtn.textContent = "Reset session";
    resetBtn.addEventListener("click", () => {
      if (window.confirm("This will clear all players, games and events. Are you sure?")) {
        callbacks.onStartNew();
      }
    });
    actionsRow.appendChild(resetBtn);

    container.appendChild(actionsRow);
  }

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
      renderGameCard(game, playerMap, lookup, unavailable, "completed", gameLabels, callbacks, readOnly),
    );
  }

  // Current game — sticky only in live mode
  const currentGameData = isSessionFinished
    ? undefined
    : plan.games.find((g) => g.gameNumber === currentGame);
  if (currentGameData) {
    const unavailable = getUnavailableForGame(currentGame, allPlayerIds, events);
    const isLive = matchMode === "live";

    const card = renderGameCard(
      currentGameData, playerMap, lookup, unavailable,
      isLive ? "current" : "next", gameLabels, callbacks, readOnly,
    );

    if (!readOnly) {
      const actionsZone = document.createElement("div");
      actionsZone.className = "game-actions";

      if (isLive) {
        // ---- Live mode: sub controls + game progression ----
        const candidates = getSubCandidates(plan, currentGame, unavailable, events);
        if (candidates) {
          const { benchRanked, fieldRanked, injuredOut } = candidates;
          let inIdx = 0;
          let outIdx = 0;

          const strip = document.createElement("div");
          strip.className = "sub-strip";
          if (injuredOut) strip.classList.add("sub-strip-urgent");

          const label = document.createElement("span");
          label.className = "sub-strip-label";
          label.textContent = injuredOut ? "Injury replacement" : "Next sub";
          strip.appendChild(label);

          const row = document.createElement("div");
          row.className = "sub-strip-row";

          const inChip = document.createElement("button");
          inChip.type = "button";
          inChip.className = "chip chip-field chip-sm sub-chip";
          inChip.dataset.testid = "sub-in";

          const arrow = document.createElement("span");
          arrow.className = "sub-strip-arrow";
          arrow.textContent = "on for";

          const outChip = document.createElement("button");
          outChip.type = "button";
          outChip.className = injuredOut
            ? "chip chip-injured chip-sm sub-chip"
            : "chip chip-bench chip-sm sub-chip";
          outChip.dataset.testid = "sub-out";

          function updateChips(animate = false): void {
            const inId = benchRanked[inIdx];
            const outId = fieldRanked[outIdx];
            const inName = playerMap.get(inId)?.name ?? "?";
            const outName = playerMap.get(outId)?.name ?? "?";

            if (animate) {
              row.classList.add("sub-strip-exit");
              setTimeout(() => {
                inChip.textContent = inName;
                outChip.textContent = outName;
                row.classList.remove("sub-strip-exit");
                row.classList.add("sub-strip-enter");
                setTimeout(() => row.classList.remove("sub-strip-enter"), 150);
              }, 100);
            } else {
              inChip.textContent = inName;
              outChip.textContent = outName;
            }
          }

          updateChips();

          if (benchRanked.length > 1) {
            inChip.classList.add("sub-chip-cyclable");
            inChip.addEventListener("click", (e) => {
              e.stopPropagation();
              inIdx = (inIdx + 1) % benchRanked.length;
              updateChips(true);
            });
          }

          if (fieldRanked.length > 1) {
            outChip.classList.add("sub-chip-cyclable");
            outChip.addEventListener("click", (e) => {
              e.stopPropagation();
              outIdx = (outIdx + 1) % fieldRanked.length;
              updateChips(true);
            });
          }

          row.appendChild(inChip);
          row.appendChild(arrow);
          row.appendChild(outChip);
          strip.appendChild(row);

          const subBtn = document.createElement("button");
          subBtn.type = "button";
          subBtn.className = "btn-next-sub";
          subBtn.innerHTML = `${iconSub} Make sub`;
          subBtn.addEventListener("click", () => {
            const inId = benchRanked[inIdx];
            const outId = fieldRanked[outIdx];
            callbacks.onMakeSub(currentGame, outId, inId);
          });
          strip.appendChild(subBtn);

          actionsZone.appendChild(strip);
        } else {
          const balanced = document.createElement("div");
          balanced.className = "sub-strip-balanced";
          balanced.textContent = "All players balanced";
          actionsZone.appendChild(balanced);
        }

        // Game progression
        if (hasNextGame) {
          const nextGameBtn = document.createElement("button");
          nextGameBtn.type = "button";
          nextGameBtn.className = "btn-next-game";
          nextGameBtn.textContent = "Start next game";
          nextGameBtn.addEventListener("click", () => callbacks.onNextGame());
          actionsZone.appendChild(nextGameBtn);
        } else {
          const endGameBtn = document.createElement("button");
          endGameBtn.type = "button";
          endGameBtn.className = "btn-end-game";
          endGameBtn.textContent = "End game";
          endGameBtn.addEventListener("click", () => callbacks.onNextGame());
          actionsZone.appendChild(endGameBtn);
        }
      } else {
        // ---- Setup mode: "Start match" button ----
        const startBtn = document.createElement("button");
        startBtn.type = "button";
        startBtn.className = "btn-start-match";
        startBtn.textContent = "Start game";
        startBtn.addEventListener("click", () => callbacks.onStartMatch());
        actionsZone.appendChild(startBtn);
      }

      card.appendChild(actionsZone);
    }

    if (isLive) {
      // Wrap in sticky container
      const sticky = document.createElement("div");
      sticky.className = "sticky-current";
      sticky.appendChild(card);
      container.appendChild(sticky);
    } else {
      // Setup mode: no sticky, just append normally
      container.appendChild(card);
    }
  }

  // Future games
  for (const game of plan.games) {
    if (game.gameNumber <= currentGame) continue;
    const unavailable = getUnavailableForGame(game.gameNumber, allPlayerIds, events);
    const emphasis: GameEmphasis = game.gameNumber === nextGameNum ? "next" : "future";
    container.appendChild(
      renderGameCard(game, playerMap, lookup, unavailable, emphasis, gameLabels, callbacks, readOnly),
    );
  }

  // Fairness breakdown
  const stats = getPlayerStats(plan, allPlayerIds, events);
  container.appendChild(renderFairnessSummary(stats, playerMap));

  if (!readOnly) {
    container.appendChild(createActionSheet());
  }
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
  playerMap: PlayerMap,
  lookup: EventLookup,
  unavailable: Set<string>,
  emphasis: GameEmphasis,
  gameLabels: Record<string, string>,
  callbacks: ResultsCallbacks,
  readOnly = false,
): HTMLElement {
  const card = document.createElement("div");
  card.className = `game-card game-card-${emphasis}`;
  card.dataset.testid = `game-${game.gameNumber}`;

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
      emphasis === "completed" || readOnly,
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
      if ((e.target as HTMLElement).classList.contains("match-detail-input")) return;
      content.classList.toggle("game-content-collapsed");
    });
  }

  const isReadOnly = emphasis === "completed" || readOnly;

  content.appendChild(renderSection("Playing", game.onField, "field", game.gameNumber, playerMap, lookup, callbacks, isReadOnly));

  if (game.bench.length > 0) {
    content.appendChild(renderSection("Bench", game.bench, "bench", game.gameNumber, playerMap, lookup, callbacks, isReadOnly));
  }

  const unavailableIds = [...unavailable].filter(
    (id) => !game.onField.includes(id) && !game.bench.includes(id),
  );
  if (unavailableIds.length > 0) {
    content.appendChild(renderSection("Unavailable", unavailableIds, "unavailable", game.gameNumber, playerMap, lookup, callbacks, isReadOnly));
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

/** Parse "pitch|time|opponent" into parts */
function parseMatchDetails(raw: string): { pitch: string; time: string; opponent: string } {
  const parts = raw.split("|");
  return {
    pitch: (parts[0] ?? "").trim(),
    time: (parts[1] ?? "").trim(),
    opponent: (parts[2] ?? "").trim(),
  };
}

function serializeMatchDetails(d: { pitch: string; time: string; opponent: string }): string {
  return `${d.pitch}|${d.time}|${d.opponent}`;
}

function formatMatchDetails(d: { pitch: string; time: string; opponent: string }): string {
  const parts: string[] = [];
  if (d.pitch) parts.push(`Pitch ${d.pitch}`);
  if (d.time) {
    // Strip seconds if present (e.g. "11:30:00" → "11:30")
    const t = d.time.includes(":") ? d.time.split(":").slice(0, 2).join(":") : d.time;
    parts.push(t);
  }
  if (d.opponent) parts.push(`vs ${d.opponent}`);
  return parts.join(" \u00B7 ");
}

/**
 * Game header: "Game 1 LIVE" title + match details row.
 * Details show as "Pitch 6 · 11:30 · Tigers" — tappable to edit.
 */
function createGameTitle(
  gameNumber: number,
  savedLabel: string,
  badgeHTML: string,
  readOnly: boolean,
  onSave: (label: string) => void,
): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "game-title-wrap";

  // Title line: "Game 1 LIVE"
  const title = document.createElement("h3");
  title.className = "game-title";
  title.innerHTML = `Game ${gameNumber}${badgeHTML}`;
  wrapper.appendChild(title);

  // Match details row
  const details = parseMatchDetails(savedLabel);
  let current = { ...details };

  const displayRow = document.createElement("div");
  displayRow.className = "match-details";

  const displayText = document.createElement("span");
  displayText.className = "match-details-text";
  const formatted = formatMatchDetails(current);
  displayText.textContent = formatted || "Add details";
  if (!formatted) displayText.classList.add("match-details-empty");
  displayRow.appendChild(displayText);

  // Edit row — 3 compact inputs on one line
  const editRow = document.createElement("div");
  editRow.className = "match-details-edit";
  editRow.hidden = true;

  const pitchInput = document.createElement("input");
  pitchInput.type = "number";
  pitchInput.min = "1";
  pitchInput.className = "match-detail-input";
  pitchInput.placeholder = "Pitch";

  const timeInput = document.createElement("input");
  timeInput.type = "time";
  timeInput.className = "match-detail-input";

  const oppInput = document.createElement("input");
  oppInput.type = "text";
  oppInput.className = "match-detail-input match-detail-input-wide";
  oppInput.placeholder = "Opponent";

  const doneBtn = document.createElement("button");
  doneBtn.type = "button";
  doneBtn.className = "match-detail-done";
  doneBtn.textContent = "Done";

  editRow.appendChild(pitchInput);
  editRow.appendChild(timeInput);
  editRow.appendChild(oppInput);
  editRow.appendChild(doneBtn);

  if (!readOnly) {
    function startEdit(e: Event): void {
      e.stopPropagation();
      pitchInput.value = current.pitch;
      timeInput.value = current.time;
      oppInput.value = current.opponent;
      displayRow.hidden = true;
      editRow.hidden = false;
      pitchInput.focus();
    }

    function commitEdit(): void {
      current = {
        pitch: pitchInput.value.trim(),
        time: timeInput.value.trim(),
        opponent: oppInput.value.trim(),
      };
      onSave(serializeMatchDetails(current));
      const fmt = formatMatchDetails(current);
      displayText.textContent = fmt || "Add details";
      displayText.classList.toggle("match-details-empty", !fmt);
      editRow.hidden = true;
      displayRow.hidden = false;
    }

    displayRow.addEventListener("click", startEdit);
    displayRow.style.cursor = "pointer";

    doneBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      commitEdit();
    });

    // Enter on any input commits
    for (const inp of [pitchInput, timeInput, oppInput]) {
      inp.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); commitEdit(); }
        else if (e.key === "Escape") { commitEdit(); }
      });
    }
  }

  wrapper.appendChild(displayRow);
  wrapper.appendChild(editRow);
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
  readOnly = false,
): HTMLElement {
  const section = document.createElement("div");
  section.className = "game-section";
  section.dataset.testid = `section-${role}`;

  const sectionLabel = document.createElement("span");
  sectionLabel.className = `game-section-label game-section-label-${role}`;
  sectionLabel.textContent = label;
  section.appendChild(sectionLabel);

  const chipList = document.createElement("div");
  chipList.className = "chip-list";
  for (const id of playerIds) {
    const status = getChipStatus(id, gameNumber, lookup);
    chipList.appendChild(createChip(id, playerMap, role, status, gameNumber, lookup, callbacks, readOnly));
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
  readOnly = false,
): HTMLElement {
  const chip = document.createElement(readOnly ? "span" : "button");
  if (!readOnly) (chip as HTMLButtonElement).type = "button";

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

  if (!readOnly) {
    chip.addEventListener("click", (e) => {
      e.stopPropagation();
      showActionSheet(playerId, name, status, gameNumber, lookup, callbacks);
    });
  } else {
    chip.style.cursor = "default";
  }

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
