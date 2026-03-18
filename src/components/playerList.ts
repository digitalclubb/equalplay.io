import type { Player, PlayerStatus } from "../types/index.js";

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 30;

export interface PlayerListHandle {
  element: HTMLElement;
  /** Returns all players with names (trimmed, non-empty) and their status */
  getPlayers: () => Player[];
  /** Returns only names (for backward-compat with validation) */
  getPlayerNames: () => string[];
  /** Register a callback fired whenever a player status changes */
  onStatusChange: (cb: () => void) => void;
}

/**
 * Dynamic player input list with status toggles.
 * Each row: [name input] [Late] [Injured] [Remove]
 */
export function createPlayerList(): PlayerListHandle {
  const container = document.createElement("div");
  container.className = "form-group";

  const label = document.createElement("label");
  label.textContent = "Players";
  container.appendChild(label);

  const list = document.createElement("div");
  list.className = "player-list";
  container.appendChild(list);

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "btn-add-player";
  addBtn.textContent = "+ Add Player";
  container.appendChild(addBtn);

  let statusChangeCallbacks: (() => void)[] = [];

  function notifyStatusChange(): void {
    for (const cb of statusChangeCallbacks) cb();
  }

  // Seed with 2 empty rows
  appendRow(list, "", "active", notifyStatusChange);
  appendRow(list, "", "active", notifyStatusChange);
  updateRemoveButtons(list);

  addBtn.addEventListener("click", () => {
    if (list.children.length >= MAX_PLAYERS) return;
    appendRow(list, "", "active", notifyStatusChange);
    updateRemoveButtons(list);
    updateAddButton(list, addBtn);
    // Focus the newly added input
    const inputs = list.querySelectorAll<HTMLInputElement>(".player-input");
    inputs[inputs.length - 1].focus();
  });

  function getPlayers(): Player[] {
    const rows = list.querySelectorAll<HTMLElement>(".player-row");
    const players: Player[] = [];
    for (const row of rows) {
      const name = (row.querySelector(".player-input") as HTMLInputElement).value.trim();
      if (!name) continue;
      const status = (row.dataset.status as PlayerStatus) || "active";
      players.push({ name, status });
    }
    return players;
  }

  function getPlayerNames(): string[] {
    return getPlayers().map((p) => p.name);
  }

  return {
    element: container,
    getPlayers,
    getPlayerNames,
    onStatusChange(cb) {
      statusChangeCallbacks.push(cb);
    },
  };
}

function appendRow(
  list: HTMLElement,
  value: string,
  status: PlayerStatus,
  onStatusChange: () => void,
): void {
  const row = document.createElement("div");
  row.className = "player-row";
  row.dataset.status = status;

  const input = document.createElement("input");
  input.type = "text";
  input.className = "player-input";
  input.placeholder = `Player ${list.children.length + 1}`;
  input.value = value;

  // Status toggle buttons
  const statusGroup = document.createElement("div");
  statusGroup.className = "status-toggles";

  const lateBtn = createStatusButton("Late", "late", row, onStatusChange);
  const injuredBtn = createStatusButton("Injured", "injured", row, onStatusChange);
  statusGroup.appendChild(lateBtn);
  statusGroup.appendChild(injuredBtn);

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "btn-remove-player";
  removeBtn.title = "Remove player";
  removeBtn.textContent = "\u00D7";
  removeBtn.addEventListener("click", () => {
    row.remove();
    updateRemoveButtons(list);
    renumberPlaceholders(list);
    const addBtn = list.parentElement?.querySelector<HTMLButtonElement>(".btn-add-player");
    if (addBtn) updateAddButton(list, addBtn);
    onStatusChange();
  });

  row.appendChild(input);
  row.appendChild(statusGroup);
  row.appendChild(removeBtn);
  list.appendChild(row);
}

function createStatusButton(
  label: string,
  targetStatus: PlayerStatus,
  row: HTMLElement,
  onStatusChange: () => void,
): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `btn-status btn-status-${targetStatus}`;
  btn.textContent = label;
  btn.addEventListener("click", () => {
    // Toggle: if already this status, revert to active
    const current = row.dataset.status as PlayerStatus;
    row.dataset.status = current === targetStatus ? "active" : targetStatus;
    onStatusChange();
  });
  return btn;
}

function renumberPlaceholders(list: HTMLElement): void {
  list.querySelectorAll<HTMLInputElement>(".player-input").forEach((inp, i) => {
    inp.placeholder = `Player ${i + 1}`;
  });
}

function updateRemoveButtons(list: HTMLElement): void {
  const buttons = list.querySelectorAll<HTMLButtonElement>(".btn-remove-player");
  const atMin = list.children.length <= MIN_PLAYERS;
  buttons.forEach((btn) => {
    btn.style.visibility = atMin ? "hidden" : "visible";
  });
}

function updateAddButton(list: HTMLElement, btn: HTMLButtonElement): void {
  btn.disabled = list.children.length >= MAX_PLAYERS;
}
