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
import { esc } from "../lib/esc.js";

type PlayerMap = Map<string, Player>;

export interface ResultsCallbacks {
  onMarkLate: (playerId: string) => void;
  onMarkInjured: (playerId: string, gameNumber: number) => void;
  onMarkJoined: (playerId: string) => void;
  onMarkLeaving: (playerId: string, afterGame: number) => void;
  onClearStatus: (playerId: string) => void;
  onTeamSizeChange: (gameNumber: number, size: number) => void;
  onGameLabelChange: (gameNumber: number, label: string) => void;
  onMakeSub: (gameNumber: number, playerOut: string, playerIn: string) => void;
  onNextGame: () => void;
  onPrevGame: () => void;
  onStartMatch: () => void;
  onStartNew: () => void;
}

type ChipStatus = "active" | "late" | "injured" | "joined" | "leaving";

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
  readOnly = false,
  matchMode: "setup" | "live" = "live",
  teamSizeOverrides: Record<string, number> = {},
): void {
  container.innerHTML = "";

  const lookup = buildEventLookup(events);
  const totalGames = plan.games.length;
  const nextGameNum = currentGame + 1;
  const hasNextGame = nextGameNum <= totalGames;

  if (!readOnly) {
    const actionsRow = document.createElement("div");
    actionsRow.className = "session-actions-row";

    const historyBtn = document.createElement("button");
    historyBtn.type = "button";
    historyBtn.className = "btn-history";
    historyBtn.textContent = "Session history";
    historyBtn.addEventListener("click", () => {
      showHistoryView(plan, events, gameLabels, playerMap);
    });
    actionsRow.appendChild(historyBtn);

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
      <h3>\uD83C\uDFC1 All games completed</h3>
      <p>Well done! Check the playing time breakdown below.</p>
    `;
    if (!readOnly && totalGames > 0) {
      const backLink = document.createElement("button");
      backLink.type = "button";
      backLink.className = "btn-prev-game";
      backLink.textContent = `← Back to game ${totalGames}`;
      backLink.addEventListener("click", () => callbacks.onPrevGame());
      finishedBanner.appendChild(backLink);
    }
    container.appendChild(finishedBanner);
  }

  // Completed games. Collapsed
  for (const game of plan.games) {
    if (game.gameNumber >= currentGame) break;
    const unavailable = getUnavailableForGame(game.gameNumber, allPlayerIds, events);
    container.appendChild(
      renderGameCard(game, playerMap, lookup, unavailable, "completed", gameLabels, callbacks, readOnly, playersPerTeam, teamSizeOverrides),
    );
  }

  // Current game
  const currentGameData = isSessionFinished
    ? undefined
    : plan.games.find((g) => g.gameNumber === currentGame);
  if (currentGameData) {
    const unavailable = getUnavailableForGame(currentGame, allPlayerIds, events);
    const isLive = matchMode === "live";

    const card = renderGameCard(
      currentGameData, playerMap, lookup, unavailable,
      isLive ? "current" : "next", gameLabels, callbacks, readOnly,
      playersPerTeam, teamSizeOverrides,
    );

    if (!readOnly) {
      const actionsZone = document.createElement("div");
      actionsZone.className = "game-actions";

      if (isLive) {
        // ---- Recent actions (read-only, above sub controls) ----
        const recent = renderRecentSection(events, currentGame, playerMap);
        if (recent) actionsZone.appendChild(recent);

        // ---- Live mode: sub controls + game progression ----
        const candidates = getSubCandidates(plan, currentGame, unavailable, events);

        // When candidates is null (all balanced), fall back to raw bench/field
        // so the coach can still make manual subs (single row).
        const availBench = currentGameData.bench.filter((id) => !unavailable.has(id));
        const availField = currentGameData.onField.filter((id) => !unavailable.has(id));
        const benchRanked = candidates ? candidates.benchRanked : availBench;
        const fieldRanked = candidates ? candidates.fieldRanked : availField;
        const injuredOut = candidates?.injuredOut ?? false;
        const injuredCount = candidates?.injuredCount ?? 0;
        const pairCount = candidates
          ? candidates.pairCount
          : (benchRanked.length > 0 && fieldRanked.length > 0 ? 1 : 0);

        if (pairCount > 0) {
          const strip = document.createElement("div");
          strip.className = "sub-strip";
          if (injuredOut) strip.classList.add("sub-strip-urgent");

          const stripLabel = document.createElement("span");
          stripLabel.className = "sub-strip-label";
          if (injuredOut) {
            stripLabel.textContent = pairCount > 1 ? "Injury replacements" : "Injury replacement";
          } else if (candidates) {
            stripLabel.textContent = "Next sub";
          } else {
            stripLabel.textContent = "All players balanced";
          }
          strip.appendChild(stripLabel);

          // Primary row: prominent chips + Make sub button.
          // Chips are cyclable when there are alternatives, so the coach can
          // override the recommendation if they have a specific player in mind.
          let inIdx = 0;
          let outIdx = 0;
          const primaryIsInjury = injuredCount > 0;

          const primaryRow = document.createElement("div");
          primaryRow.className = "sub-strip-row";

          const primaryInChip = document.createElement("button");
          primaryInChip.type = "button";
          primaryInChip.className = "chip chip-field chip-sm sub-chip";
          primaryInChip.dataset.testid = "sub-in";

          const primaryArrow = document.createElement("span");
          primaryArrow.className = "sub-strip-arrow";
          primaryArrow.textContent = "on for";

          const primaryOutChip = document.createElement("button");
          primaryOutChip.type = "button";
          primaryOutChip.className = primaryIsInjury
            ? "chip chip-injured chip-sm sub-chip"
            : "chip chip-bench chip-sm sub-chip";
          primaryOutChip.dataset.testid = "sub-out";

          function updateChips(animate = false): void {
            const inName = playerMap.get(benchRanked[inIdx])?.name ?? "?";
            const outName = playerMap.get(fieldRanked[outIdx])?.name ?? "?";
            if (animate) {
              primaryRow.classList.add("sub-strip-exit");
              setTimeout(() => {
                primaryInChip.textContent = inName;
                primaryOutChip.textContent = outName;
                primaryRow.classList.remove("sub-strip-exit");
                primaryRow.classList.add("sub-strip-enter");
                setTimeout(() => primaryRow.classList.remove("sub-strip-enter"), 150);
              }, 100);
            } else {
              primaryInChip.textContent = inName;
              primaryOutChip.textContent = outName;
            }
          }

          updateChips();

          if (benchRanked.length > 1) {
            primaryInChip.classList.add("sub-chip-cyclable");
            primaryInChip.addEventListener("click", (e) => {
              e.stopPropagation();
              inIdx = (inIdx + 1) % benchRanked.length;
              updateChips(true);
            });
          }

          if (fieldRanked.length > 1) {
            primaryOutChip.classList.add("sub-chip-cyclable");
            primaryOutChip.addEventListener("click", (e) => {
              e.stopPropagation();
              outIdx = (outIdx + 1) % fieldRanked.length;
              updateChips(true);
            });
          }

          primaryRow.appendChild(primaryInChip);
          primaryRow.appendChild(primaryArrow);
          primaryRow.appendChild(primaryOutChip);
          strip.appendChild(primaryRow);

          const subBtn = document.createElement("button");
          subBtn.type = "button";
          subBtn.className = "btn-next-sub";
          subBtn.innerHTML = `${iconSub} Make sub`;
          subBtn.addEventListener("click", () => {
            callbacks.onMakeSub(currentGame, fieldRanked[outIdx], benchRanked[inIdx]);
          });
          strip.appendChild(subBtn);

          // Upcoming preview: rows 1+ as read-only chip pairs
          if (pairCount > 1) {
            const upcoming = document.createElement("div");
            upcoming.className = "sub-strip-upcoming";

            const upcomingLabel = document.createElement("span");
            upcomingLabel.className = "sub-strip-upcoming-label";
            upcomingLabel.textContent = pairCount > 2 ? "Upcoming subs" : "Upcoming sub";
            upcoming.appendChild(upcomingLabel);

            for (let i = 1; i < pairCount; i++) {
              const inName = playerMap.get(benchRanked[i])?.name ?? "?";
              const outName = playerMap.get(fieldRanked[i])?.name ?? "?";
              const isInjuryRow = i < injuredCount;

              const row = document.createElement("div");
              row.className = "sub-strip-row sub-strip-row-upcoming";

              const inChip = document.createElement("span");
              inChip.className = "chip chip-field chip-sm";
              inChip.textContent = inName;

              const arrow = document.createElement("span");
              arrow.className = "sub-strip-arrow";
              arrow.textContent = "on for";

              const outChip = document.createElement("span");
              outChip.className = isInjuryRow
                ? "chip chip-injured chip-sm"
                : "chip chip-bench chip-sm";
              outChip.textContent = outName;

              row.appendChild(inChip);
              row.appendChild(arrow);
              row.appendChild(outChip);
              upcoming.appendChild(row);
            }

            strip.appendChild(upcoming);
          }

          actionsZone.appendChild(strip);
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

        // Recovery link. Coach can step back if they advanced by mistake.
        if (currentGame > 1) {
          const backLink = document.createElement("button");
          backLink.type = "button";
          backLink.className = "btn-prev-game";
          backLink.textContent = `← Back to game ${currentGame - 1}`;
          backLink.addEventListener("click", () => callbacks.onPrevGame());
          actionsZone.appendChild(backLink);
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

    container.appendChild(card);
  }

  // Future games
  for (const game of plan.games) {
    if (game.gameNumber <= currentGame) continue;
    const unavailable = getUnavailableForGame(game.gameNumber, allPlayerIds, events);
    const emphasis: GameEmphasis = game.gameNumber === nextGameNum ? "next" : "future";
    container.appendChild(
      renderGameCard(game, playerMap, lookup, unavailable, emphasis, gameLabels, callbacks, readOnly, playersPerTeam, teamSizeOverrides),
    );
  }

  // Fairness breakdown
  const stats = getPlayerStats(plan, allPlayerIds, events);
  container.appendChild(renderFairnessSummary(stats, playerMap));

  if (!readOnly) {
    // Below the totals, which is the point at which match day is dealt with and
    // the session is the next thing on the list. See docs/one-product.md.
    container.appendChild(renderNextStep());
    ensureActionSheet();
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
  defaultTeamSize = 0,
  teamSizeOverrides: Record<string, number> = {},
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

  // ---- Team size control (editable in setup/future, not completed) ----
  if (!readOnly && emphasis !== "completed" && defaultTeamSize > 0) {
    const currentSize = teamSizeOverrides[String(game.gameNumber)] ?? defaultTeamSize;
    const totalPlayers = game.onField.length + game.bench.length;
    const maxSize = totalPlayers;
    const minSize = 1;

    const sizeRow = document.createElement("div");
    sizeRow.className = "team-size-row";

    const sizeLabel = document.createElement("span");
    sizeLabel.className = "team-size-label";
    sizeLabel.textContent = "Players on field";
    sizeRow.appendChild(sizeLabel);

    const stepper = document.createElement("div");
    stepper.className = "team-size-stepper";

    const minusBtn = document.createElement("button");
    minusBtn.type = "button";
    minusBtn.className = "team-size-btn";
    minusBtn.textContent = "\u2212";
    minusBtn.disabled = currentSize <= minSize;
    minusBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (currentSize > minSize) {
        callbacks.onTeamSizeChange(game.gameNumber, currentSize - 1);
      }
    });

    const sizeDisplay = document.createElement("span");
    sizeDisplay.className = "team-size-value";
    sizeDisplay.textContent = String(currentSize);
    if (currentSize !== defaultTeamSize) {
      sizeDisplay.classList.add("team-size-value-modified");
    }

    const plusBtn = document.createElement("button");
    plusBtn.type = "button";
    plusBtn.className = "team-size-btn";
    plusBtn.textContent = "+";
    plusBtn.disabled = currentSize >= maxSize;
    plusBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (currentSize < maxSize) {
        callbacks.onTeamSizeChange(game.gameNumber, currentSize + 1);
      }
    });

    stepper.appendChild(minusBtn);
    stepper.appendChild(sizeDisplay);
    stepper.appendChild(plusBtn);
    sizeRow.appendChild(stepper);
    card.appendChild(sizeRow);
  }

  // ---- B. Players zone ----
  const content = document.createElement("div");
  content.className = "game-content";

  const isCollapsible = emphasis === "completed" || emphasis === "future";
  if (isCollapsible) {
    content.classList.add("game-content-collapsed");
    headerRow.classList.add("game-header-collapsible");
    headerRow.setAttribute("role", "button");
    headerRow.setAttribute("tabindex", "0");
    headerRow.setAttribute("aria-expanded", "false");
    headerRow.setAttribute("aria-controls", `game-content-${game.gameNumber}`);
    content.id = `game-content-${game.gameNumber}`;
    const toggleCollapse = (e: Event) => {
      if ((e.target as HTMLElement).classList.contains("match-detail-input")) return;
      if ((e.target as HTMLElement).closest(".team-size-stepper")) return;
      const isCollapsed = content.classList.toggle("game-content-collapsed");
      headerRow.setAttribute("aria-expanded", String(!isCollapsed));
    };
    headerRow.addEventListener("click", toggleCollapse);
    headerRow.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggleCollapse(e);
      }
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
 * Details show as "Pitch 6 · 11:30 · Tigers". Tappable to edit.
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

  // Edit row. 3 compact inputs on one line
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
    chip.dataset.playerId = playerId;
    const statusLabel = status === "active" ? role : status;
    chip.setAttribute("aria-label", `${name}, ${statusLabel}. Tap for actions`);
    chip.addEventListener("click", (e) => {
      e.stopPropagation();
      showActionSheet(playerId, name, status, gameNumber, lookup, callbacks);
    });
  } else {
    chip.style.cursor = "default";
    const statusLabel = status === "active" ? role : status;
    chip.setAttribute("aria-label", `${name}, ${statusLabel}`);
  }

  return chip;
}

// ---- Action Sheet ----

/** Create the action sheet once on body so it survives container rebuilds. */
function ensureActionSheet(): void {
  if (document.getElementById("action-sheet")) return;
  const sheet = document.createElement("div");
  sheet.id = "action-sheet";
  sheet.className = "action-sheet";
  sheet.hidden = true;
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-modal", "true");
  document.body.appendChild(sheet);
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

  sheet.setAttribute("aria-label", `Actions for ${playerName}`);

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

  // Focus first action button and trap focus
  const firstBtn = sheet.querySelector<HTMLButtonElement>(".action-btn");
  if (firstBtn) firstBtn.focus();

  // Store the element that triggered the sheet so we can return focus
  sheet.dataset.triggerPlayerId = playerId;

  // Escape key and focus trap
  document.removeEventListener("keydown", handleActionSheetKeydown);
  document.addEventListener("keydown", handleActionSheetKeydown);
}

function handleActionSheetKeydown(e: KeyboardEvent): void {
  if (e.key === "Escape") {
    e.preventDefault();
    dismissActionSheet();
    return;
  }

  // Trap focus within the sheet
  if (e.key === "Tab") {
    const sheet = document.getElementById("action-sheet");
    if (!sheet) return;
    const focusable = sheet.querySelectorAll<HTMLElement>("button, [tabindex]");
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
}

function dismissActionSheet(): void {
  const sheet = document.getElementById("action-sheet");
  if (sheet) {
    // Return focus to the chip that opened the sheet
    const triggerId = sheet.dataset.triggerPlayerId;
    sheet.hidden = true;
    sheet.dataset.playerId = "";
    sheet.dataset.triggerPlayerId = "";

    if (triggerId) {
      const trigger = document.querySelector<HTMLElement>(`[data-player-id="${triggerId}"]`);
      if (trigger) trigger.focus();
    }
  }
  const backdrop = document.getElementById("action-backdrop");
  if (backdrop) backdrop.hidden = true;
  document.removeEventListener("keydown", handleActionSheetKeydown);
}

// ---- Session history ----

/** Game-scoped events for the history view. Excludes session-level "late"
 * (joined event already shows when they arrived). */
function getGameHistoryActions(
  events: RotationEvent[],
  gameNumber: number,
  playerMap: PlayerMap,
): { kind: "sub" | "joined" | "injured" | "leaving"; text: string }[] {
  const out: { kind: "sub" | "joined" | "injured" | "leaving"; text: string }[] = [];
  for (const e of events) {
    if (e.type === "sub" && e.gameNumber === gameNumber) {
      const inName = playerMap.get(e.playerIn)?.name ?? "Player";
      const outName = playerMap.get(e.playerOut)?.name ?? "Player";
      out.push({ kind: "sub", text: `${inName} on for ${outName}` });
    } else if (e.type === "injured" && e.gameNumber === gameNumber) {
      const name = playerMap.get(e.playerId)?.name ?? "Player";
      out.push({ kind: "injured", text: `${name} injured` });
    } else if (e.type === "joined" && e.duringGame === gameNumber) {
      const name = playerMap.get(e.playerId)?.name ?? "Player";
      out.push({ kind: "joined", text: `${name} arrived` });
    } else if (e.type === "leaving" && e.afterGame === gameNumber) {
      const name = playerMap.get(e.playerId)?.name ?? "Player";
      out.push({ kind: "leaving", text: `${name} leaving` });
    }
  }
  return out;
}

function formatGameHeading(gameNumber: number, savedLabel: string): string {
  const details = parseMatchDetails(savedLabel);
  const formatted = formatMatchDetails(details);
  return formatted ? `Game ${gameNumber} · ${formatted}` : `Game ${gameNumber}`;
}

function showHistoryView(
  plan: RotationPlan,
  events: RotationEvent[],
  gameLabels: Record<string, string>,
  playerMap: PlayerMap,
): void {
  let sheet = document.getElementById("history-sheet");
  let backdrop = document.getElementById("history-backdrop");

  if (!backdrop) {
    backdrop = document.createElement("div");
    backdrop.id = "history-backdrop";
    backdrop.className = "action-backdrop";
    backdrop.addEventListener("click", dismissHistoryView);
    document.body.appendChild(backdrop);
  }

  if (!sheet) {
    sheet = document.createElement("div");
    sheet.id = "history-sheet";
    sheet.className = "history-sheet";
    sheet.setAttribute("role", "dialog");
    sheet.setAttribute("aria-modal", "true");
    sheet.setAttribute("aria-label", "Session history");
    document.body.appendChild(sheet);
  }

  // Total sub count for the header summary
  const subTotal = events.reduce((n, e) => (e.type === "sub" ? n + 1 : n), 0);
  const subSummary = subTotal === 1 ? "1 sub" : `${subTotal} subs`;

  const gamesHTML = plan.games.map((game) => {
    const heading = esc(formatGameHeading(game.gameNumber, gameLabels[String(game.gameNumber)] ?? ""));
    const onFieldNames = game.onField
      .map((id) => esc(playerMap.get(id)?.name ?? "?"))
      .join(", ");
    const benchNames = game.bench
      .map((id) => esc(playerMap.get(id)?.name ?? "?"))
      .join(", ");

    const actions = getGameHistoryActions(events, game.gameNumber, playerMap);
    const subCount = actions.filter((a) => a.kind === "sub").length;
    const subBadge = subCount > 0
      ? `<span class="history-game-badge">${subCount} sub${subCount === 1 ? "" : "s"}</span>`
      : `<span class="history-game-badge history-game-badge-empty">No subs</span>`;

    const activityHTML = actions.length > 0
      ? `<ul class="history-actions">${actions
          .map((a) => `<li class="history-action history-action-${a.kind}">${esc(a.text)}</li>`)
          .join("")}</ul>`
      : `<p class="history-empty">No activity recorded</p>`;

    return `
      <section class="history-game">
        <div class="history-game-head">
          <h3 class="history-game-title">${heading}</h3>
          ${subBadge}
        </div>
        <div class="history-lineup">
          <div><span class="history-lineup-label">On field</span> ${onFieldNames || "&mdash;"}</div>
          ${benchNames ? `<div><span class="history-lineup-label">Bench</span> ${benchNames}</div>` : ""}
        </div>
        ${activityHTML}
      </section>
    `;
  }).join("");

  sheet.innerHTML = `
    <header class="history-sheet-header">
      <div>
        <h2 class="history-sheet-title">Session history</h2>
        <p class="history-sheet-summary">${plan.games.length} games · ${subSummary}</p>
      </div>
      <button type="button" class="history-close" aria-label="Close session history">&times;</button>
    </header>
    <div class="history-sheet-body">${gamesHTML}</div>
  `;

  sheet.querySelector<HTMLButtonElement>(".history-close")?.addEventListener("click", dismissHistoryView);

  backdrop.hidden = false;
  sheet.hidden = false;

  const closeBtn = sheet.querySelector<HTMLButtonElement>(".history-close");
  if (closeBtn) closeBtn.focus();

  document.removeEventListener("keydown", handleHistoryKeydown);
  document.addEventListener("keydown", handleHistoryKeydown);
}

function handleHistoryKeydown(e: KeyboardEvent): void {
  if (e.key === "Escape") {
    e.preventDefault();
    dismissHistoryView();
  }
}

function dismissHistoryView(): void {
  const sheet = document.getElementById("history-sheet");
  const backdrop = document.getElementById("history-backdrop");
  if (sheet) sheet.hidden = true;
  if (backdrop) backdrop.hidden = true;
  document.removeEventListener("keydown", handleHistoryKeydown);
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

/**
 * The one place the free planner points at the rest of the app.
 *
 * It sits under the playing time totals rather than anywhere earlier, because
 * that is where a coach has finished with match day. Nothing is being withheld
 * here; the drills it points at need no account either.
 */
function renderNextStep(): HTMLElement {
  const section = document.createElement("div");
  section.className = "next-step";
  section.innerHTML = `
    <h4>Planning the training session too?</h4>
    <p>
      There are 100 drills in here filtered to what your age group is allowed to do,
      with a planner that adds the minutes up as you build. Free to look round with
      no account.
    </p>
    <a class="next-step-link" href="/hub#/catalogue" data-route="catalogue">See the drills</a>
  `;
  return section;
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

  const titleClass = isBalanced ? "fairness-title fairness-title-balanced" : "fairness-title";
  section.innerHTML = `
    <h4 class="${titleClass}">${headerText}</h4>
    <p class="fairness-legend">Games played \u00b7 a sub on or off counts as &frac12;</p>
  `;

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

// ---- Recent actions ----

const COLLAPSED_COUNT = 3;

/**
 * Derive human-readable action descriptions from events for a specific game.
 * Returns ALL matching actions, most-recent-first.
 *
 * Game-scoped events (sub, injured, joined) filter by gameNumber.
 * Session-level events (late, leaving) are included unfiltered because they are
 * rare, important and the coach needs to see them.
 */
function getGameActions(
  events: RotationEvent[],
  gameNumber: number,
  playerMap: PlayerMap,
): string[] {
  const actions: string[] = [];

  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.type === "sub" && e.gameNumber === gameNumber) {
      const inName = playerMap.get(e.playerIn)?.name ?? "Player";
      const outName = playerMap.get(e.playerOut)?.name ?? "Player";
      actions.push(`${inName} on for ${outName}`);
    } else if (e.type === "injured" && e.gameNumber === gameNumber) {
      const name = playerMap.get(e.playerId)?.name ?? "Player";
      actions.push(`${name} injured`);
    } else if (e.type === "joined" && e.duringGame === gameNumber) {
      const name = playerMap.get(e.playerId)?.name ?? "Player";
      actions.push(`${name} arrived`);
    } else if (e.type === "late") {
      const name = playerMap.get(e.playerId)?.name ?? "Player";
      // Show "not here yet" only if player hasn't arrived
      const hasJoined = events.some(
        (ev) => ev.type === "joined" && ev.playerId === e.playerId,
      );
      if (!hasJoined) {
        actions.push(`${name} not here yet`);
      }
    } else if (e.type === "leaving") {
      const name = playerMap.get(e.playerId)?.name ?? "Player";
      actions.push(`${name} leaving after game ${e.afterGame}`);
    }
  }

  return actions;
}

/**
 * Render the inline recent actions section with expand/collapse.
 * Flat chronological list (most recent first).
 * Shows COLLAPSED_COUNT items by default, expand reveals the rest.
 */
function renderRecentSection(
  events: RotationEvent[],
  gameNumber: number,
  playerMap: PlayerMap,
): HTMLElement | null {
  const allActions = getGameActions(events, gameNumber, playerMap);
  if (allActions.length === 0) return null;

  const collapsedActions = allActions.slice(0, COLLAPSED_COUNT);
  const hiddenActions = allActions.slice(COLLAPSED_COUNT);
  const hasMore = hiddenActions.length > 0;

  const section = document.createElement("div");
  section.className = "recent-actions";

  const label = document.createElement("span");
  label.className = "recent-actions-label";
  label.textContent = "Recent";
  section.appendChild(label);

  // Always-visible items
  const collapsedList = document.createElement("div");
  collapsedList.className = "recent-actions-list";
  for (const text of collapsedActions) {
    const item = document.createElement("div");
    item.className = "recent-actions-item";
    item.textContent = text;
    collapsedList.appendChild(item);
  }
  section.appendChild(collapsedList);

  if (hasMore) {
    // Overflow container. CSS grid animation for smooth expand/collapse
    const overflowOuter = document.createElement("div");
    overflowOuter.className = "recent-actions-overflow";
    const overflowInner = document.createElement("div");
    overflowInner.className = "recent-actions-list";
    for (const text of hiddenActions) {
      const item = document.createElement("div");
      item.className = "recent-actions-item";
      item.textContent = text;
      overflowInner.appendChild(item);
    }
    overflowOuter.appendChild(overflowInner);
    section.appendChild(overflowOuter);

    // Toggle control
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "recent-actions-toggle";
    toggle.textContent = "Show full history";
    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      const expanding = !overflowOuter.classList.contains("recent-actions-overflow-open");
      overflowOuter.classList.toggle("recent-actions-overflow-open");
      toggle.textContent = expanding ? "Show less" : "Show full history";
    });
    section.appendChild(toggle);
  }

  return section;
}

// ---- Helpers ----

