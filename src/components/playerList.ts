import type { Player } from "../types/index.js";

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 30;

let nextPlayerId = 1;
function generateId(): string {
  return `p${nextPlayerId++}`;
}

export interface PlayerListHandle {
  element: HTMLElement;
  getPlayers: () => Player[];
  getRawNames: () => string[];
}

/**
 * Stacked text input list. Starts with 2 fields.
 * "+ Add player" adds more. Remove buttons appear when > 2 rows.
 */
export function createPlayerList(initialNames?: string[]): PlayerListHandle {
  const container = document.createElement("div");
  container.className = "player-list-group";

  const list = document.createElement("div");
  list.className = "player-list";
  container.appendChild(list);

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "btn-add-player";
  addBtn.textContent = "+ Add player";
  container.appendChild(addBtn);

  // Prepopulate from saved names, or start with 2 empty rows
  const names = initialNames && initialNames.length > 0 ? initialNames : ["", ""];
  for (const name of names) {
    appendRow(list, name);
  }
  updateRemoveButtons(list);

  addBtn.addEventListener("click", () => {
    if (list.children.length >= MAX_PLAYERS) return;
    appendRow(list, "");
    updateRemoveButtons(list);
    updateAddButton(list, addBtn);
    const inputs = list.querySelectorAll<HTMLInputElement>(".player-input");
    inputs[inputs.length - 1].focus();
  });

  function getPlayers(): Player[] {
    const rows = list.querySelectorAll<HTMLElement>(".player-row");
    const players: Player[] = [];
    for (const row of rows) {
      const name = (row.querySelector(".player-input") as HTMLInputElement).value.trim();
      if (!name) continue;
      players.push({ id: row.dataset.playerId!, name });
    }
    return players;
  }

  function getRawNames(): string[] {
    const rows = list.querySelectorAll<HTMLElement>(".player-row");
    const raw: string[] = [];
    for (const row of rows) {
      raw.push((row.querySelector(".player-input") as HTMLInputElement).value);
    }
    return raw;
  }

  return { element: container, getPlayers, getRawNames };
}

function appendRow(list: HTMLElement, value: string): void {
  const row = document.createElement("div");
  row.className = "player-row";
  row.dataset.playerId = generateId();

  const input = document.createElement("input");
  input.type = "text";
  input.className = "player-input";
  input.placeholder = `Player ${list.children.length + 1}`;
  input.setAttribute("aria-label", `Player ${list.children.length + 1} name`);
  input.value = value;

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "btn-remove-player";
  removeBtn.title = "Remove";
  removeBtn.setAttribute("aria-label", `Remove player ${list.children.length + 1}`);
  removeBtn.textContent = "\u00D7";
  removeBtn.addEventListener("click", () => {
    row.remove();
    updateRemoveButtons(list);
    renumberPlaceholders(list);
    const addBtn = list.parentElement?.querySelector<HTMLButtonElement>(".btn-add-player");
    if (addBtn) updateAddButton(list, addBtn);
  });

  row.appendChild(input);
  row.appendChild(removeBtn);
  list.appendChild(row);
}

function renumberPlaceholders(list: HTMLElement): void {
  list.querySelectorAll<HTMLInputElement>(".player-input").forEach((inp, i) => {
    inp.placeholder = `Player ${i + 1}`;
    inp.setAttribute("aria-label", `Player ${i + 1} name`);
  });
}

function updateRemoveButtons(list: HTMLElement): void {
  const buttons = list.querySelectorAll<HTMLButtonElement>(".btn-remove-player");
  const show = list.children.length > MIN_PLAYERS;
  buttons.forEach((btn) => {
    btn.style.display = show ? "" : "none";
  });
}

function updateAddButton(list: HTMLElement, btn: HTMLButtonElement): void {
  btn.disabled = list.children.length >= MAX_PLAYERS;
}
