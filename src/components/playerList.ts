import type { Player } from "../types/index.js";

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 30;

let nextPlayerId = 1;
function generateId(): string {
  return `p${nextPlayerId++}`;
}

export interface PlayerListHandle {
  element: HTMLElement;
  /** Returns all players with non-empty names */
  getPlayers: () => Player[];
}

/**
 * Dynamic player name input list.
 * Each row: [name input] [remove button]
 * Each row gets a stable ID for tracking through rotation logic.
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

  appendRow(list, "");
  appendRow(list, "");
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

  return { element: container, getPlayers };
}

function appendRow(list: HTMLElement, value: string): void {
  const row = document.createElement("div");
  row.className = "player-row";
  row.dataset.playerId = generateId();

  const input = document.createElement("input");
  input.type = "text";
  input.className = "player-input";
  input.placeholder = `Player ${list.children.length + 1}`;
  input.value = value;

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
  });

  row.appendChild(input);
  row.appendChild(removeBtn);
  list.appendChild(row);
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
