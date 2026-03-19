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
}

/**
 * Chip-based player input. Type a name, press Enter or tap Add.
 * Players appear as removable chips in a flow layout.
 */
export function createPlayerList(): PlayerListHandle {
  const container = document.createElement("div");
  container.className = "player-chips-group";

  const label = document.createElement("label");
  label.textContent = "Players";
  container.appendChild(label);

  const chipArea = document.createElement("div");
  chipArea.className = "player-chips";
  container.appendChild(chipArea);

  // Input row: text field + add button
  const inputRow = document.createElement("div");
  inputRow.className = "player-add-row";

  const input = document.createElement("input");
  input.type = "text";
  input.className = "player-add-input";
  input.placeholder = "Player name";

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "player-add-btn";
  addBtn.textContent = "+ Add";

  function addPlayer(): void {
    const name = input.value.trim();
    if (!name) return;
    if (chipArea.children.length >= MAX_PLAYERS) return;

    const chip = document.createElement("span");
    chip.className = "player-chip";
    chip.dataset.playerId = generateId();

    const nameSpan = document.createElement("span");
    nameSpan.textContent = name;
    chip.appendChild(nameSpan);

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "player-chip-remove";
    removeBtn.textContent = "\u00D7";
    removeBtn.addEventListener("click", () => {
      chip.remove();
      updateCount();
    });
    chip.appendChild(removeBtn);

    chipArea.appendChild(chip);
    input.value = "";
    input.focus();
    updateCount();
  }

  addBtn.addEventListener("click", addPlayer);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addPlayer();
    }
  });

  inputRow.appendChild(input);
  inputRow.appendChild(addBtn);
  container.appendChild(inputRow);

  // Count display
  const countEl = document.createElement("div");
  countEl.className = "player-count";
  container.appendChild(countEl);

  function updateCount(): void {
    const n = chipArea.children.length;
    countEl.textContent = n > 0 ? `${n} player${n !== 1 ? "s" : ""}` : "";
    if (n < MIN_PLAYERS && n > 0) {
      countEl.textContent += ` (need at least ${MIN_PLAYERS})`;
    }
  }

  function getPlayers(): Player[] {
    const chips = chipArea.querySelectorAll<HTMLElement>(".player-chip");
    const players: Player[] = [];
    for (const chip of chips) {
      const name = chip.querySelector("span")?.textContent?.trim();
      if (!name) continue;
      players.push({ id: chip.dataset.playerId!, name });
    }
    return players;
  }

  return { element: container, getPlayers };
}
